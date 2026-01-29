import type { ChatMessage } from "../types/qa";
import { getSystemPrompt, HISTORY_SUMMARY_PROMPT } from "../prompts/prompt"
import { countTokens } from "./tokenCounter";


import { logger } from "./logger";

/**
 * 将对话历史压缩为摘要（Map-Reduce 模式）
 * 
 * @param history 原始对话历史
 * @param locale 语言代码
 * @returns 优化后的对话历史（如果超过阈值则压缩，否则返回原历史）
 */
export async function summarizeHistory(
  history: ChatMessage[],
  locale: string = 'zh'
): Promise<ChatMessage[]> {
  const isEn = locale.startsWith('en');
  const TOKEN_THRESHOLD = 2500; // token最大阀值

  const totalTokens = countTokens(history);
  
  if (!history || history.length === 0) return history;
  if (totalTokens <= TOKEN_THRESHOLD) return history;

  try {
    return await logger.trackTime('HistoryManager', 'SummarizeHistory', async () => {
        logger.info('HistoryManager', 'StartSummarize', { total_tokens: totalTokens, threshold: TOKEN_THRESHOLD });

        // Map 阶段：保留最新 2 轮（约 4 条消息），其余旧消息做摘要
        const KEEP_MESSAGES = 4;
        const messagesToSummarize = history.slice(0, Math.max(0, history.length - KEEP_MESSAGES));
        const recentMessages = history.slice(-KEEP_MESSAGES);

        // 如果没有可摘要的旧消息，则不压缩
        if (!messagesToSummarize.length) return history;

        // Map Phase: 准备数据
        const historyText = messagesToSummarize
        .map((m, idx) => {
            const prefix = m.role === "user" ? "user" : "assistant";
            return `${idx + 1}. ${prefix}：${m.content}`;
        })
        .join("\n");

        // 模拟 Map 阶段埋点
        await logger.trackTime('HistoryManager', 'MapPhase', async () => {
             return historyText;
        }, { phase: 'map', shard_count: messagesToSummarize.length, input_length: historyText.length });


        const summaryPrompt = HISTORY_SUMMARY_PROMPT.replace("{history}", historyText);

        const requestBody = {
        messages: [
            {
            role: "system",
            content: getSystemPrompt('HISTORY', locale),
            },
            { role: "user", content: summaryPrompt },
        ],
        stream: false,
        temperature: 0.2,
        };

        // Reduce Phase: LLM 生成摘要
        const cleanedSummary = await logger.trackTime('HistoryManager', 'ReducePhase', async () => {
             const response = await fetch("/api/ai", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-client-token": "tracerag-web",
                    "Accept-Language": locale
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const text = await response.text();
                logger.error('HistoryManager', 'ReducePhase', new Error(`摘要生成失败: ${response.status} - ${text}`));
                throw new Error("API_ERROR");
            }

            const data = await response.json();
            const summaryContent: string | undefined = data?.choices?.[0]?.message?.content;

            if (!summaryContent || typeof summaryContent !== "string") {
                 throw new Error("INVALID_CONTENT");
            }
            
            return summaryContent.trim().replace(/^["']|["']$/g, "");
        }, { phase: 'reduce' });
        
        // 重组历史
        const summaryMessage: ChatMessage = {
            role: "assistant",
            content: isEn ? `[Context Summary]: ${cleanedSummary}` : `[前文背景摘要]：${cleanedSummary}`,
        };

        const optimizedHistory = [summaryMessage, ...recentMessages];

        logger.info('HistoryManager', 'SummaryComplete', { 
            original_count: history.length, 
            optimized_count: optimizedHistory.length,
            original_tokens: totalTokens
        });

        return optimizedHistory;

    });
  } catch (error) {
    // 降级：返回原始历史，确保不影响主流程
    logger.error("HistoryManager", "SummarizeFailed", error);
    return history;
  }
}

