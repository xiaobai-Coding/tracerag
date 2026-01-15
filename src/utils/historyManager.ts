import type { ChatMessage } from "../types/qa";
import { HISTORY_SUMMARY_PROMPT } from "../prompts/prompt"
import { countTokens } from "./tokenCounter";


/**
 * 将对话历史压缩为摘要（Map-Reduce 模式）
 * 
 * @param history 原始对话历史
 * @returns 优化后的对话历史（如果超过阈值则压缩，否则返回原历史）
 * 
 * @example
 * // 历史 <= 8 条，直接返回
 * summarizeHistory([user1, assistant1]) // 返回原数组
 * 
 * // 历史 > 8 条，压缩旧消息
 * summarizeHistory([user1, assistant1, ..., user5, assistant5]) 
 * // 返回: [{role: 'assistant', content: '[前文背景摘要]：...'}, user4, assistant4]
 */
export async function summarizeHistory(
  history: ChatMessage[],
): Promise<ChatMessage[]> {
  const TOKEN_THRESHOLD = 2500; // token最大阀值

  const totalTokens = countTokens(history);
  console.log(`[HistoryManager] 预估总 Token: ${totalTokens}`);

  if (!history || history.length === 0) return history;
  if (totalTokens <= TOKEN_THRESHOLD) return history;

  try {
    // Map 阶段：保留最新 2 轮（约 4 条消息），其余旧消息做摘要
    const KEEP_MESSAGES = 4;
    const messagesToSummarize = history.slice(0, Math.max(0, history.length - KEEP_MESSAGES));
    const recentMessages = history.slice(-KEEP_MESSAGES);

    // 如果没有可摘要的旧消息，则不压缩
    if (!messagesToSummarize.length) return history;

    // 将旧消息格式化为文本
    const historyText = messagesToSummarize
      .map((m, idx) => {
        const prefix = m.role === "user" ? "user" : "assistant";
        return `${idx + 1}. ${prefix}：${m.content}`;
      })
      .join("\n");

    // 调用 AI 生成摘要
    const summaryPrompt = HISTORY_SUMMARY_PROMPT.replace("{history}", historyText);

    const requestBody = {
      messages: [
        {
          role: "system",
          content: "你是一个专业的对话历史摘要助手，擅长提取关键信息并压缩长文本。",
        },
        { role: "user", content: summaryPrompt },
      ],
      stream: false,
      temperature: 0.2, // 低温度保证摘要的准确性和一致性
    };

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-token": "tracerag-web",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(
        `[HistoryManager] 摘要生成失败 (${response.status}): ${text}，降级使用原始历史`
      );
      return history; // 降级：返回原始历史
    }

    const data = await response.json();
    const summaryContent: string | undefined =
      data?.choices?.[0]?.message?.content;

    if (!summaryContent || typeof summaryContent !== "string") {
      console.warn(
        "[HistoryManager] AI 返回的摘要内容无效，降级使用原始历史"
      );
      return history; // 降级：返回原始历史
    }

    const cleanedSummary = summaryContent.trim().replace(/^["']|["']$/g, "");

    // Reduce 阶段：重组历史
    // 首条消息为背景摘要（标记为 assistant role，便于后续处理）
    const summaryMessage: ChatMessage = {
      role: "assistant",
      content: `[前文背景摘要]：${cleanedSummary}`,
    };

    // Reduce：摘要 + 最近 2 轮（4 条）原始消息
    const optimizedHistory = [summaryMessage, ...recentMessages];

    console.log(
      `[HistoryManager] 历史压缩完成：${history.length} 条 → ${optimizedHistory.length} 条（token ${totalTokens} > ${TOKEN_THRESHOLD}）`
    );

    return optimizedHistory;
  } catch (error) {
    console.error("[HistoryManager] 摘要生成异常:", error);
    // 降级：返回原始历史，确保不影响主流程
    return history;
  }
}
