# TraceRAG

一个完整的 RAG（Retrieval-Augmented Generation）文档问答系统，基于 Vue 3 + TypeScript + Vercel Serverless Functions 构建。支持 PDF/DOCX 文档解析、智能分块、向量化检索和 AI 驱动的问答功能，实现基于文档内容的精准问答。

## 📋 项目简介

本项目是一个端到端的 RAG 问答系统，集成了文档解析、文本分块、向量化、语义检索和生成式问答的完整流程。用户上传文档后，系统会自动提取文本、生成向量、建立索引，然后通过语义检索找到最相关的文档片段，最终由 AI 生成基于文档内容的准确回答。

### 核心能力

- 📄 **多格式支持**：PDF (.pdf) 和 DOCX (.docx) 文件解析
- ✂️ **智能分块**：自动将文档切分为带唯一标识的重叠文本片段
- 🔢 **向量化**：使用阿里 DashScope Embedding 生成文本向量，支持向量缓存
- 🔍 **语义检索**：基于余弦相似度的向量检索，支持 MMR 算法优化多样性
- 🤖 **AI 问答**：基于 DeepSeek API 的智能问答，完全基于文档内容
- 🛡️ **引用完整性**：严格验证 AI 引用是否在提供的文档片段中，确保回答可靠性
- 🔗 **引用跳转**：回答中的引用可点击跳转到原文片段并高亮显示
- 📊 **AI 摘要**：自动生成文档摘要和关键点，支持引用标记
- 🎨 **统一视觉体系**：紫蓝色主题，符合 RAG 项目风格的现代化界面设计

## ✨ 功能特性

### 文档解析
- ✅ 支持多页 PDF 文档，自动添加页码标记
- ✅ 支持复杂格式的 Word 文档，检测分页符
- ✅ 保留文本格式和段落结构
- ✅ 使用 `pdfjs-dist` 和 `mammoth` 库进行解析

### 文本分块
- ✅ 智能分块：按段落切分，保留重叠区域（默认 400 字符/块，80 字符重叠）
- ✅ 自动过滤：过滤少于 20 字符的段落
- ✅ 递归切分：超过 400 字符的段落自动切半
- ✅ 双重标识：每个片段有唯一 ID (chunk-1) 和显示下标 (1, 2, 3...)
- ✅ 去重合并：基于余弦相似度自动去除重复片段（阈值 0.8）
- ✅ Chunk 对象：包含 id、index、text、startPos、endPos 等完整信息

### 向量化与检索
- ✅ **DashScope Embedding**：使用阿里云 `text-embedding-v4` 模型生成向量
- ✅ **向量缓存**：自动缓存已生成的向量，避免重复计算
- ✅ **余弦相似度**：计算查询向量与文档向量的相似度
- ✅ **MMR 算法**：最大边际相关性检索，平衡相关性和多样性
- ✅ **Top-K 检索**：直接按相似度排序的简单检索
- ✅ **智能策略切换**：根据问题长度自动选择 TopK 或 MMR 策略
- ✅ **引用完整性检查**：验证 AI 引用是否完全基于提供的片段，增强回答可靠性

### AI 问答
- ✅ **语义检索**：根据用户问题检索最相关的文档片段
- ✅ **证据三态判定**：基于相似度阈值智能判断回答策略（有证据/需要澄清/无证据）
- ✅ **上下文构建**：将检索到的片段作为上下文输入 AI
- ✅ **引用标记**：回答中包含 `[[1]]`、`[[chunk-1]]` 等多种引用格式
- ✅ **引用完整性**：严格验证 AI 引用是否在提供的片段中，确保回答可靠性
- ✅ **流式输出**：实时显示 AI 生成进度
- ✅ **严格约束**：只基于文档内容回答，不编造信息

### AI 摘要
- ✅ 自动生成文档摘要（最多 100 字）
- ✅ 提取 3~5 条关键点
- ✅ 支持引用标记：摘要和关键点中包含 `[[#编号]]` 格式的引用
- ✅ 流式输出：实时显示 AI 生成进度

### 引用跳转
- ✅ **多格式支持**：支持数字 `[[1,4]]` 和 chunk-ID `[[chunk-1,chunk-4]]` 格式
- ✅ **智能跳转**：点击引用自动滚动到最小编号的片段位置
- ✅ **多片段高亮**：同时高亮所有引用的片段
- ✅ **Flash 动画**：跳转时显示闪烁动画，突出定位位置
- ✅ **自动取消**：3 秒后自动取消高亮
- ✅ **完整性验证**：确保所有引用都指向有效的文档片段

