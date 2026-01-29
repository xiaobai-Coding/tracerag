import { embedQuery, embedChunks } from "../utils/embedding";
import { selectRetrievalChunks } from "../utils/similarity";
import { applyContextBudget } from "../utils/chunk";
import { streamDeepSeekAPI } from "./aiService";
import { getSystemPrompt } from "../prompts/prompt";
import { decideEvidenceStatus } from "../utils/evidenceGate";
import type {
  QAResponse,
  QAMetrics,
  EvidenceStatus,
  ChatMessage,
} from "../types/qa";
import type { Chunk } from "../utils/chunk";
import { getStandaloneQuery } from "../utils/queryRewriter";
import { summarizeHistory } from "../utils/historyManager";

const chunkEmbeddingCache = new Map<string, number[]>();

function chunkKey(text: string) {
  return text.trim();
}

export async function answerQuestion(
  question: string,
  chunks: Chunk[],
  strategy?: "auto" | "topk" | "mmr",
  history: ChatMessage[] = [],
  onStream?: (chunk: string) => void,
  locale: string = 'zh'
): Promise<QAResponse> {
  const isEn = locale.startsWith('en');
  if (!question || !question.trim()) {
    throw new Error(isEn ? "Question cannot be empty" : "question 不能为空");
  }
  if (!Array.isArray(chunks) || !chunks.length) {
    throw new Error(isEn ? "Chunks cannot be empty" : "chunks 不能为空");
  }
  
  // 0. 历史摘要优化
  const optimizedHistory = await summarizeHistory(history, locale);
  
  // 1. 查询重写
  const standaloneQuery = await getStandaloneQuery(optimizedHistory, question, locale);

  // 如果是闲聊/不需要检索
  if (standaloneQuery === "NO_SEARCH_NEEDED") {
    const historyText =
      optimizedHistory && optimizedHistory.length
        ? optimizedHistory
            .map((m, idx) => {
              const prefix = m.role === "user" ? "user" : "assistant";
              return `${idx + 1}. ${prefix}：${m.content}`;
            })
            .join("\n")
        : (isEn ? "(None)" : "（无）");

    const messages = [
      { role: "system", content: getSystemPrompt('CHAT', locale) },
      {
        role: "user",
        content:
          (isEn ? `[Chat History]\n${historyText}\n\n` : `[对话历史]\n${historyText}\n\n`) +
          (isEn ? `[Current Question]\n${question}\n\n` : `[当前问题]\n${question}\n\n`),
      },
    ];

    const res = await streamDeepSeekAPI(messages, false, (chunk, key) => {
      if (onStream && key === 'answer') {
        onStream(chunk);
      }
    }, locale);
    const parsed: any = res;
    const answerText =
      parsed?.answer ||
      (typeof parsed === "string" ? parsed : "") ||
      (isEn ? "I'm here~" : "我在这里～");

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
      clarify_options: isEn ? [
        "Which part are you asking about? Please be more specific.",
        "Can you provide key fields/keywords (e.g., amount/date/invoice number)?",
        "Are you looking for a specific clause or field?"
      ] : [
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

  // ========= 证据继承 =========
  let inheritedChunks: Chunk[] = [];
  if (optimizedHistory && optimizedHistory.length) {
    const lastAssistant = [...optimizedHistory]
      .reverse()
      .find((m) => m.role === "assistant" && Array.isArray(m.usedChunks) && m.usedChunks.length > 0);
    if (lastAssistant?.usedChunks?.length) {
      inheritedChunks = lastAssistant.usedChunks;
    }
  }

  const chunkMap = new Map<string, Chunk>();
  chunks.forEach((c) => chunkMap.set(c.id, c));

  const currentContextChunks: Chunk[] = [];
  for (const item of finalTopChunks) {
    const c = chunkMap.get(item.chunkId);
    if (c) currentContextChunks.push(c);
  }

  const mergedContextChunks: Chunk[] = [];
  const seenIds = new Set<string>();

  for (const ic of inheritedChunks) {
    const c = chunkMap.get(ic.id) || ic;
    if (c && !seenIds.has(c.id)) {
      mergedContextChunks.push(c);
      seenIds.add(c.id);
    }
  }

  for (const cc of currentContextChunks) {
    if (!seenIds.has(cc.id)) {
      mergedContextChunks.push(cc);
      seenIds.add(cc.id);
    }
  }

  const contextChunksForPrompt = mergedContextChunks.length ? mergedContextChunks : currentContextChunks;
  const contextIdsSet = new Set(contextChunksForPrompt.map(c => c.id));
  const inheritedIds = new Set(inheritedChunks.map(c => c.id));

  // 构建提示词
  const userChunks = contextChunksForPrompt
    .map((item) => {
      const sourceLabel = inheritedIds.has(item.id) ? (isEn ? " (Source: Previous Turn)" : " (引用来源：上一轮)") : "";
      return `#${item.id}${sourceLabel}: ${item.text}`;
    })
    .join("\n----\n");

  const historyText =
    optimizedHistory && optimizedHistory.length
      ? optimizedHistory
          .map((m, idx) => {
            const prefix = m.role === "user" ? "user" : "assistant";
            return `${idx + 1}. ${prefix}：${m.content}`;
          })
          .join("\n")
      : (isEn ? "(None)" : "（无）");

  const messages = [
    { role: "system", content: getSystemPrompt('QA', locale) },
    {
      role: "user",
      content:
        (isEn ? `###[Chat History] Context for pronouns, not factual source:\n${historyText}\n\n` : `###[对话历史]（Chat History）这是你和用户之前的对话背景，仅供参考指代关系，不可作为事实来源：\n${historyText}\n\n`) +
        (isEn ? `###[Current Query] Answer this question:\n${question}\n\n` : `###[当前问题]（Current Query）这是用户最新的问题，你必须按照这个问题回答：\n${question}\n\n`) +
        (isEn ? `###[Current Evidence] Latest facts from document, prioritize this:\n${userChunks}\n\n` : `###[当前证据]（Current Evidence）（按相关度排序，# 为片段编号）这是从文档中检索到的最新事实，你必须优先基于此内容回答：\n${userChunks}\n\n`) +
        (isEn ? "Please combine the history and evidence to answer in the specified JSON format. The 'sources' field must only reference the fragment IDs above. Return the answer in the user's language." : "请结合上述对话历史和当前证据，用中文按指定 JSON 格式回答，其中 sources 字段只能引用上文出现的片段编号。"),
    },
  ];

  const res = await streamDeepSeekAPI(messages, false, (chunk, key) => {
    if (onStream && key === 'answer') {
      onStream(chunk);
    }
  }, locale);
  const content = res || "";

  try {
    const parsed: any = content;
    const citations = Array.isArray(parsed?.sources) ? parsed.sources : [];
    const allowedIds = new Set(contextIdsSet);

    const invalidCitations = citations.filter((citation: string) => {
      const numCitation = parseInt(citation);
      if (!isNaN(numCitation)) {
        return !allowedIds.has(`chunk-${numCitation}`);
      }
      return !allowedIds.has(citation);
    });

    if (invalidCitations.length > 0) {
      return {
        status: 'no_evidence' as EvidenceStatus,
        answer: null,
        used_chunks,
        metrics,
        need_clarify: false
      };
    }

    const citationIdSet = new Set<string>();
    for (const c of citations) {
      if (!c) continue;
      const numCitation = parseInt(c);
      if (!isNaN(numCitation)) {
        citationIdSet.add(`chunk-${numCitation}`);
      } else {
        citationIdSet.add(c);
      }
    }

    const selectedIdSet = new Set(contextIdsSet);
    const chunkMapForDetail = new Map<string, Chunk>();
    chunks.forEach((c) => chunkMapForDetail.set(c.id, c));

    const usedChunksDetail: Chunk[] = [];
    citationIdSet.forEach((id) => {
      if (!selectedIdSet.has(id)) return;
      const c = chunkMapForDetail.get(id);
      if (c) {
        usedChunksDetail.push(c);
      }
    });

    return {
      status: 'has_evidence' as EvidenceStatus,
      answer: parsed?.answer ?? (isEn ? "No relevant info found" : "文档中没有找到相关信息"),
      used_chunks,
      metrics,
      need_clarify: false,
      citations,
      used_chunks_detail: usedChunksDetail,
      inherited_ids: Array.from(inheritedIds)
    };
  } catch (e) {
    throw new Error(isEn ? "LLM response is not valid JSON" : "LLM 返回的内容不是合法 JSON");
  }
}
