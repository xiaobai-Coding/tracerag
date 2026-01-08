import type { EvidenceStatus } from '../types/qa';

/**
 * 证据三状态判定函数
 * @param top1 最高相似度分数
 * @param low 低阈值
 * @param high 高阈值
 * @returns 三态判定结果
 */
export function decideEvidenceStatus(top1: number, low: number, high: number): EvidenceStatus {
  if (top1 < low) {
    return 'no_evidence';
  } else if (top1 < high) {
    return 'need_clarify';
  } else {
    return 'has_evidence';
  }
}