### 用户体验
- 🎯 **拖拽上传**：支持拖拽文件到上传区域
- ⌨️ **键盘快捷键**：Enter 发送，Shift+Enter 换行
- 🔄 **检索策略选择**：标题栏按钮+下拉菜单，支持自动/TopK/MMR三种检索策略，带彩色指示器
  - **自动策略**：问题长度<50字使用TopK，否则使用MMR
  - **证据一致性**：两种策略都基于原始相似度进行证据三态判定
- 📊 **状态反馈**：实时显示加载状态和错误信息
- 📈 **统计信息**：显示字符数量、片段数量、引用数量
- 🎨 **三栏布局**：AI 摘要、文档内容、文档问答三个卡片
- 🌈 **统一配色**：紫蓝色视觉体系，渐变背景和柔和阴影
- 📱 **响应式设计**：适配移动端和桌面端

## 🛠️ 技术栈

- **前端框架**：Vue 3 (Composition API + `<script setup>`)
- **类型系统**：TypeScript
- **构建工具**：Vite
- **部署平台**：Vercel (Serverless Functions + KV 存储)
- **PDF 解析**：`pdfjs-dist` (v3.11.174)
- **DOCX 解析**：`mammoth` (v1.11.0)
- **向量化服务**：阿里云 DashScope Embedding (`text-embedding-v4`)
- **AI 服务**：DeepSeek API (流式调用)
- **检索算法**：余弦相似度 + MMR（最大边际相关性）
- **状态管理**：Vue 3 Composition API

## 📁 项目结构

```
tracerag/
├── api/                          # Vercel Serverless Functions
│   ├── _utils/
│   │   └── scanInjectionRisk.ts  # 安全扫描工具
│   ├── ai.ts                     # AI 问答 API 接口
│   └── embedding.ts              # 向量化 API 接口
├── src/
│   ├── App.vue                   # 主应用组件（包含文档解析、摘要、问答）
│   ├── main.ts                   # 应用入口
│   ├── style.css                 # 全局样式
│   ├── env.d.ts                  # Vue 类型声明
│   ├── components/
│   │   ├── FileUploader.vue      # 文件上传组件
│   │   ├── TextViewer.vue        # 文本查看器组件（支持片段高亮和滚动）
│   │   └── QASection.vue         # 文档问答组件（输入、回答、引用）
│   ├── services/
│   │   ├── aiService.ts          # AI 服务（DeepSeek API 流式调用）
│   │   ├── qaService.ts          # RAG QA 服务（向量化、检索、问答）
│   │   └── openaiClient.ts       # OpenAI 兼容客户端
│   ├── prompts/
│   │   └── prompt.ts             # AI 提示词配置
│   ├── styles/
│   │   └── tokens.css            # 设计令牌样式
│   ├── types/
│   │   └── qa.ts                 # TypeScript 类型定义
│   └── utils/
│       ├── chunk.ts              # 文本分块工具（支持重叠）
│       ├── docxParser.ts         # DOCX 解析工具
│       ├── embedding.ts          # 向量化工具（DashScope Embedding）
│       ├── evidenceGate.ts       # 证据门控机制
│       ├── mmr.ts                # MMR 检索算法
│       ├── pdfParser.ts          # PDF 解析工具
│       ├── scanInjectionRisk.ts  # 注入风险扫描
│       ├── similarity.ts         # 相似度计算（余弦相似度）
│       └── utils.ts              # 通用工具函数
├── test-evidence-gate.js         # 证据门控测试
├── test-chunk.js                 # 文档切片测试
├── test-citation-integrity.js    # 引用完整性测试
├── package.json
├── tsconfig*.json
├── vite.config.ts
└── vercel.json                   # Vercel 部署配置
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

#### 本地开发环境变量

在项目根目录创建 `.env.local` 文件，配置 API 密钥：

```env
# DeepSeek API（用于问答和摘要）
VITE_AI_API_KEY=your_deepseek_api_key
VITE_AI_API_BASE_URL=https://api.deepseek.com
```

#### Vercel 环境变量

在 Vercel 项目设置中配置以下环境变量：

```env
# 阿里云 DashScope Embedding API（服务端使用）
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4

