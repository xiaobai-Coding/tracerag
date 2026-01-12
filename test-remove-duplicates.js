// 测试去重合并功能
import { splitIntoChunksWithOverlap, removeDuplicateChunks } from './src/utils/chunk.ts';

// 测试文本
const testText = `埃菲尔铁塔位于巴黎，世界著名地标之一。埃菲尔铁塔是巴黎的标志性建筑之一。巴黎是法国的首都，也是世界著名的旅游目的地。埃菲尔铁塔是巴黎的著名地标，吸引了成千上万的游客。埃菲尔铁塔建于1889年，是世界上最受欢迎的付费景点之一。埃菲尔铁塔位于巴黎，世界著名地标之一。`;

console.log('=== 文档片段去重测试 ===');
console.log('原始文本:', testText.substring(0, 100) + '...');

try {
  // 1. 切片
  const chunks = splitIntoChunksWithOverlap(testText, 50, 10);
  console.log(`\n切片后片段数量: ${chunks.length}`);
  chunks.forEach((chunk, i) => {
    console.log(`${i + 1}. ${chunk.text}`);
  });

  // 2. 去重（基于文本相似度）
  console.log('\n=== 执行去重（基于Jaccard相似度）===');
  const uniqueChunks = removeDuplicateChunks(chunks, 0.8);
  console.log(`去重后片段数量: ${uniqueChunks.length}`);
  uniqueChunks.forEach((chunk, i) => {
    console.log(`${i + 1}. ${chunk.text}`);
  });

} catch (error) {
  console.error('测试失败:', error);
}
