import { embedQuery, embedChunks } from "../utils/embedding";
import { selectRetrievalChunks } from "../utils/similarity";
import { applyContextBudget } from "../utils/chunk";
import { streamDeepSeekAPI } from "./aiService";
import { QA_SYSTEM_PROMPT } from "../prompts/prompt";
import { decideEvidenceStatus } from "../utils/evidenceGate";
import type {
  QAResponse,
  QAMetrics,
  EvidenceStatus,
  ChatMessage,
} from "../types/qa";
import type { Chunk } from "../utils/chunk";
import { getStandaloneQuery } from "../utils/queryRewriter";

const chunkEmbeddingCache = new Map<string, number[]>();

function chunkKey(text: string) {
  return text.trim();
}

export async function answerQuestion(
  question: string,
  chunks: Chunk[],
  strategy?: "auto" | "topk" | "mmr",
  history: ChatMessage[] = []
): Promise<QAResponse> {
  if (!question || !question.trim()) {
    throw new Error("question 不能为空");
  }
  if (!Array.isArray(chunks) || !chunks.length) {
    throw new Error("chunks 不能为空");
  }

  // 0. 先进行查询重写，得到独立检索词
  const standaloneQuery = await getStandaloneQuery(history, question);
  console.log(
    "[RAG] standalone query:",
    standaloneQuery,
    "raw question:",
    question
  );

  // 如果是闲聊/不需要检索，直接走普通对话，不做向量检索
  if (standaloneQuery === "NO_SEARCH_NEEDED") {
    const historyText =
      history && history.length
        ? history
            .map((m, idx) => {
              const prefix = m.role === "user" ? "用户" : "助手";
              return `${idx + 1}. ${prefix}：${m.content}`;
            })
            .join("\n")
        : "（无）";

    const messages = [
      { role: "system", content: QA_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `[对话历史]\n${historyText}\n\n` +
          `[当前问题]\n${question}\n\n` +
          "当前问题被识别为与文档检索无关的闲聊/自然对话，请直接进行自然回复，不要引用文档片段，也不要伪造引用。",
      },
    ];

    const res = await streamDeepSeekAPI(messages, false);
    const parsed: any = res;
    const answerText =
      parsed?.answer ||
      (typeof parsed === "string" ? parsed : "") ||
      "我在这里～";

    const metrics: QAMetrics = {
      top1_score: 0,
      strategy: "topk",
      k: 0,
      low: 0,
      high: 0,
      context_chars: 0,
      context_chunks: 0,
    };

    return {
      status: "has_evidence",
      answer: answerText,
      used_chunks: [],
      metrics,
      need_clarify: false,
      citations: [],
    };
  }

  // 1. 对重写后的查询进行向量化
  const queryVector = await embedQuery(standaloneQuery);
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
    standaloneQuery,
    queryVector,
    chunks,
    chunkVectors,
    k,
    strategy || "auto", // 使用传入的策略，默认auto
    0.7   // MMR lambda参数
  );

  const retrievedChunks = retrievalResult.selectedChunks
    .map((result) => chunks[result.index])
    .filter((chunk): chunk is Chunk => chunk !== undefined);

  const topChunks = retrievedChunks.map((chunk, idx) => ({
    chunkId: chunk.id,
    index: chunk.index,
    text: chunk.text,
    score: retrievalResult.selectedChunks[idx]?.score || 0,
    relevance: retrievalResult.selectedChunks[idx]?.score || 0
  }));

  console.log(`${retrievalResult.strategyUsed.toUpperCase()} topK`, topChunks);

  // 4. 证据三态判定（基于原始检索结果）
  const LOW = 0.40;
  const HIGH = 0.52;
  const top1Score = topChunks?.[0]?.relevance ?? 0;
  const status = decideEvidenceStatus(top1Score, LOW, HIGH);

  // 5. 应用Context预算控制（在证据判定之后）
  const budgetResult = applyContextBudget(
    standaloneQuery,
    retrievedChunks,
    2000, // 最大2000字符
    3 // 最多3个片段
  );

  const finalTopChunks = budgetResult.selectedChunks.map((chunk) => ({
    chunkId: chunk.id,
    index: chunk.index,
    text: chunk.text,
    score: retrievalResult.selectedChunks.find(r => chunks[r.index] === chunk)?.score || 0,
    relevance: retrievalResult.selectedChunks.find(r => chunks[r.index] === chunk)?.score || 0
  }));

  console.log(`${retrievalResult.strategyUsed.toUpperCase()} + Context Budget: ${budgetResult.chunkCount}片段, ${budgetResult.totalChars}字符`, finalTopChunks);
  // 生成 used_chunks（基于预算处理后的结果）
  const used_chunks = finalTopChunks.slice(0, k).map(chunk => ({
    chunk_id: chunk.chunkId,
    score: chunk.score
  }));

  // 构建 metrics
  const metrics: QAMetrics = {
    top1_score: top1Score,
    strategy: retrievalResult.strategyUsed,
    k,
    low: LOW,
    high: HIGH,
    context_chars: budgetResult.totalChars,
    context_chunks: budgetResult.chunkCount
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
  if (!finalTopChunks.length) {
    return {
      status: 'no_evidence' as EvidenceStatus,
      answer: null,
      used_chunks: [],
      metrics,
      need_clarify: false
    };
  }

  // 构建提示词（使用预算处理后的上下文）
  const userChunks = finalTopChunks
    .map((item) => `#${item.chunkId}: ${item.text}`)
    .join("\n----\n");

  const historyText =
    history && history.length
      ? history
          .map((m, idx) => {
            const prefix = m.role === "user" ? "用户" : "助手";
            return `${idx + 1}. ${prefix}：${m.content}`;
          })
          .join("\n")
      : "（无）";

  const messages = [
    { role: "system", content: QA_SYSTEM_PROMPT },
    // 在 System Prompt 之后插入对话历史，再给出当前检索上下文，避免证据污染
    {
      role: "user",
      content:
        `[对话历史]\n${historyText}\n\n` +
        `[当前问题]\n${question}\n\n` +
        `[当前证据]（按相关度排序，# 为片段编号）\n${userChunks}\n\n` +
        "请结合上述对话历史和当前证据，用中文按指定 JSON 格式回答，其中 sources 字段只能引用上文出现的片段编号。",
    },
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
