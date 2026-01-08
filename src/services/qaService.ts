import { embedQuery, embedChunks } from "../utils/embedding";
import { searchRelevantChunks } from "../utils/similarity";
import { streamDeepSeekAPI } from "./aiService";
import { mmrSelect } from "../utils/mmr";
import { QA_SYSTEM_PROMPT } from "../prompts/prompt";
import { decideEvidenceStatus } from "../utils/evidenceGate";
import type { QAResponse, QAMetrics, EvidenceStatus } from "../types/qa";

const chunkEmbeddingCache = new Map<string, number[]>();

function chunkKey(text: string) {
  return text.trim();
}

export async function answerQuestion(
  question: string,
  chunks: string[]
): Promise<QAResponse> {
  if (!question || !question.trim()) {
    throw new Error("question 不能为空");
  }
  if (!Array.isArray(chunks) || !chunks.length) {
    throw new Error("chunks 不能为空");
  }
  // 1. 对用户问题进行向量化
  const queryVector = await embedQuery(question);
  // 2. 对文档片段进行向量化，并缓存
  const missing: { idx: number; text: string }[] = [];
  chunks.forEach((c, i) => {
    if (!chunkEmbeddingCache.has(chunkKey(c))) {
      missing.push({ idx: i, text: c });
    }
  });

  if (missing.length) {
    const embeddings: any = await embedChunks(missing.map((m) => m.text));
    missing.forEach((m, idx) => {
      chunkEmbeddingCache.set(chunkKey(m.text), embeddings[idx]);
    });
  }

  const chunkVectors = chunks.map(
    (c) => chunkEmbeddingCache.get(chunkKey(c)) || []
  );

  // 3. 在片段向量中检索最相关的 topK 片段 使用 MMR 算法
  const k = 3;
  const topResults = mmrSelect(queryVector, chunkVectors, k);

  const topChunks = topResults.map((result) => ({
    index: result.index,
    text: chunks[result.index],
    score: result.mmrScore,
    relevance: result.relevance
  }));

  console.log("MMR topK", topChunks);

  // 4. 证据三态判定
  const LOW = 0.40;
  const HIGH = 0.52;
  const top1Score = topChunks?.[0]?.relevance ?? 0;
  const status = decideEvidenceStatus(top1Score, LOW, HIGH);

  console.log(`[Evidence Gate] top1_score=${top1Score}, status=${status}, strategy=mmr`);

  // 生成 used_chunks（最多取 topK 的 chunk_id + score）
  const used_chunks = topChunks.slice(0, k).map(chunk => ({
    chunk_id: chunk.index.toString(),
    score: chunk.score
  }));

  // 构建 metrics
  const metrics: QAMetrics = {
    top1_score: top1Score,
    strategy: 'mmr',
    k,
    low: LOW,
    high: HIGH
  };

  // A) no_evidence：不调用 LLM，直接返回
  if (status === 'no_evidence') {
    return {
      status,
      answer: null,
      used_chunks,
      metrics,
      need_clarify: false
    };
  }

  // B) need_clarify：不调用 LLM，返回澄清选项
  if (status === 'need_clarify') {
    return {
      status,
      answer: null,
      used_chunks,
      metrics,
      need_clarify: true,
      clarify_options: [
        "你想问的是哪一部分？请更具体一点。",
        "能否提供关键字段/关键词（例如金额/日期/发票号码）？",
        "你希望查询的是某个条款/某个字段吗？"
      ]
    };
  }

  // C) has_evidence：继续走原本 LLM 回答流程
  if (!topChunks.length) {
    return {
      status: 'no_evidence' as EvidenceStatus,
      answer: null,
      used_chunks: [],
      metrics,
      need_clarify: false
    };
  }

  // 构建提示词
  const userChunks = topChunks
    .map((item) => `#${item.index + 1}: ${item.text}`)
    .join("\n----\n");

  const messages = [
    { role: "system", content: QA_SYSTEM_PROMPT },
    {
      role: "user",
      content: `用户问题：${question}\n\n相关文档片段（按相关度排序，# 为片段编号）：\n${userChunks}\n\n请按指定 JSON 格式回答。`
    }
  ];

  // 调用 DeepSeek API 进行回答
  const res = await streamDeepSeekAPI(messages, false);
  const content = res || "";

  try {
    const parsed: any = content;
    return {
      status: 'has_evidence' as EvidenceStatus,
      answer: parsed?.answer ?? "文档中没有找到相关信息",
      used_chunks,
      metrics,
      need_clarify: false,
      citations: Array.isArray(parsed?.sources) ? parsed.sources : []
    };
  } catch (e) {
    throw new Error("LLM 返回的内容不是合法 JSON");
  }
}
