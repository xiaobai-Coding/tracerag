import { cosineSimilarity } from "./similarity";

/**
 * MMR 最大边际相关性检索
 * @param queryEmbedding 查询向量
 * @param docEmbeddings 文档片段向量数组
 * @param topK 选取数量
 * @param lambda 相关性 - 多样性权重（0.7 为行业常用值）
 */
export function mmrSelect(
  queryEmbedding: number[],
  docEmbeddings: number[][],
  topK = 5,
  lambda = 0.7
): { index: number; mmrScore: number; relevance: number }[] {
  const selected: { index: number; mmrScore: number; relevance: number }[] = [];
  const candidates = [...docEmbeddings.keys()];

  while (selected.length < topK && candidates.length > 0) {
    let bestIndex = -1;
    let bestMmr = -Infinity;
    let bestRel = -Infinity;

    for (const i of candidates) {
      const rel = cosineSimilarity(queryEmbedding, docEmbeddings[i]);

      let div = 0;
      if (selected.length > 0) {
        const sims = selected.map(j =>
          cosineSimilarity(docEmbeddings[i], docEmbeddings[j.index])
        );
        div = Math.max(...sims);
      }

      const mmr = lambda * rel - (1 - lambda) * div;

      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIndex = i;
        bestRel = rel;
      }
    }

    selected.push({ index: bestIndex, mmrScore: bestMmr, relevance: bestRel });
    candidates.splice(candidates.indexOf(bestIndex), 1);
  }

  return selected;
}