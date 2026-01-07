import { embedQuery, embedChunks } from "../utils/embedding";
import { searchRelevantChunks } from "../utils/similarity";
import { streamDeepSeekAPI } from "./aiService";
import { mmrSelect } from "../utils/mmr";
import { QA_SYSTEM_PROMPT } from "../prompts/prompt";

const chunkEmbeddingCache = new Map<string, number[]>();

function chunkKey(text: string) {
  return text.trim();
}

export async function answerQuestion(
  question: string,
  chunks: string[]
): Promise<any> {
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
  const topIndexes = mmrSelect(queryVector, chunkVectors, 3);

  const topK = topIndexes.map((idx) => ({
    index: idx,
    text: chunks[idx],
    score: 1 // 模型不需要这个字段
  }));

  console.log("MMR topK", topK);
  if (!topK.length) {
    return { answer: "文档中没有找到相关信息", sources: [] };
  }

  // 4. 构建提示词
  const userChunks = topK
    .map((item) => `#${item.index + 1}: ${item.text}`)
    .join("\n----\n");

  const messages = [
    { role: "system", content: QA_SYSTEM_PROMPT },
    {
      role: "user",
      content: `用户问题：${question}\n\n相关文档片段（按相关度排序，# 为片段编号）：\n${userChunks}\n\n请按指定 JSON 格式回答。`
    }
  ];

  // 5. 调用 DeepSeek API 进行回答
  const res = await streamDeepSeekAPI(messages, false);
  const content = res || "";

  try {
    const parsed: any = content;
    return {
      answer: parsed?.answer ?? "文档中没有找到相关信息",
      sources: Array.isArray(parsed?.sources) ? parsed.sources : []
    };
  } catch (e) {
    throw new Error("LLM 返回的内容不是合法 JSON");
  }
}
