// 测试证据三态判定逻辑
const { decideEvidenceStatus } = require('./src/utils/evidenceGate.ts');

console.log('=== 证据三态判定测试 ===');

// 测试用例
const testCases = [
  { top1: 0.2, low: 0.35, high: 0.65, expected: 'no_evidence', desc: '明显低于阈值' },
  { top1: 0.3, low: 0.35, high: 0.65, expected: 'no_evidence', desc: '刚好低于 low 阈值' },
  { top1: 0.4, low: 0.35, high: 0.65, expected: 'need_clarify', desc: '在 low-high 区间内' },
  { top1: 0.55, low: 0.35, high: 0.65, expected: 'need_clarify', desc: '在 low-high 区间内偏高' },
  { top1: 0.65, low: 0.35, high: 0.65, expected: 'has_evidence', desc: '刚好等于 high 阈值' },
  { top1: 0.7, low: 0.35, high: 0.65, expected: 'has_evidence', desc: '明显高于阈值' },
  { top1: 0.9, low: 0.35, high: 0.65, expected: 'has_evidence', desc: '最高相似度' },
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = decideEvidenceStatus(test.top1, test.low, test.high);
  const success = result === test.expected;

  console.log(`测试 ${index + 1}: ${success ? '✅' : '❌'} ${test.desc}`);
  console.log(`  输入: top1=${test.top1}, low=${test.low}, high=${test.high}`);
  console.log(`  期望: ${test.expected}, 实际: ${result}`);

  if (success) {
    passed++;
  } else {
    failed++;
    console.log(`  ❌ 失败!`);
  }
  console.log('');
});

console.log(`=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);

if (failed === 0) {
  console.log('🎉 所有测试通过！证据三态判定逻辑正确。');
} else {
  console.log('❌ 部分测试失败，请检查逻辑。');
}
