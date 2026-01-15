import { encode } from "gpt-tokenizer";
import type { ChatMessage } from "../types/qa";

/**
 * 估算对话历史的 token 数（近似 tiktoken / cl100k 风格）
 * 说明：不同模型的 chat 模板会引入额外 token（role/分隔符等），这里做保守估算：
 * - 按 role + content 拼接后编码
 * - 额外加少量每条消息开销，避免明显低估
 */
export function countTokens(history: ChatMessage[]): number {
  if (!history || history.length === 0) return 0;

  let total = 0;
  for (const m of history) {
    const role = m?.role ?? "user";
    const content = m?.content ?? "";
    const text = `role:${role}\ncontent:${content}\n`;
    total += encode(text).length;
    // 每条消息的结构性开销（保守估计）
    total += 6;
  }
  // 对话结束符等固定开销（保守估计）
  total += 3;
  return total;
}