# DeepSeek API（服务端使用）
AI_API_KEY=your_deepseek_api_key
AI_API_BASE_URL=https://api.deepseek.com
```

**注意**：向量化和 AI 请求已 serverless 化，敏感 API 密钥存储在服务端环境变量中。

### 本地开发设置

本项目使用 Vercel Serverless Functions 处理 embedding 和 AI 请求。推荐使用 Vercel Dev 进行全栈开发：

#### 安装依赖

```bash
npm install
```

#### 安装 Vercel CLI

```bash
npm install -g vercel
```

#### 启动全栈开发服务器

```bash
# 启动全栈开发服务器 (API on :3000, 前端 on :5173)
vercel dev --port 3000
```

### 访问应用

启动后访问 `http://localhost:5173` 查看应用。

**注意**：Vercel Dev 会自动启动前端和后端服务，确保 embedding 和 AI 功能正常工作。

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

### 部署到 Vercel

#### 方式一：Vercel CLI 部署

```bash
# 登录 Vercel
vercel login

# 部署项目
vercel --prod
```

#### 方式二：GitHub 集成自动部署

1. 将代码推送到 GitHub 仓库
2. 在 Vercel 控制台导入项目
3. 配置环境变量
4. 自动部署触发

### 环境变量配置

在 Vercel 项目设置的 "Environment Variables" 中添加：

- `DASHSCOPE_API_KEY`: 阿里云 DashScope API 密钥
- `AI_API_KEY`: DeepSeek API 密钥
- `AI_API_BASE_URL`: https://api.deepseek.com

## 📖 使用说明

### 使用流程

1. **上传文档**：
   - 点击上传区域选择文件
   - 或直接拖拽文件到上传区域
   - 支持 PDF (.pdf) 和 DOCX (.docx) 格式

2. **自动处理**：
   - 文档上传后自动提取文本
   - 自动进行文本分块（带重叠）
   - 自动调用 AI 生成摘要和关键点

3. **查看结果**：
   - **左侧卡片（AI 摘要）**：显示 AI 生成的摘要和关键点，包含可点击的引用标记
   - **中间卡片（文档内容）**：显示提取的文档内容，按片段编号组织，支持高亮显示
   - **右侧卡片（文档问答）**：输入问题，获取基于文档的 AI 回答

4. **文档问答**：
   - 在问答输入框中输入问题
   - 按 `Enter` 发送，`Shift+Enter` 换行
   - 系统自动进行向量检索，找到最相关的文档片段
   - AI 基于检索到的片段生成回答，包含引用标记

5. **引用跳转**：
   - 点击摘要或回答中的 `[[1]]`、`[[1,3]]` 等引用标记
   - 自动滚动到文档内容卡片中对应的片段位置
   - 目标片段会高亮显示（Flash 动画 + 3 秒高亮）

## 🔧 核心实现

### RAG QA 流程

```typescript
// src/services/qaService.ts
export async function answerQuestion(question: string, chunks: Chunk[]) {
  // 1. 向量化用户问题
  const queryVector = await embedQuery(question);

  // 2. 向量化文档片段（带缓存）
  const chunkVectors = await embedChunks(chunks);

  // 3. MMR 检索最相关的 Top-K 片段
  const topResults = mmrSelect(queryVector, chunkVectors, 3);

  // 4. 构建提示词，包含检索到的片段
  const userChunks = topResults
    .map((item) => `#${chunks[item.index].index}: ${chunks[item.index].text}`)
    .join("\n----\n");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `用户问题：${question}\n\n相关文档片段：\n${userChunks}` }
  ];

  // 5. 调用 AI 生成回答
  const res = await streamDeepSeekAPI(messages, false);

  // 6. 解析 JSON 并验证引用完整性
  const parsed = JSON.parse(res);
  const citations = parsed.sources || [];

  // 引用完整性检查：确保所有citations都在used_chunks中
  const usedChunkIds = new Set(topResults.map(r => chunks[r.index].id));
  const invalidCitations = citations.filter((citation: string) => {
    const numCitation = parseInt(citation);
    return numCitation ?
      !usedChunkIds.has(`chunk-${numCitation}`) :
      !usedChunkIds.has(citation);
  });

  // 如果有无效引用，返回no_evidence
  if (invalidCitations.length > 0) {
    return { status: 'no_evidence', answer: null, used_chunks: [], metrics };
  }

  return { answer: parsed.answer, sources: citations };
}
```

### 向量化（DashScope Embedding）

```typescript
// api/embedding.ts - Serverless Function
import { embed } from 'ai';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { input } = await req.json();

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-v4',
        input
      })
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Embedding failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### 智能检索策略切换

