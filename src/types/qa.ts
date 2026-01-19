import type { Chunk } from "../utils/chunk";
export type EvidenceStatus = 'no_evidence' | 'need_clarify' | 'has_evidence';

export interface QAMetrics {
  top1_score: number;
  strategy: 'topk' | 'mmr';
  k: number;
  low: number;
  high: number;
  context_chars: number;     // Context预算字符数
  context_chunks: number;    // Context预算片段数
}

export interface QAResponse {
  status: EvidenceStatus;
  answer: string | null;
  used_chunks: Array<{ chunk_id: string; score: number }>;
  metrics: QAMetrics;
  // 预留：后续 day12 step2 会加 citations
  citations?: string[];
  need_clarify?: boolean;
  clarify_options?: string[];
  // 本轮回答真正使用到的片段明细（用于前端构建 ChatMessage.usedChunks）
  used_chunks_detail?: Chunk[];
  // 哪些片段是继承自上一轮的（ID集合）
  inherited_ids?: string[];
}

// 多轮对话消息类型
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // 该轮回答时实际使用到的证据片段（可选，用于证据继承）
  usedChunks?: Chunk[];
}

// 对话历史：按时间顺序存储最近若干轮 Q&A
export type ChatHistory = ChatMessage[];

