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
 * Context预算结果
 */
export interface ContextBudgetResult {
  selectedChunks: Chunk[];  // 选中的片段
  contextText: string;      // 拼接的上下文文本
  totalChars: number;       // 总字符数
  chunkCount: number;       // 片段数量
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

/**
 * 从查询中提取关键词
 * @param query 用户查询
 * @returns 关键词数组
 */
function extractKeywords(query: string): string[] {
  if (!query) return [];

  // 更全面的停用词列表
  const stopwords = new Set([
    // 基础停用词
    '的', '了', '和', '是', '在', '有', '我', '你', '他', '她', '它', '我们', '你们', '他们',
    '这', '那', '一个', '一些', '这些', '那些', '什么', '怎么', '为什么', '怎么样', '如何',
    // 疑问和请求词
    '请', '问', '能', '可以', '告诉', '知道', '说', '讲', '介绍', '解释', '帮', '给',
    '想', '要', '需要', '希望', '应该', '必须', '可能', '也许', '大概', '大约',
    // 语气词和连接词
    '呢', '啊', '哦', '呀', '吧', '吗', '嘛', '啦', '哈', '嘿', '呵',
    // 时间词
    '现在', '今天', '明天', '昨天', '今年', '去年', '明年', '当时', '以后', '以前',
    // 程度词
    '很', '太', '最', '更', '比较', '相对', '稍微', '特别', '尤其',
    // 数字和量词
    '个', '次', '种', '类', '点', '方面', '部分', '一些', '很多', '几个'
  ]);

  // 分割词语，支持中英文，更精确的分割
  const words = query
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ') // 将所有非字母数字字符替换为空格
    .split(/\s+/) // 按空格分割
    .filter(word => word.length > 0);

  // 过滤停用词和纯数字，保留基本的关键词
  const filteredWords = words
    .filter(word => !stopwords.has(word)) // 过滤停用词
    .filter(word => !/^\d+$/.test(word)) // 过滤纯数字
    .filter(word => word.length >= 2) // 至少2个字符
    .sort((a, b) => {
      // 优先级排序：1. 长度 2. 是否包含中文 3. 字母顺序
      const lenDiff = b.length - a.length;
      if (lenDiff !== 0) return lenDiff;

      const aHasChinese = /[\u4e00-\u9fa5]/.test(a);
      const bHasChinese = /[\u4e00-\u9fa5]/.test(b);
      if (aHasChinese !== bHasChinese) return aHasChinese ? -1 : 1;

      return a.localeCompare(b);
    });

  // 限制关键词数量，优先选择最重要的
  const result = filteredWords.slice(0, 3); // 最多3个关键词，减少干扰

  console.log(`[Keywords] 原始查询: "${query}"`);
  console.log(`[Keywords] 提取结果: [${result.join(', ')}]`);

  return result;
}

/**
 * 计算关键词匹配度
 * @param text 文本内容
 * @param keywords 关键词数组
 * @returns 匹配度分数 (0-1)
 */
function calculateKeywordMatch(text: string, keywords: string[]): number {
  if (!text || !keywords.length) return 0;

  const lowerText = text.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  return matchCount / keywords.length;
}

/**
 * 评估已选片段对问题的信息覆盖度
 * @param selectedChunks 已选中的片段
 * @param keywords 关键词列表
 * @returns 覆盖度分数 (0-1)
 */
function evaluateCoverage(selectedChunks: Chunk[], keywords: string[]): number {
  if (!selectedChunks.length || !keywords.length) return 0;

  // 1. 关键词覆盖度：问题关键词在片段中的覆盖率
  const allText = selectedChunks.map(chunk => chunk.text).join(' ').toLowerCase();
  let coveredKeywords = 0;

  for (const keyword of keywords) {
    if (allText.includes(keyword.toLowerCase())) {
      coveredKeywords++;
    }
  }

  const keywordCoverage = coveredKeywords / keywords.length;

  // 2. 文本长度因子：基于关键词数量动态调整期望长度
  const totalChars = allText.length;
  const expectedChars = Math.max(keywords.length * 30, 100); // 进一步降低，每个关键词30字符，最少100字符
  const lengthFactor = Math.min(totalChars / expectedChars, 1.5) / 1.5; // 标准化到0-1，允许稍微超出

  // 3. 答案完整性评估：特别重视单个片段的情况
  let completenessFactor = 0.9; // 提高基础分数

  if (selectedChunks.length === 1) {
    // 单个片段的情况特别重要
    const singleChunk = selectedChunks[0];
    if (singleChunk) {
      const singleChunkText = singleChunk.text.toLowerCase();
      let singleChunkCoverage = 0;

      for (const keyword of keywords) {
        if (singleChunkText.includes(keyword.toLowerCase())) {
          singleChunkCoverage++;
        }
      }

      const singleKeywordCoverage = singleChunkCoverage / keywords.length;

      // 如果单个片段包含了所有关键词，给很高分数
    if (singleKeywordCoverage >= 0.9) {
      completenessFactor = 1.0;
    } else if (singleKeywordCoverage >= 0.7) {
      completenessFactor = 0.95;
    } else {
      completenessFactor = 0.8;
    }

    // 如果字符数足够且覆盖度高，进一步提高分数
    if (totalChars >= 100 && singleKeywordCoverage >= 0.8) {
      completenessFactor = Math.min(completenessFactor + 0.1, 1.0);
    }
    }
  } else {
    // 多个片段的情况
    if (keywordCoverage >= 0.9) {
      completenessFactor = 1.0;
    } else if (keywordCoverage >= 0.7) {
      completenessFactor = 0.9;
    } else {
      completenessFactor = 0.7;
    }
  }

  // 4. 冗余控制因子：避免过度添加
  let redundancyFactor = 1.0;
  if (selectedChunks.length >= 3) {
    // 检查最新片段是否有独特贡献
    const recentChunk = selectedChunks[selectedChunks.length - 1];
    if (recentChunk) {
      const recentText = recentChunk.text.toLowerCase();
      let uniqueContributions = 0;

      for (const keyword of keywords) {
        if (recentText.includes(keyword.toLowerCase())) {
          // 检查之前的所有片段是否已经包含这个关键词
          const previousText = selectedChunks.slice(0, -1).map(c => c.text).join(' ').toLowerCase();
          if (!previousText.includes(keyword.toLowerCase())) {
            uniqueContributions++;
          }
        }
      }

      // 如果新片段没有带来独特信息，降低分数
      if (uniqueContributions === 0) {
        redundancyFactor = 0.6;
      } else if (uniqueContributions <= keywords.length * 0.3) {
        redundancyFactor = 0.8;
      }
    }
  }

  // 综合评分：关键词覆盖度优先
  let coverage;
  if (selectedChunks.length === 1) {
    // 单个片段：关键词覆盖度最重要
    coverage = keywordCoverage * 0.6 + completenessFactor * 0.3 + lengthFactor * 0.1;
  } else {
    // 多个片段：关键词覆盖度仍然很重要
    coverage = keywordCoverage * 0.5 + completenessFactor * 0.25 + lengthFactor * 0.15 + redundancyFactor * 0.1;
  }

  // 调试信息
  if (selectedChunks.length <= 3) {
    console.log(`[Coverage] 关键词: [${keywords.join(', ')}] (${keywords.length}个)`);
    console.log(`[Coverage] 覆盖: ${coveredKeywords}/${keywords.length} (${(keywordCoverage * 100).toFixed(1)}%)`);
    console.log(`[Coverage] 长度: ${totalChars}/${expectedChars} (${(lengthFactor * 100).toFixed(1)}%)`);
    console.log(`[Coverage] 完整性: ${(completenessFactor * 100).toFixed(1)}%`);
    if (selectedChunks.length >= 3) {
      console.log(`[Coverage] 冗余控制: ${(redundancyFactor * 100).toFixed(1)}%`);
    }
    console.log(`[Coverage] 综合覆盖度: ${(coverage * 100).toFixed(1)}%`);
  }

  return Math.min(coverage, 1);
}

/**
 * 应用Context预算：混合策略控制上下文长度（动态选择）
 * @param query 用户查询
 * @param retrievedChunks 检索到的片段（已按相关性排序）
 * @param maxLength 最大字符数限制
 * @param maxChunks 最大片段数限制（可选，建议值）
 * @returns Context预算结果
 */
export function applyContextBudget(
  query: string,
  retrievedChunks: Chunk[],
  maxLength: number,
  maxChunks?: number
): ContextBudgetResult {
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      selectedChunks: [],
      contextText: '',
      totalChars: 0,
      chunkCount: 0
    };
  }

  // 1. 提取关键词
  const keywords = extractKeywords(query);
  console.log(`[Context Budget] 查询: "${query}"`);
  console.log(`[Context Budget] 提取关键词: [${keywords.join(', ')}] (${keywords.length}个)`);

  // 紧急检查：如果没有关键词，直接返回第一个片段
  if (keywords.length === 0) {
    console.log(`[Context Budget] ⚠️ 没有提取到关键词，使用默认策略：返回前3个片段`);
    const defaultChunks = retrievedChunks.slice(0, Math.min(3, retrievedChunks.length));
    const contextText = defaultChunks.map(chunk => chunk.text).join('\n\n');
    return {
      selectedChunks: defaultChunks,
      contextText,
      totalChars: contextText.length,
      chunkCount: defaultChunks.length
    };
  }

  // 2. 计算每个chunk的关键词匹配度和综合评分
  console.log(`[Context Budget] 开始计算 ${retrievedChunks.length} 个片段的评分...`);
  const scoredChunks = retrievedChunks.map((chunk, index) => {
    const keywordScore = calculateKeywordMatch(chunk.text, keywords);
    // 结合原始排序位置（越前面的相关性越高）和关键词匹配度
    const positionScore = 1 - (index / retrievedChunks.length); // 位置权重
    const combinedScore = positionScore * 0.7 + keywordScore * 0.3; // 加权组合

    // 调试：显示每个片段的评分详情
    console.log(`[Context Budget] 片段 ${index + 1} 评分: 关键词=${(keywordScore * 100).toFixed(1)}%, 位置=${(positionScore * 100).toFixed(1)}%, 综合=${(combinedScore * 100).toFixed(1)}%`);

    return {
      chunk,
      keywordScore,
      combinedScore
    };
  });

  // 3. 按综合评分重新排序
  scoredChunks.sort((a, b) => b.combinedScore - a.combinedScore);

  // 4. 动态选择片段：基于信息覆盖度（更严格的策略）
  const selectedChunks: Chunk[] = [];
  let totalChars = 0;
  const effectiveMaxChunks = maxChunks || retrievedChunks.length;

  for (const scoredChunk of scoredChunks) {
    // 检查硬性限制
    if (selectedChunks.length >= effectiveMaxChunks) {
      console.log(`[Context Budget] 达到最大片段数限制: ${effectiveMaxChunks}`);
      break;
    }

    // 预估添加后总字符数
    const chunkLength = scoredChunk.chunk.text.length;
    const projectedTotalChars = totalChars + chunkLength;

    // 如果超出字符数限制，停止添加
    if (projectedTotalChars > maxLength && selectedChunks.length > 0) {
      console.log(`[Context Budget] 字符数将超出限制，停止添加`);
      break;
    }

    // 添加片段
    selectedChunks.push(scoredChunk.chunk);
    totalChars = projectedTotalChars;

    // 评估当前覆盖度
    const currentCoverage = evaluateCoverage(selectedChunks, keywords);
    console.log(`[Context Budget] 当前片段数: ${selectedChunks.length}, 覆盖度: ${(currentCoverage * 100).toFixed(1)}%`);

    // 调试：显示当前片段内容摘要
    const chunkSummary = selectedChunks.map((chunk, idx) =>
      `${idx + 1}: "${chunk.text.substring(0, 50)}..." (${chunk.text.length}chars)`
    ).join('\n');
    console.log(`[Context Budget] 当前片段内容:\n${chunkSummary}`);

    // 关键改进：更严格的停止条件
    // 1. 如果第一个片段覆盖度超过90%，直接停止（问题答案很可能就在这里）
    if (selectedChunks.length === 1 && currentCoverage >= 0.90) {
      console.log(`[Context Budget] ✅ 第一个片段已完全覆盖问题 (${(currentCoverage * 100).toFixed(1)}%)，无需更多片段`);
      break;
    }

    // 2. 如果第一个片段覆盖度超过80%且字符数足够，停止
    if (selectedChunks.length === 1 && currentCoverage >= 0.80 && totalChars >= 200) {
      console.log(`[Context Budget] ✅ 第一个片段覆盖度较高 (${(currentCoverage * 100).toFixed(1)}%)且信息充足，停止添加`);
      break;
    }

    // 3. 如果第一个片段覆盖度超过60%且字符数足够，停止（进一步降低阈值）
    if (selectedChunks.length === 1 && currentCoverage >= 0.60 && totalChars >= 150) {
      console.log(`[Context Budget] ✅ 第一个片段覆盖度及格 (${(currentCoverage * 100).toFixed(1)}%)且内容充足，停止添加`);
      break;
    }

    // 4. 安全检查：如果覆盖度已经不错，停止
    if (selectedChunks.length === 1 && currentCoverage >= 0.50 && totalChars >= 200) {
      console.log(`[Context Budget] ✅ 第一个片段有一定相关性 (${(currentCoverage * 100).toFixed(1)}%)，避免过度添加`);
      break;
    }

    // 3. 对于多个片段，只有在覆盖度很高且有显著信息增益时才继续
    if (selectedChunks.length >= 2) {
      // 如果覆盖度已经很高（85%以上），考虑停止
      if (currentCoverage >= 0.85) {
        console.log(`[Context Budget] 多片段已充分覆盖问题 (${(currentCoverage * 100).toFixed(1)}%)，停止添加`);
        break;
      }

      // 如果新增的片段没有带来显著的覆盖度提升，停止
      // 这里可以计算边际收益，如果新增片段只带来<5%的覆盖度提升，可能不值得
    }

    // 4. 安全检查：避免过度添加（最多不超过合理数量）
    if (selectedChunks.length >= 3 && currentCoverage < 0.8) {
      console.log(`[Context Budget] 已添加较多片段但覆盖度仍不足，强制停止以避免过度检索`);
      break;
    }
  }

  // 5. 拼接上下文文本
  let contextText = selectedChunks.map(chunk => chunk.text).join('\n\n');

  // 6. 处理字符数超出：如果超出最大字符数，则裁剪文本
  let finalTotalChars = totalChars;
  if (contextText.length > maxLength) {
    contextText = contextText.substring(0, maxLength);
    finalTotalChars = maxLength;
    console.log(`[Context Budget] 文本超出限制，已裁剪至 ${maxLength} 字符`);
  }

  const result: ContextBudgetResult = {
    selectedChunks,
    contextText,
    totalChars: finalTotalChars,
    chunkCount: selectedChunks.length
  };

  console.log(`[Context Budget] 最终结果: ${selectedChunks.length}个片段, ${finalTotalChars}字符`);
  console.log(`[Context Budget] 选中的片段ID: ${selectedChunks.map(c => c.id).join(', ')}`);

  return result;
}