```typescript
// src/utils/similarity.ts - 核心检索逻辑
export function selectRetrievalChunks(
  query: string,
  queryVector: number[],
  chunks: Chunk[],
  chunkVectors: number[][],
  topK: number = 3,
  strategy: "auto" | "topk" | "mmr" = "auto",
  lambda: number = 0.7
): RetrievalResult {
  // 自动策略选择：问题长度 < 50字 用 TopK，否则用 MMR
  const strategyUsed = strategy === "auto"
    ? (query.length < 50 ? "topk" : "mmr")
    : strategy;

  if (strategyUsed === "topk") {
    // TopK 策略：直接按相似度排序
    const results = searchRelevantChunks(queryVector, chunkVectors, chunks, topK);
    return { strategyUsed: "topk", selectedChunks: results, scores: results.map(r => r.score) };
  } else {
    // MMR 策略：最大边际相关性检索
    const mmrResults = mmrSelect(queryVector, chunkVectors, topK, lambda);
    const selectedChunks = mmrResults.map(result => ({
      index: result.index,
      text: chunks[result.index].text,
      score: result.mmrScore
    }));
    return { strategyUsed: "mmr", selectedChunks, scores: mmrResults.map(r => r.mmrScore) };
  }
}

// src/components/QASection.vue - UI组件
<div class="strategy-selector-header">
  <div class="strategy-dropdown" @click="toggleStrategyMenu">
    <span class="strategy-text">{{ currentStrategyText }}</span>
    <div class="strategy-arrow">▼</div>
  </div>
  <div class="strategy-indicator" :class="currentStrategyClass"></div>
  <div v-if="showStrategyMenu" class="strategy-menu">
    <div class="strategy-option" v-for="option in strategyOptions" :key="option.value" @click="selectStrategy(option.value)">
      {{ option.label }}
    </div>
  </div>
</div>
```

### MMR 检索算法

```typescript
// src/utils/mmr.ts
export function mmrSelect(
  queryEmbedding: number[],
  docEmbeddings: number[][],
  topK: number = 5,
  lambda: number = 0.7  // 相关性权重
) {
  // MMR 公式：λ * relevance - (1-λ) * diversity
  // 平衡相关性和多样性，避免返回过于相似的片段
  const mmrScore = lambda * relevance - (1 - lambda) * diversity;
  // 返回 Top-K 索引
}
```

### 证据三态判定

```typescript
// src/utils/evidenceGate.ts
export function decideEvidenceStatus(top1: number, low: number, high: number): EvidenceStatus {
  if (top1 < low) {
    return 'no_evidence';        // 无证据：直接返回，无需调用LLM
  } else if (top1 < high) {
    return 'need_clarify';       // 需要澄清：返回澄清选项，引导用户优化问题
  } else {
    return 'has_evidence';       // 有证据：调用LLM生成完整回答
  }
}

// 默认阈值配置
const LOW = 0.40;    // 相似度低于0.40，认为无证据
const HIGH = 0.52;   // 相似度高于0.52，认为有充分证据
// 0.40-0.52区间需要澄清
```

**策略说明**：
- **no_evidence** (< 0.40)：检索到的文档片段相关性不足，直接返回友好提示
- **need_clarify** (0.40-0.52)：相关性中等，返回澄清问题建议，引导用户提供更具体信息
- **has_evidence** (≥ 0.52)：相关性足够高，调用LLM生成基于文档的准确回答

### 余弦相似度计算

```typescript
// src/utils/similarity.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  // 计算两个向量的余弦相似度
  // 返回值范围 [0, 1]，1 表示完全相同
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

### 多引用跳转

```typescript
// src/App.vue
function scrollToChunks(ids: string[]) {
  if (!ids || ids.length === 0) return;

  // 过滤无效ID并映射到chunk ID
  const validIds = ids.filter(id => id && id.trim()).map(id => {
    // 如果是数字，转换为chunk-id格式
    const num = parseInt(id);
    if (!isNaN(num) && num > 0) {
      return `chunk-${num}`;
    }
    return id;
  });

  if (validIds.length === 0) return;

  // 设置高亮数组（所有引用ID）
  highlightChunks.value = validIds;

  // 滚动到第一个引用的位置
  const firstId = validIds[0];
  textViewerRef.value?.scrollToChunk(firstId);

  // 3 秒后自动取消高亮
  setTimeout(() => {
    highlightChunks.value = [];
  }, 3000);
}
```

### 文本分块（带重叠）

```typescript
// src/utils/chunk.ts
export interface Chunk {
  id: string;         // 唯一标识符，如 "chunk-1", "chunk-2"
  index: number;      // 显示下标，如 1, 2, 3...
  text: string;       // 切片内容
  startPos: number;   // 在原文档中的起始位置
  endPos: number;     // 在原文档中的结束位置
}

