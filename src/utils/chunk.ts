/**
 * 文档切片对象
 */
export interface Chunk {
  id: string;         // 唯一标识符，如 "chunk-1", "chunk-2"
  index: number;      // 显示用的下标，如 1, 2, 3...
  text: string;       // 切片内容
  startPos: number;   // 在原文档中的起始位置
  endPos: number;      // 在原文档中的结束位置
}

/**
 * 计算两个文本的相似度（基于字符重叠度）
 * @param text1 第一个文本
 * @param text2 第二个文本
 * @returns 相似度 (0-1之间)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  // 对于中文文本，使用字符级别的相似度计算
  const chars1 = text1.split('');
  const chars2 = text2.split('');

  // 计算最长公共子序列长度
  const lcsLength = longestCommonSubsequence(chars1, chars2);

  // 使用LCS长度相对于较长文本长度的比例作为相似度
  const maxLength = Math.max(chars1.length, chars2.length);
  if (maxLength === 0) return 1;

  return lcsLength / maxLength;
}

/**
 * 计算最长公共子序列长度
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): number {
  const m = arr1.length;
  const n = arr2.length;

  // 创建DP表
  const dp: any = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * 去除重复的文档片段（基于文本相似度）
 * @param chunks 待去重的片段数组
 * @param threshold 相似度阈值，默认为0.8（0.8表示80%以上的词重叠）
 * @returns 去重后的唯一片段数组
 */
export function removeDuplicateChunks(chunks: Chunk[], threshold: number = 0.8): Chunk[] {
  if (!chunks || chunks.length <= 1) {
    return chunks;
  }

  const uniqueChunks: Chunk[] = [];

  for (const chunk of chunks) {
    let isDuplicate = false;

    // 检查当前片段是否与已选片段重复
    for (const selectedChunk of uniqueChunks) {
      const similarity = calculateTextSimilarity(chunk.text, selectedChunk.text);

      if (similarity >= threshold) {
        isDuplicate = true;
        console.log(`发现重复片段 (相似度: ${(similarity * 100).toFixed(1)}%):`);
        console.log(`  原文: "${chunk.text.substring(0, 50)}..."`);
        console.log(`  重复: "${selectedChunk.text.substring(0, 50)}..."`);
        break;
      }
    }

    if (!isDuplicate) {
      uniqueChunks.push(chunk);
    }
  }

  console.log(`去重完成: ${chunks.length} -> ${uniqueChunks.length} 个片段`);
  return uniqueChunks;
}

/**
 * Overlap 重叠切片
 * @param text 输入文本
 * @param chunkSize 每个切片最大长度
 * @param overlapSize 上下重叠长度
 */
export function splitIntoChunksWithOverlap(
    text: string,
    chunkSize: number = 400,
    overlapSize: number = 80
  ): Chunk[] {
    if (!text || chunkSize <= 0) return [];

    const result: Chunk[] = [];
    const cleaned = text.trim().replace(/\s+/g, " "); // 简单清洗

    let start = 0;
    let chunkIndex = 1;

    while (start < cleaned.length) {
      const end = Math.min(start + chunkSize, cleaned.length);
      const chunkText = cleaned.slice(start, end);

      if (chunkText.length >= 20) {
        result.push({
          id: `chunk-${chunkIndex}`,
          index: chunkIndex,
          text: chunkText,
          startPos: start,
          endPos: end
        });
        chunkIndex++;
      }

      start += chunkSize - overlapSize; // 往前走但保留部分重叠
    }

    return result;
  }
