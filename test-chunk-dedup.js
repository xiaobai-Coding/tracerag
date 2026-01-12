// 测试去重合并功能
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const chars1 = text1.split('');
  const chars2 = text2.split('');

  const lcsLength = longestCommonSubsequence(chars1, chars2);
  const maxLength = Math.max(chars1.length, chars2.length);

  if (maxLength === 0) return 1;
  return lcsLength / maxLength;
}

function longestCommonSubsequence(arr1, arr2) {
  const m = arr1.length;
  const n = arr2.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

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

function removeDuplicateChunks(chunks, threshold = 0.8) {
  if (!chunks || chunks.length <= 1) {
    return chunks;
  }

  const uniqueChunks = [];

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

// 测试数据
const chunks = [
  { id: 'chunk-1', index: 1, text: '埃菲尔铁塔位于巴黎，世界著名地标之一。', startPos: 0, endPos: 25 },
  { id: 'chunk-2', index: 2, text: '埃菲尔铁塔是巴黎的标志性建筑之一。', startPos: 26, endPos: 45 },
  { id: 'chunk-3', index: 3, text: '巴黎是法国的首都，也是世界著名的旅游目的地。', startPos: 46, endPos: 75 },
  { id: 'chunk-4', index: 4, text: '埃菲尔铁塔是巴黎的著名地标，吸引了成千上万的游客。', startPos: 76, endPos: 105 }
];

console.log('=== 文档片段去重测试 ===');
console.log('原始片段:');
chunks.forEach((chunk, i) => {
  console.log(`${i + 1}. ${chunk.text}`);
});

console.log('\n=== 执行去重 ===');
const uniqueChunks = removeDuplicateChunks(chunks, 0.8);

console.log('\n去重结果:');
uniqueChunks.forEach((chunk, i) => {
  console.log(`${i + 1}. ${chunk.text}`);
});
