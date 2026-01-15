import type { ChatHistory } from "../types/qa";

/**
 * 统计对话轮次
 * @param history 对话历史数组
 * @returns 完整的对话轮次数（每轮 = 1条用户消息 + 1条助手回复）
 * 
 * @example
 * getChatRoundCount([]) // 0
 * getChatRoundCount([{role: "user", content: "你好"}]) // 0 (只有用户消息，助手还没回复)
 * getChatRoundCount([{role: "user", content: "你好"}, {role: "assistant", content: "你好！"}]) // 1
 * getChatRoundCount([user, assistant, user, assistant]) // 2
 */
export function getChatRoundCount(history: ChatHistory): number {
  if (!history || history.length === 0) {
    return 0;
  }
  // 每轮完整对话 = 2条消息（user + assistant）
  return Math.floor(history.length / 2);
}

/**
 * 获取当前对话状态描述
 * @param history 对话历史数组
 * @returns 描述字符串，如 "第1轮"、"第2轮进行中"
 */
export function getChatRoundStatus(history: ChatHistory): string {
  if (!history || history.length === 0) {
    return "第0轮（新对话）";
  }
  
  const roundCount = getChatRoundCount(history);
  const lastMessage:any = history[history.length - 1];
  
  // 如果最后一条是用户消息，说明当前轮次还在进行中（助手还没回复）
  if (lastMessage.role === "user") {
    return `第${roundCount + 1}轮进行中`;
  }
  
  // 如果最后一条是助手消息，说明当前轮次已完成
  return `第${roundCount}轮`;
}

/**
 * 获取对话统计信息
 * @param history 对话历史数组
 * @returns 包含轮次、消息数等统计信息的对象
 */
export function getChatStatistics(history: ChatHistory): {
  roundCount: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  status: string;
  isCompleteRound: boolean; // 当前是否为完整轮次（最后一条是助手消息）
} {
  if (!history || history.length === 0) {
    return {
      roundCount: 0,
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      status: "第0轮（新对话）",
      isCompleteRound: false,
    };
  }
  
  const roundCount = getChatRoundCount(history);
  const userMessages = history.filter((m) => m.role === "user").length;
  const assistantMessages = history.filter((m) => m.role === "assistant").length;
  const lastMessage:any = history[history.length - 1];
  const isCompleteRound = lastMessage.role === "assistant";
  
  return {
    roundCount,
    totalMessages: history.length,
    userMessages,
    assistantMessages,
    status: getChatRoundStatus(history),
    isCompleteRound,
  };
}
