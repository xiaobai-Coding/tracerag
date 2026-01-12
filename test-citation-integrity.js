// 测试引用完整性检查逻辑
console.log('=== 引用完整性检查测试 ===');

// 模拟used_chunks
const used_chunks = [
  { chunk_id: 'chunk-1', score: 0.8 },
  { chunk_id: 'chunk-2', score: 0.7 },
  { chunk_id: 'chunk-3', score: 0.6 }
];

// 模拟citations
const testCases = [
  {
    citations: ['1', '2'], // 有效的数字引用
    expected: true,
    desc: '有效的数字引用'
  },
  {
    citations: ['chunk-1', 'chunk-2'], // 有效的chunk-id引用
    expected: true,
    desc: '有效的chunk-id引用'
  },
  {
    citations: ['1', 'chunk-2'], // 混合格式引用
    expected: true,
    desc: '混合格式有效引用'
  },
  {
    citations: ['1', '4'], // 部分无效引用（4不在used_chunks中）
    expected: false,
    desc: '部分无效引用'
  },
  {
    citations: ['chunk-1', 'chunk-4'], // 部分无效引用
    expected: false,
    desc: '部分无效chunk-id引用'
  },
  {
    citations: ['4', '5'], // 全部无效引用
    expected: false,
    desc: '全部无效引用'
  },
  {
    citations: [], // 空引用
    expected: true,
    desc: '空引用'
  }
];

const usedChunkIds = new Set(used_chunks.map(chunk => chunk.chunk_id));

testCases.forEach((test, index) => {
  // 检查引用完整性逻辑
  const invalidCitations = test.citations.filter((citation) => {
    const numCitation = parseInt(citation);
    if (!isNaN(numCitation)) {
      return !usedChunkIds.has(`chunk-${numCitation}`);
    }
    return !usedChunkIds.has(citation);
  });

  const isValid = invalidCitations.length === 0;
  const success = isValid === test.expected;

  console.log(`测试 ${index + 1}: ${success ? '✅' : '❌'} ${test.desc}`);
  console.log(`  Citations: [${test.citations.join(', ')}]`);
  console.log(`  Used chunks: [${Array.from(usedChunkIds).join(', ')}]`);
  console.log(`  Invalid citations: [${invalidCitations.join(', ')}]`);
  console.log(`  Result: ${isValid ? 'VALID' : 'INVALID'} (期望: ${test.expected ? 'VALID' : 'INVALID'})`);

  if (!success) {
    console.log(`  ❌ 失败!`);
  }
  console.log('');
});

console.log('=== 测试完成 ===');