export function splitIntoChunksWithOverlap(
    text: string,
    chunkSize: number = 400,
    overlapSize: number = 80
  ): Chunk[] {
    const result: Chunk[] = [];
    const cleaned = text.trim().replace(/\s+/g, " ");

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

      start += chunkSize - overlapSize; // 保留重叠
    }

    return result;
  }

function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const chars1 = text1.split('');
  const chars2 = text2.split('');

  const lcsLength = longestCommonSubsequence(chars1, chars2);
  const maxLength = Math.max(chars1.length, chars2.length);

  if (maxLength === 0) return 1;
  return lcsLength / maxLength;
}

function longestCommonSubsequence(arr1: string[], arr2: string[]): number {
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

export function removeDuplicateChunks(chunks: Chunk[], threshold: number = 0.8): Chunk[] {
  if (!chunks || chunks.length <= 1) return chunks;

  const uniqueChunks: Chunk[] = [];

  for (const chunk of chunks) {
    let isDuplicate = false;

    for (const selectedChunk of uniqueChunks) {
      const similarity = calculateTextSimilarity(chunk.text, selectedChunk.text);

      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueChunks.push(chunk);
    }
  }

  return uniqueChunks;
}
```

## 🎨 UI 特性

### 视觉设计
- **统一配色体系**：紫蓝色主题（#F3F4FF 浅色卡片，#1E2239 深色卡片）
- **渐变背景**：页面背景使用浅紫蓝色（#F7F8FF），卡片使用三色渐变
- **统一设计语言**：所有卡片圆角 16px，统一阴影和边框样式
- **三栏布局**：AI 摘要（浅色）、文档内容（深色）、文档问答（浅色）

### 交互体验
- **拖拽上传**：支持拖拽文件，悬停效果反馈
- **键盘快捷键**：Enter 发送问题，Shift+Enter 换行
- **状态指示**：加载/成功/错误状态的视觉反馈
- **引用高亮**：点击引用后目标片段自动高亮（Flash 动画 + 霓虹边框）
- **平滑滚动**：引用跳转时自动滚动到目标位置并居中显示
- **多引用支持**：支持 `[[1,4]]` 格式，同时高亮多个片段
- **响应式布局**：适配移动端和桌面端，统一最大高度限制

### 组件特性
- **文本查看器**：深色主题，等宽字体，自定义滚动条，左侧竖线装饰
- **引用标记**：浅紫蓝背景，深蓝紫字体，hover 时变亮
- **片段编号**：每个文档片段自动编号显示
- **Flash 动画**：跳转时显示闪烁动画，突出定位位置

## 🔍 RAG 系统架构

### 完整流程

```
文档上传
    ↓
文档解析（PDF/DOCX）
    ↓
文本提取
    ↓
文本分块（带唯一ID和下标）
    ↓
去重合并（余弦相似度阈值0.8）
    ↓
向量化（DashScope Embedding）
    ↓
向量缓存
    ↓
用户提问
    ↓
问题向量化
    ↓
语义检索（智能策略选择）
    ↓
Top-K 或 MMR 检索（根据问题长度自动选择）
    ↓
证据三态判定（有证据/需要澄清/无证据）
    ↓
[有证据] 构建提示词（问题 + 相关片段）
    ↓
[有证据] AI 生成回答（DeepSeek API）
    ↓
[有证据] 解析回答（包含引用标记）
    ↓
[有证据] 引用完整性检查（验证引用有效性）
    ↓
展示结果 + 引用跳转
```

### 关键技术点

1. **向量化缓存**：避免重复计算，提升性能
2. **MMR 算法**：平衡相关性和多样性，避免返回重复内容
3. **证据三态判定**：基于相似度阈值的智能决策，避免无效回答和资源浪费
4. **智能检索策略**：根据问题长度自动选择 TopK 或 MMR 策略，优化检索效果
5. **重叠分块**：保留上下文连续性，提高检索准确性
6. **去重合并**：基于文本相似度自动去除重复片段，提高内容质量
7. **双重标识**：Chunk 同时有唯一 ID 和显示下标，确保引用稳定性和用户友好性
8. **引用完整性检查**：验证 AI 引用是否完全基于提供的片段，防止幻觉回答
9. **多格式引用支持**：支持数字和 chunk-ID 混合引用格式
10. **引用标记**：回答中包含引用，便于追溯来源
11. **交互式策略选择**：用户界面提供优雅的下拉选择框，增强用户控制体验

## ⚠️ 注意事项

1. **API 配置**：
   - 本地开发需要配置 `VITE_AI_API_KEY`（DeepSeek API）
   - Vercel 部署需要配置服务端环境变量 `DASHSCOPE_API_KEY` 和 `AI_API_KEY`
   - 所有 API 密钥都存储在服务端，客户端不直接访问

2. **文件大小**：建议上传的文件不超过 50MB

3. **浏览器兼容性**：需要支持 File API 和 ArrayBuffer 的现代浏览器

4. **向量维度**：DashScope `text-embedding-v4` 返回 1024 维向量

5. **检索参数**：
   - Top-K 默认值为 3
   - MMR lambda 默认值为 0.7（相关性权重）

6. **智能检索策略**：
   - 自动模式：问题长度 < 50字 使用 TopK，否则使用 MMR
   - 支持手动指定策略：topk/mmr/auto
   - UI界面提供下拉选择框，默认选择自动模式

7. **证据三态判定阈值**：
   - LOW 阈值：0.40（相似度低于此值判定为无证据）
   - HIGH 阈值：0.52（相似度高于此值判定为有证据）
   - 中间区间（0.40-0.52）会返回澄清建议

7. **引用格式**：AI 返回的引用格式为 `[[1]]`、`[[chunk-1]]` 等，支持数字和 chunk-ID 格式

8. **引用完整性**：系统会严格验证 AI 引用是否在提供的文档片段中，确保回答可靠性

9. **去重配置**：片段去重相似度阈值默认为 0.8，可根据需要调整

10. **网络依赖**：向量化和问答功能依赖网络连接和 API 服务可用性

11. **安全机制**：内置注入风险扫描、证据三态判定和引用完整性检查，确保回答质量和安全性

## 🔮 扩展方向

1. **更多格式支持**：
   - TXT 纯文本文件
   - Markdown (.md) 文件
   - Excel (.xlsx) 表格文件
   - 图片 OCR 识别

2. **向量数据库集成**：
   - 集成 Vercel KV 进行向量缓存优化
   - 支持外部向量数据库（Milvus、Pinecone）
   - 支持大规模文档索引和持久化存储

3. **检索优化**：
   - 支持混合检索（关键词 + 向量）
   - 支持重排序（Re-ranking）
   - 支持查询扩展（Query Expansion）
   - 实现更先进的检索算法

4. **批量处理**：
   - 支持多文件上传和批量处理
   - 实时进度显示和任务队列管理
   - 支持大文件流式处理

5. **高级功能**：
   - 对话历史记录和上下文管理
   - 多轮对话支持
   - 答案质量评估和置信度评分
   - 引用可信度分析
   - 用户认证和权限管理
   - 证据三态判定策略优化
   - 自适应阈值调整

6. **性能优化**：
   - 向量缓存策略优化
   - API 请求合并和批处理
   - 边缘计算和 CDN 优化

7. **安全增强**：
   - 更完善的注入攻击防护
   - 内容审核和过滤机制
   - API 限流和访问控制
   - 引用完整性检查优化
   - 多层证据验证机制

## 🐛 已知问题

- DOCX 分页检测依赖文档中的分页符标记，如果文档没有明确的分页符，可能无法准确识别
- 复杂格式的 PDF（如扫描件、图片 PDF）可能无法提取文本
- 向量化 API 调用需要网络连接，离线环境无法使用
- 证据三态判定阈值可能需要根据具体应用场景进行调优
- 引用完整性检查可能会过滤掉一些边界情况下的有效引用（未来版本会优化）

## 📄 许可证

MIT License

## 👤 作者

AI Agent Labs

## 📞 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**提示**：TraceRAG 是基于 Vercel Serverless Functions 的完整 RAG 问答系统，采用前后端分离架构，确保安全性和性能。包含文档解析、智能分块（双重标识）、向量化、语义检索、引用完整性检查和生成式问答的完整流程，适用于文档知识库、智能客服、企业知识管理等场景。
