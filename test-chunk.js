// 测试文档切片功能
import { splitIntoChunksWithOverlap } from './src/utils/chunk.ts';

console.log('=== 文档切片功能测试 ===');

// 测试文本
const testText = `这是一个测试文档，用于验证文档切片功能是否正常工作。
文档包含多个段落，每个段落都有不同的内容。
第一段落介绍了测试的目的。
第二段落说明了测试的方法。
第三段落描述了预期的结果。
最后一段落总结了整个测试过程。`;

console.log('原始文本长度:', testText.length);
console.log('原始文本内容:');
console.log(testText);
console.log('');

try {
  // 调用切片函数
  const chunks = splitIntoChunksWithOverlap(testText, 100, 20);

  console.log(`切片结果: 共 ${chunks.length} 个片段`);
  console.log('');

  chunks.forEach((chunk, index) => {
    console.log(`片段 ${index + 1}:`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Index: ${chunk.index}`);
    console.log(`  文本长度: ${chunk.text.length}`);
    console.log(`  位置: ${chunk.startPos}-${chunk.endPos}`);
    console.log(`  内容: ${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? '...' : ''}`);
    console.log('');
  });

  // 验证ID和Index是否正确
  console.log('=== 验证结果 ===');
  let idValid = true;
  let indexValid = true;

  chunks.forEach((chunk, i) => {
    if (chunk.id !== `chunk-${i + 1}`) {
      console.log(`❌ ID不正确: 期望 chunk-${i + 1}, 实际 ${chunk.id}`);
      idValid = false;
    }
    if (chunk.index !== i + 1) {
      console.log(`❌ Index不正确: 期望 ${i + 1}, 实际 ${chunk.index}`);
      indexValid = false;
    }
  });

  if (idValid && indexValid) {
    console.log('✅ 所有ID和Index验证通过！');
  } else {
    console.log('❌ ID或Index验证失败！');
  }

} catch (error) {
  console.error('❌ 切片功能测试失败:', error.message);
}
