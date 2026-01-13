import { embedQuery, embedChunks } from "../utils/embedding";
import { selectRetrievalChunks } from "../utils/similarity";
import { streamDeepSeekAPI } from "./aiService";
import { QA_SYSTEM_PROMPT } from "../prompts/prompt";
import { decideEvidenceStatus } from "../utils/evidenceGate";
import type { QAResponse, QAMetrics, EvidenceStatus } from "../types/qa";
import type { Chunk } from "../utils/chunk";

const chunkEmbeddingCache = new Map<string, number[]>();

function chunkKey(text: string) {
  return text.trim();
}

export async function answerQuestion(
  question: string,
  chunks: Chunk[],
  strategy?: "auto" | "topk" | "mmr"
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
  const missing: { idx: number; chunk: Chunk }[] = [];
  chunks.forEach((c, i) => {
    if (!chunkEmbeddingCache.has(chunkKey(c.text))) {
      missing.push({ idx: i, chunk: c });
    }
  });

  if (missing.length) {
    const embeddings: any = await embedChunks(missing.map((m) => m.chunk.text));
    missing.forEach((m, idx) => {
      chunkEmbeddingCache.set(chunkKey(m.chunk.text), embeddings[idx]);
    });
  }

  const chunkVectors = chunks.map(
    (c) => chunkEmbeddingCache.get(chunkKey(c.text)) || []
  );

  // 3. 使用统一的检索策略选择函数
  const k = 3;
  const retrievalResult = selectRetrievalChunks(
    question,
    queryVector,
    chunks,
    chunkVectors,
    k,
    strategy || "auto", // 使用传入的策略，默认auto
    0.7   // MMR lambda参数
  );

  const topChunks = retrievalResult.selectedChunks.map((result) => ({
    chunkId: chunks[result.index]?.id || `chunk-${result.index + 1}`,
    index: chunks[result.index]?.index || (result.index + 1),
    text: chunks[result.index]?.text || '',
    score: result.score,
    relevance: result.score // 对于MMR这里是mmrScore，对于TopK是相似度
  }));

  console.log(`${retrievalResult.strategyUsed.toUpperCase()} topK`, topChunks);

  // 4. 证据三态判定
  const LOW = 0.40;
  const HIGH = 0.52;
  const top1Score = topChunks?.[0]?.relevance ?? 0;
  const status = decideEvidenceStatus(top1Score, LOW, HIGH);
  // 生成 used_chunks（最多取 topK 的 chunk_id + score）
  const used_chunks = topChunks.slice(0, k).map(chunk => ({
    chunk_id: chunk.chunkId,
    score: chunk.score
  }));

  // 构建 metrics
  const metrics: QAMetrics = {
    top1_score: top1Score,
    strategy: retrievalResult.strategyUsed,
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
    .map((item) => `#${item.chunkId}: ${item.text}`)
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

    // 检查引用完整性：确保所有citations都包含在used_chunks中
    const citations = Array.isArray(parsed?.sources) ? parsed.sources : [];
    const usedChunkIds = new Set(used_chunks.map(chunk => chunk.chunk_id));

    // 检查是否有任何citation不在used_chunks中
    const invalidCitations = citations.filter((citation: string) => {
      // citation可能是数字字符串或chunk-id格式，需要统一处理
      const numCitation = parseInt(citation);
      if (!isNaN(numCitation)) {
        // 如果是数字，转换为chunk-id格式
        return !usedChunkIds.has(`chunk-${numCitation}`);
      }
      // 如果已经是chunk-id格式，直接检查
      return !usedChunkIds.has(citation);
    });

    // 如果有无效引用，返回no_evidence
    if (invalidCitations.length > 0) {
      console.log(`[Citation Integrity] Invalid citations found: ${invalidCitations.join(', ')}, used chunks: ${Array.from(usedChunkIds).join(', ')}`);
      return {
        status: 'no_evidence' as EvidenceStatus,
        answer: null,
        used_chunks,
        metrics,
        need_clarify: false
      };
    }

    return {
      status: 'has_evidence' as EvidenceStatus,
      answer: parsed?.answer ?? "文档中没有找到相关信息",
      used_chunks,
      metrics,
      need_clarify: false,
      citations
    };
  } catch (e) {
    throw new Error("LLM 返回的内容不是合法 JSON");
  }
}
