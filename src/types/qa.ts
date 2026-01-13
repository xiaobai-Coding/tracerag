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
}
