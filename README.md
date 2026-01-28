# TraceRAG

[中文版本](#chinese-version) | [Online Demo](https://tracerag.vercel.app/)

A complete RAG (Retrieval-Augmented Generation) document Q&A system built with Vue 3 + TypeScript + Vercel Serverless Functions. Supports PDF/DOCX document parsing, intelligent chunking, vector retrieval, and AI-driven Q&A, enabling precise question answering based on document content.

## 📋 Introduction

This project is an end-to-end RAG Q&A system that integrates the full process of document parsing, text chunking, vectorization, semantic retrieval, and generative Q&A. After users upload documents, the system automatically extracts text, generates vectors, builds indexes, finds the most relevant document segments through semantic retrieval, and finally uses AI to generate accurate answers based on document content, while supporting multi-turn conversations and context management.

### Core Capabilities

- 📄 **Multi-format Support**: Parsing of PDF (.pdf) and DOCX (.docx) files
- ✂️ **Intelligent Chunking**: Overlapping slicing strategy to preserve context continuity, supporting 1024-dimensional vector mapping
- ✅ **Intent Recognition**: Automatically identifies user intent based on question content to optimize retrieval strategies
- 🔢 **Vectorization**: Uses Alibaba DashScope Embedding to generate text vectors, supporting vector caching
- 🔍 **Semantic Retrieval**: Vector retrieval based on cosine similarity, supporting MMR algorithm for diversity optimization
- 🤖 **AI Q&A**: DeepSeek API-based intelligent Q&A, purely based on document content, supporting SSE streaming typewriter effect
- 🛡️ **Citation Integrity**: Strictly validates whether AI citations exist in the provided document segments to ensure answer reliability
- 🔗 **Citation Navigation**: Citations in answers are clickable to jump to original segments with highlighting; inherited citations show special style (Amber + ↻)
- 📊 **AI Summary**: Automatically generates document summaries and key points, supporting streaming list rendering
- 🙋 **Multi-turn Q&A**: Supports continuous dialogue, retaining context information to improve answer quality
- 🎨 **Unified Visual System**: Purple-blue theme, modern interface design consistent with RAG project style
- 📡 **Full-link Monitoring**: Built-in zero-dependency Logger, tracking TTFT, Token usage, and Map-Reduce latency based on AsyncLocalStorage

## ✨ Features

### Multi-turn Dialogue & Context Management
- ✅ **Query Rewriting**: Rewrites current questions into standalone search terms to eliminate pronoun references and ambiguity; chat automatically skips retrieval
- ✅ **Intent Recognition**: Automatically identifies user intent based on question content to optimize retrieval strategies
- ✅ **Multi-turn QA**: Supports continuous dialogue, retaining context information to improve answer quality
- ✅ **History Summary (Map-Reduce)**: Compresses old messages into background summaries when history exceeds threshold, keeping recent dialogue, controlling tokens, and improving relevance
- ✅ **Citation Inheritance**: Effective evidence segments from the previous turn are automatically inherited to the current turn, merged with current retrieval segments to improve answer stability and consistency
- ✅ **Citation Navigation**: Citations in answers are clickable to jump to original segments with highlighting
- ✅ **Evidence Isolation**: Citations from different turns do not interfere with each other to avoid information conflict
- ✅ **Chat Mode**: Automatically skips retrieval when chat questions are detected; refuses to answer non-document-related questions to maintain system seriousness (this is not an encyclopedia)
- ✅ **Token Budget**: Strictly controls context length to avoid exceeding model input limits and maintain answer quality

### Document Parsing
- ✅ Supports multi-page PDF documents, automatically adding page number markers
- ✅ Supports complex Word documents, detecting page breaks
- ✅ Retains text formatting and paragraph structure
- ✅ Uses `pdfjs-dist` and `mammoth` libraries for parsing

### Text Chunking
- ✅ Intelligent Chunking: Segment by paragraph with overlap (default 400 chars/chunk, 80 chars overlap)
- ✅ Automatic Filtering: Filters paragraphs with fewer than 20 characters
- ✅ Recursive Slicing: Paragraphs exceeding 400 characters are automatically halved
- ✅ Dual Identification: Each segment has a unique ID (chunk-1) and display index (1, 2, 3...)
- ✅ Deduplication: Automatically removes duplicate segments based on cosine similarity (threshold 0.8)
- ✅ Chunk Object: Contains full info like id, index, text, startPos, endPos

### Vectorization & Retrieval
- ✅ **DashScope Embedding**: Uses Alibaba Cloud `text-embedding-v4` model
- ✅ **Vector Caching**: Automatically caches generated vectors to avoid re-computation
- ✅ **Cosine Similarity**: Calculates similarity between query vectors and document vectors
- ✅ **MMR Algorithm**: Maximal Marginal Relevance retrieval to balance relevance and diversity
- ✅ **Top-K Retrieval**: Simple retrieval sorted directly by similarity
- ✅ **Smart Strategy Switching**: Automatically chooses TopK or MMR strategy based on question length
- ✅ **Citation Integrity Check**: Validates if AI citations are fully based on provided segments

### AI Q&A
- ✅ **Semantic Retrieval**: Retrieves relevant document segments based on user questions
- ✅ **Context Budget Control**: Fine-grained control of context length via hybrid strategy
  - **Character Limit**: Ensures context fits model limits
  - **Dynamic Selection**: Adjusts segment count based on question complexity
  - **Coverage Assessment**: Judges information sufficiency based on keyword coverage and semantic relevance
  - **Adaptive Optimization**: Avoids redundancy to improve quality and efficiency
- ✅ **Evidence Tri-state**: Smartly judges answer strategy based on similarity thresholds (Has Evidence / Needs Clarify / No Evidence)
- ✅ **Context Construction**: Feeds retrieved segments as context to AI
- ✅ **Citation Markers**: Answers include citations like `[[1]]`, `[[chunk-1]]`
- ✅ **Citation Integrity**: Strictly validates citations against provided segments
- ✅ **Streaming Output**: Real-time display of AI generation progress, supporting typewriter effect
- ✅ **Full-link Monitoring**: Built-in structured logging for TTFT, Token consumption, and step latency
- ✅ **Strict Constraints**: Answers based only on document content, no fabrication

### AI Summary
- ✅ Automatically generates document summary (max 100 words)
- ✅ Extracts 3~5 key points
- ✅ Supports citation markers: Summary and key points include `[[#ID]]` format citations
- ✅ **Streaming Typewriter**: Real-time display of summary generation process

### Citation Navigation
- ✅ **Multi-format Support**: Supports number `[[1,4]]` and chunk-ID `[[chunk-1,chunk-4]]` formats
- ✅ **Smart Navigation**: Auto-scrolls to the segment with the smallest index upon click
- ✅ **Multi-segment Highlighting**: Highlights all cited segments simultaneously
- ✅ **Flash Animation**: Shows flashing animation on jump to emphasize location
- ✅ **Auto-cancel**: Automatically cancels highlight after 3 seconds
- ✅ **Integrity Validation**: Strictly verifies if citations point to valid document segments
- ✅ **Inherited Citation Style**: Inherited citations from previous turns appear in Amber with a refresh icon (↻) to distinguish from current turn citations (Blue)

### User Experience
- 🎯 **Drag & Drop Upload**: Supports dragging files to upload area
- ⌨️ **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line
- 🌊 **Ultimate Streaming**:
  - **Typewriter Effect**: QA bubbles generate text character-by-character in real-time
  - **Streaming List Rendering**: Summary key points are identified and rendered as bullet points in real-time
  - **Auto-scroll**: Dialogue content auto-scrolls to bottom during generation
- 🔄 **Retrieval Strategy Selection**: Title bar button + dropdown menu, supports Auto/TopK/MMR strategies with color indicators
  - **Auto Strategy**: Use TopK for questions < 50 words, otherwise MMR
  - **Evidence Consistency**: Both strategies use raw similarity for evidence tri-state judgment
- 📊 **Status Feedback**: Real-time display of loading status and error messages
- 📈 **Statistics**: Displays character count, segment count, citation count
- 🎨 **Three-column Layout**: AI Summary, Document Content, Document Q&A cards
- 🌈 **Unified Color Scheme**: Purple-blue visual system, gradient backgrounds, soft shadows
- 📱 **Responsive Design**: Adapts to mobile and desktop

## 🛠️ Tech Stack

- **Frontend Framework**: Vue 3 (Composition API + `<script setup>`)
- **Type System**: TypeScript
- **Build Tool**: Vite
- **Deployment**: Vercel (Serverless Functions + KV Storage)
- **PDF Parsing**: `pdfjs-dist` (v3.11.174)
- **DOCX Parsing**: `mammoth` (v1.11.0)
- **Vectorization**: Alibaba DashScope Embedding (`text-embedding-v4`)
- **AI Service**: DeepSeek API (Streaming)
- **Retrieval Algorithms**: Cosine Similarity + MMR
- **State Management**: Vue 3 Composition API

## 📁 Project Structure

```
tracerag/
├── api/                          # Vercel Serverless Functions
│   ├── _utils/
│   │   └── scanInjectionRisk.ts  # Security scanning tool
│   ├── ai.ts                     # AI Q&A API
│   └── embedding.ts              # Vectorization API
├── src/
│   ├── App.vue                   # Main app component (Parsing, Summary, Q&A)
│   ├── main.ts                   # App entry
│   ├── style.css                 # Global styles
│   ├── env.d.ts                  # Vue type declarations
│   ├── components/
│   │   ├── FileUploader.vue      # File upload component
│   │   ├── TextViewer.vue        # Text viewer (Highlighting & Scrolling)
│   │   └── QASection.vue         # Q&A component (Input, Answer, Citations)
│   ├── services/
│   │   ├── aiService.ts          # AI Service (DeepSeek API streaming)
│   │   ├── qaService.ts          # RAG QA Service (Vectorization, Retrieval, Q&A)
│   │   └── openaiClient.ts       # OpenAI compatible client
│   ├── prompts/
│   │   └── prompt.ts             # AI Prompts
│   ├── styles/
│   │   └── tokens.css            # Design tokens
│   ├── types/
│   │   └── qa.ts                 # TypeScript types
│   └── utils/
│       ├── chunk.ts              # Text chunking (Overlap support)
│       ├── docxParser.ts         # DOCX parser
│       ├── embedding.ts          # Vectorization tool (DashScope)
│       ├── evidenceGate.ts       # Evidence gating mechanism
│       ├── mmr.ts                # MMR algorithm
│       ├── pdfParser.ts          # PDF parser
│       ├── scanInjectionRisk.ts  # Injection risk scanning
│       ├── similarity.ts         # Similarity calculation (Cosine)
│       └── utils.ts              # Utility functions
├── test-evidence-gate.js         # Evidence gate tests
├── test-chunk.js                 # Chunking tests
├── test-citation-integrity.js    # Citation integrity tests
├── package.json
├── tsconfig*.json
├── vite.config.ts
└── vercel.json                   # Vercel config
```

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Environment Configuration

#### Local Development Environment Variables

Create `.env.local` in project root:

```env
# DeepSeek API (for Q&A and Summary)
VITE_AI_API_KEY=your_deepseek_api_key
VITE_AI_API_BASE_URL=https://api.deepseek.com
```

#### Vercel Environment Variables

Configure in Vercel project settings:

```env
# DashScope Embedding API (Server-side)
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4

# DeepSeek API (Server-side)
AI_API_KEY=your_deepseek_api_key
AI_API_BASE_URL=https://api.deepseek.com
```

**Note**: Vectorization and AI requests are serverless; sensitive keys are stored in server-side env vars.

### Local Development

Uses Vercel Serverless Functions. Recommend using Vercel Dev:

#### Install Vercel CLI

```bash
npm install -g vercel
```

#### Start Full-stack Dev Server

```bash
vercel dev --port 3000
```

### Access Application

Visit `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Deploy to Vercel

#### Option 1: Vercel CLI

```bash
vercel login
vercel --prod
```

#### Option 2: GitHub Integration

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Automatic deployment

### Runtime Configuration (SSE & Security)

Add to Vercel Environment Variables:

- `CLIENT_TOKEN`: Consistent with frontend `x-client-token` header, default `tracerag-web`

## 📖 Usage Guide

### Workflow

1. **Upload Document**: Drag & drop or click to upload PDF/DOCX.
2. **Auto Processing**: Text extraction, chunking, AI summary generation.
3. **View Results**: AI Summary (Left), Document Content (Middle), Q&A (Right).
4. **Document Q&A**: Ask questions, AI retrieves and answers with citations.
5. **Citation Navigation**: Click citations to jump to text segments.

### Q&A Streaming (Typewriter)

- **True Streaming**: Backend `/api/ai` proxies SSE frames (`data: ...\n\n`) from upstream to frontend.
- **Fallback**: Simulates typing if upstream is not a readable stream.
- **Incremental Scroll**: Auto-scrolls to bottom after each chunk.

## 🔧 Core Implementation

### RAG QA Flow

Retrieval -> Context Construction -> Generation & Verification.

### SSE Proxy

- Backend: `/api/ai` sets `stream: true` and proxies DeepSeek SSE frames.
- Headers: `Content-Type: text/event-stream`.
- Location: `api/ai.ts`.

### RAG Process Logging (JSON)

- **Zero-dependency Logger**: Uses Node.js `AsyncLocalStorage`.
- **Structured Output**: JSON to `stdout`.
- **Metrics**: `duration_ms`, `ttft_ms`, Token usage.

### Evidence Tri-state & Folding

- **States**: `has_evidence`, `need_clarify`, `no_evidence`.
- **Folding**: Auto-folds long answers (>6 lines).

### Vectorization

Server-side vectorization with caching.

### Smart Retrieval Strategy

Auto-switch between TopK and MMR based on question length.

### Evidence Judgment

Similarity threshold-based judgment.

## 🎨 UI Features

- **Visual Design**: Purple-blue theme.
- **Interaction**: Drag & drop, shortcuts, smooth scrolling.
- **Components**: Text viewer, Citation markers, Flash animation.

## 🔍 RAG System Architecture

```
Document Upload
    ↓
Parsing (PDF/DOCX)
    ↓
Text Extraction
    ↓
Chunking (Overlap & ID)
    ↓
Deduplication
    ↓
Vectorization (DashScope)
    ↓
Vector Cache
    ↓
User Query
    ↓
Query Vectorization
    ↓
Semantic Retrieval (Smart Strategy)
    ↓
Top-K or MMR
    ↓
Evidence Tri-state Judgment
    ↓
[Has Evidence] Prompt Construction
    ↓
[Has Evidence] AI Generation (DeepSeek)
    ↓
[Has Evidence] Answer Parsing
    ↓
[Has Evidence] Citation Integrity Check
    ↓
Display Result + Citation Navigation
```

## ⚠️ Notes

1. **API Config**: Local vs Vercel env vars.
2. **File Size**: < 50MB recommended.
3. **Browser**: Modern browsers required.
4. **Vector Dim**: 1024.
5. **Retrieval Params**: Top-K=3, MMR lambda=0.7.
6. **Smart Strategy**: < 50 words TopK, else MMR.
7. **Evidence Thresholds**: LOW=0.40, HIGH=0.52.
8. **Citation Format**: `[[1]]`, `[[chunk-1]]`.
9. **Integrity**: Strict validation.
10. **Deduplication**: Threshold 0.8.

## 📄 License

MIT License

## 👤 Author

**xiaoBaiCoding**
Focus on LLM applications, Agent systems, and AI front-end engineering practices.

## 📞 Contact

Issues or Pull Requests welcome.

---

**Note**: TraceRAG is a complete RAG Q&A system based on Vercel Serverless Functions...

---

<a id="chinese-version"></a>

# TraceRAG

[在线体验](https://tracerag.vercel.app/)

一个完整的 RAG（Retrieval-Augmented Generation）文档问答系统，基于 Vue 3 + TypeScript + Vercel Serverless Functions 构建。支持 PDF/DOCX 文档解析、智能分块、向量化检索和 AI 驱动的问答功能，实现基于文档内容的精准问答。

## 📋 项目简介

本项目是一个端到端的 RAG 问答系统，集成了文档解析、文本分块、向量化、语义检索和生成式问答的完整流程。用户上传文档后，系统会自动提取文本、生成向量、建立索引，然后通过语义检索找到最相关的文档片段，最终由 AI 生成基于文档内容的准确回答，同时支持多轮对话和上下文管理。

### 核心能力

- 📄 **多格式支持**：PDF (.pdf) 和 DOCX (.docx) 文件解析
- ✂️ **智能分块**：采用带重叠区域（Overlap）的切片策略，保留上下文连续性，支持 1024 维向量映射
- ✅ **意图识别（Intent Recognition）**：基于问题内容自动识别用户意图，优化检索策略
- 🔢 **向量化**：使用阿里 DashScope Embedding 生成文本向量，支持向量缓存
- 🔍 **语义检索**：基于余弦相似度的向量检索，支持 MMR 算法优化多样性
- 🤖 **AI 问答**：基于 DeepSeek API 的智能问答，完全基于文档内容，支持 SSE 流式打字机效果
- 🛡️ **引用完整性**：严格验证 AI 引用是否在提供的文档片段中，确保回答可靠性
- 🔗 **引用跳转**：回答中的引用可点击跳转到原文片段并高亮显示，继承引用显示特殊样式（琥珀色 + ↻）
- 📊 **AI 摘要**：自动生成文档摘要和关键点，支持流式列表渲染
- 🙋 **多轮问答**：支持连续对话，保留上下文信息，提升回答质量
- 🎨 **统一视觉体系**：紫蓝色主题，符合 RAG 项目风格的现代化界面设计
- 📡 **全链路监控**：内置 0 依赖 Logger，基于 AsyncLocalStorage 追踪 TTFT、Token 消耗与 Map-Reduce 耗时

## ✨ 功能特性

### 多轮对话与上下文管理
- ✅ 查询重写（Query Rewriting）：将当前问题改写为独立检索词，消除代词指代与歧义；闲聊自动跳过检索
- ✅ 意图识别（Intent Recognition）：基于问题内容自动识别用户意图，优化检索策略
- ✅ 多轮问答（Multi-turn QA）：支持连续对话，保留上下文信息，提升回答质量
- ✅ 历史摘要（Map-Reduce）：当历史超过阈值时压缩旧消息为背景摘要，保留最近对话，控制 Token 并提升关联性
- ✅ 引用继承：上一轮回答中有效证据片段自动继承到本轮，与当前检索片段合并去重，提升回答稳定性与一致性
- ✅ 引用跳转：回答中的引用可点击跳转到原文片段并高亮显示
- ✅ 证据隔离：不同轮次的引用互不干扰，避免信息冲突
- ✅ 闲聊模式：识别到闲聊问题后，自动跳过检索，非文档相关问题拒绝回答，保持问答系统的严肃性（这不是百科全书）
- ✅ Token预算：严格控制上下文长度，避免超出模型输入限制，保持回答质量


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
- ✅ **Context预算控制**：混合策略精细控制上下文长度
  - **字符数限制**：确保上下文不超过模型输入限制
  - **动态片段选择**：根据问题复杂度智能调整片段数量
  - **信息覆盖度评估**：基于关键词覆盖度和语义相关性判断信息充足性
  - **自适应优化**：避免冗余信息，提升回答质量和效率
- ✅ **证据三态判定**：基于相似度阈值智能判断回答策略（有证据/需要澄清/无证据）
- ✅ **上下文构建**：将检索到的片段作为上下文输入 AI
- ✅ **引用标记**：回答中包含 `[[1]]`、`[[chunk-1]]` 等多种引用格式
- ✅ **引用完整性**：严格验证 AI 引用是否在提供的片段中，确保回答可靠性
- ✅ **流式输出**：实时显示 AI 生成进度，支持打字机效果
- ✅ **全链路监控**：内置结构化日志系统，追踪 TTFT（首字延迟）、Token 消耗与各阶段耗时
- ✅ **严格约束**：只基于文档内容回答，不编造信息

### AI 摘要
- ✅ 自动生成文档摘要（最多 100 字）
- ✅ 提取 3~5 条关键点
- ✅ 支持引用标记：摘要和关键点中包含 `[[#编号]]` 格式的引用
- ✅ **流式打字机**：实时显示摘要生成过程，不再枯燥等待

### 引用跳转
- ✅ **多格式支持**：支持数字 `[[1,4]]` 和 chunk-ID `[[chunk-1,chunk-4]]` 格式
- ✅ **智能跳转**：点击引用自动滚动到最小编号的片段位置
- ✅ **多片段高亮**：同时高亮所有引用的片段
- ✅ **Flash 动画**：跳转时显示闪烁动画，突出定位位置
- ✅ **自动取消**：3 秒后自动取消高亮
- ✅ **完整性验证**：严格验证引用是否指向有效文档片段，避免无效引用
- ✅ **继承引用样式**：上一轮继承的引用显示为琥珀色，并带有刷新图标 (↻)，与当前轮引用（蓝色）区分

### 用户体验
- 🎯 **拖拽上传**：支持拖拽文件到上传区域
- ⌨️ **键盘快捷键**：Enter 发送，Shift+Enter 换行
- 🌊 **极致流式**：
  - **打字机效果**：QA 问答气泡实时逐字生成，告别等待
  - **列表流式渲染**：摘要关键点在生成过程中即可识别列表结构，实时渲染为 bullet points
  - **自动滚动**：对话内容随生成自动滚动到底部
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

### 运行时配置补充（SSE 与安全）

在 Vercel 项目设置中再补充以下变量：

- `CLIENT_TOKEN`: 与前端请求头 `x-client-token` 一致，默认建议 `tracerag-web`

说明：
- `/api/ai` 会校验 `x-client-token` 与 `CLIENT_TOKEN`，并将请求透传到上游 DeepSeek
- 已启用上游 `stream: true` 并将 `text/event-stream` 直传到前端

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

### 问答流式输出（打字机）
- 真流式：后端 `/api/ai` 以 SSE 直传上游的 `data: ...\n\n` 帧，前端逐帧渲染
- 回退流：若上游未返回可读流，前端会对最终 JSON 的 `answer` 字段进行逐字模拟输出
- 增量滚动：每次追加后自动滚动到底部，结束后进行折叠判断与引用渲染

## 🔧 核心实现

### RAG QA 流程
本系统基于“检索→构建上下文→生成与验证”的流程实现文档问答，包含检索策略选择、引用完整性校验与证据态管理。

### SSE 直传代理

- 后端接口：`/api/ai` 设置 `stream: true`，并将上游 DeepSeek 的 SSE 帧透传到前端
- 响应头：`Content-Type: text/event-stream`、`Connection: keep-alive`、`Cache-Control: no-cache`
- 结束帧：末尾补充 `data: [DONE]\n\n`
- 位置：`api/ai.ts`

### RAG 过程日志（JSON）

- 后端接口：`/api/log`（已弃用，升级为 Serverless 友好方案）
- **全链路 Logger**：
  - **零依赖**：基于 Node.js `async_hooks` 实现 `AsyncLocalStorage`，无需第三方库
  - **结构化输出**：所有日志以 JSON 格式输出至 `stdout`，自动被 Vercel/AWS 收集
  - **性能追踪**：自动记录每个关键步骤（向量化、检索、重写、生成）的耗时 (`duration_ms`)
  - **TTFT 监测**：精准捕获 LLM 流式响应的首字延迟 (`ttft_ms`)
  - **Token 统计**：记录输入/输出 Token 消耗
- 字段示例：
  - `traceId`: 请求链路唯一标识
  - `module`: 模块名 (LLM, Vector, MapReduce...)
  - `step`: 步骤名 (StreamRequest, Embedding...)
  - `metadata`: 上下文相关的元数据 (requestId, shard_count, text_length...)

### 证据三态与折叠逻辑

- 证据三态：
  - `has_evidence`：正常回答并显示引用胶囊
  - `need_clarify`：显示澄清选项，引导用户补充信息
  - `no_evidence`：明确不足原因并给出操作建议，隐藏引用胶囊
- 折叠逻辑：
  - 对助手气泡进行长度判定（>6 行或 >600 字符）默认折叠
  - 点击“展开/收起”切换，仅在 `has_evidence` 时显示引用区块

### UI 体验优化

- 输入框强调：白底+主色边框、右侧嵌入按钮、自动增高与滚动
- 加载态优化：按钮内置 spinner，并在加载时启用渐变闪动背景
- 毛玻璃效果：底部输入容器启用 `backdrop-filter` 提升通透感
- 初始占位：原生 `placeholder` 居中，兼容中文输入法组合态

### 向量化（DashScope Embedding）
采用服务端向量化与缓存策略，减少重复计算并提升整体检索性能。

### 智能检索策略切换
提供 TopK 与 MMR 两种检索策略，自动与手动可切换，保证相关性与多样性的平衡。

### MMR 检索算法
采用“相关性-多样性”平衡的最大边际相关性算法，避免返回过于相似的片段。

### 证据三态判定
基于相似度阈值将回答分为“有证据/需要澄清/无证据”，确保回答质量与安全。

**策略说明**：
- no_evidence：相关性不足，直接返回友好提示
- need_clarify：相关性居中，返回澄清建议，引导用户提供更具体信息
- has_evidence：相关性充分，调用 LLM 生成基于文档的准确回答

### 余弦相似度计算
使用标准余弦相似度度量文本嵌入之间的相关性。

### 多引用跳转
支持数字与 chunk-ID 混合引用格式，点击后滚动到目标位置并高亮显示。

### 文本分块（带重叠）
采用重叠切片方式保证上下文连续性，并提供基于相似度的去重能力。

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
12. **智能检索策略**：根据问题长度自动选择 TopK 或 MMR 策略，优化检索效果
13. **多轮问答**：支持连续对话，保留上下文信息，提升回答质量
14. **历史摘要**：当历史超过阈值时压缩旧消息为背景摘要，保留最近对话，控制 Token 并提升关联性，理论上支持无限长对话
15. **查询重写（Query Rewriting）**：将当前问题改写为独立检索词，消除代词指代与歧义；闲聊自动跳过检索
16. **意图识别**：基于问题内容自动识别用户意图，优化检索策略

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

**xiaoBaiCoding**
专注于 LLM 应用、Agent 系统与 AI 前端工程化实践。

## 📞 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**提示**：TraceRAG 是基于 Vercel Serverless Functions 的完整 RAG 问答系统，采用前后端分离架构，确保安全性和性能。包含文档解析、智能分块（双重标识）、向量化、语义检索、引用完整性检查和生成式问答的完整流程，适用于文档知识库、智能客服、企业知识管理等场景。
