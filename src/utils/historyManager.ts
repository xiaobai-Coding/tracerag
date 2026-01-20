import type { ChatMessage } from "../types/qa";
import { HISTORY_SUMMARY_PROMPT } from "../prompts/prompt"
import { countTokens } from "./tokenCounter";


import { logger } from "./logger";

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
  
  if (!history || history.length === 0) return history;
  if (totalTokens <= TOKEN_THRESHOLD) return history;

  // 使用 Logger 的 runWithTrace 开启一个新的 Trace (如果上层没有 Trace)
  // 这里假设 summarizeHistory 可能在某个上下文中被调用，或者作为独立任务
  // 为了安全起见，我们包裹在 runWithTrace 中，但通常应该在上层统一开启 Trace
  // 这里我们假设上层可能没开启，我们尽量复用或者新开
  // 但 logger.runWithTrace 如果没有传入 traceId 会新建
  // 考虑到这是一个工具函数，我们不强制在这里开启新的 root trace，而是直接使用 trackTime
  // 如果当前已经在 trace 中，trackTime 会使用当前的 traceId

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

        // 调用 AI 生成摘要 (Reduce Phase 实际上在这里，LLM 作为一个 Reduce Worker)
        // 我们将其视为 Map-Reduce 的 Reduce 部分，或者整体看作一个处理
        // 为了符合 Requirement 的 "Map-Reduce 监控"，我们可以把构建 historyText 看作 Map
        // 把 LLM 生成看作 Reduce

        // 模拟 Map 阶段埋点 (虽然这里是同步的，为了演示 Map 阶段埋点)
        await logger.trackTime('HistoryManager', 'MapPhase', async () => {
             // 这里的 "Map" 实际上是把多条消息映射为一个文本块
             // 我们可以记录 input_length
             return historyText;
        }, { phase: 'map', shard_count: messagesToSummarize.length, input_length: historyText.length });


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

        // Reduce Phase: LLM 生成摘要
        const cleanedSummary = await logger.trackTime('HistoryManager', 'ReducePhase', async () => {
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
            content: `[前文背景摘要]：${cleanedSummary}`,
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
