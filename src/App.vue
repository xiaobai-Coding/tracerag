<template>
  <main class="page">
    <section class="hero">
      <div class="hero-content">
        <div class="hero-header">
          <p class="tag">
            <span class="tag-icon">📄</span>
            <span>Document RAG · Q&A</span>
          </p>
          <h1>Document Parser & Extraction</h1>
        </div>
        <div class="hero-upload">
          <FileUploader @file-upload="handleFile" />
          <p class="hint">支持格式：PDF (.pdf) · DOCX (.docx)</p>
        </div>
      </div>
    </section>

    <section class="status-section" v-if="loading || error">
      <div class="status-card" :class="{ error: error }">
        <div class="status-indicator" :class="{ loading: loading, error: error }"></div>
        <span v-if="loading">⏳ 正在解析文档中…</span>
        <span v-else-if="error" class="error-text">{{ error }}</span>
      </div>
    </section>

    <section class="layout" v-if="text">
      <!-- AI 摘要 -->
      <div class="ui-card summary-card">
        <div class="card-header">
          <div class="dot purple"></div>
          <span>AI 摘要</span>
          <span class="count" v-if="chunks.length">片段 {{ chunks.length }} 个</span>
        </div>

        <div v-if="summaryLoading" class="summary-loading">
          <span class="spinner"></span>
          <span>摘要生成中…</span>
          <div class="skeleton-lines">
            <div class="skeleton-line long"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line long"></div>
          </div>
          <div class="skeleton-lines">
            <div class="skeleton-line long"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line long"></div>
          </div>
        </div>

        <div v-else-if="summaryError" class="summary-error">
          {{ summaryError }}
        </div>

        <div v-else-if="summary" class="summary-content">
          <h3>摘要</h3>
          <p class="summary-line">
            <span v-for="(seg, idx) in parseWithRefs(summary.summary)" :key="`s-${idx}`">
              <template v-if="seg.type === 'text'">{{ seg.text }}</template>
              <span v-else class="ref-group">
                <a
                  href="#"
                  class="ref-link"
                  @click.prevent="scrollToChunks(mapRefsToChunkIds(seg.ids))"
                >[#{{ seg.ids.join(',') }}]</a>
              </span>
            </span>
          </p>

          <h4>关键点</h4>
          <ul>
            <li v-for="(kp, idx) in summary.key_points" :key="idx">
              <span>
                <span v-for="(seg, j) in parseWithRefs(kp)" :key="`k-${idx}-${j}`">
                  <template v-if="seg.type === 'text'">{{ seg.text }}</template>
                  <span v-else class="ref-group">
                    <a
                      href="#"
                      class="ref-link"
                      @click.prevent="scrollToChunks(mapRefsToChunkIds(seg.ids))"
                    >[#{{ seg.ids.join(',') }}]</a>
                  </span>
                </span>
              </span>
            </li>
          </ul>
        </div>

        <div v-else class="summary-placeholder">
          上传完成后自动生成摘要…
        </div>
      </div>
      <!-- 提取的文本内容 -->
      <div class="ui-card ui-card--dark text-card">
        <div class="card-header">
          <div class="dot blue"></div>
          <span class="text-card-title">提取的文本内容</span>
          <span class="count ui-badge" v-if="text">{{ Math.ceil(text.length / 1000) }}K 字符</span>
        </div>
        <TextViewer :chunks="chunks" :highlight-chunk-indices="highlightChunks" ref="textViewerRef" />
      </div>
      <!-- 文档问答 -->
      <QASection v-if="chunks.length" :chunks="chunks" @scroll-to-chunks="scrollToChunks" />
    </section>

    <section class="empty-state" v-else-if="!loading && !error">
      <div class="empty-card">
        <p>📄 请上传文档开始解析</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from "vue";
// @ts-ignore - Vue component with script setup
import FileUploader from "./components/FileUploader.vue";
// @ts-ignore - Vue component with script setup
import TextViewer from "./components/TextViewer.vue";
// @ts-ignore - Vue component with script setup
import QASection from "./components/QASection.vue";
import { extractPdfText } from "./utils/pdfParser";
import { extractDocxText } from "./utils/docxParser";
import { splitIntoChunksWithOverlap, removeDuplicateChunks, type Chunk } from "./utils/chunk";
import { streamDeepSeekAPI } from "./services/aiService";
import { answerQuestion } from "./services/qaService";
import { PARSE_SYSTEM_PROMPT } from "./prompts/prompt"
type SummaryResult = {
  summary: string;
  key_points: string[];
};

const text = ref("");
const loading = ref(false);
const error = ref("");
const chunks = ref<Chunk[]>([]); // 文档片段
const summary = ref<SummaryResult | null>(null);
const summaryLoading = ref(false);
const summaryError = ref("");
const textViewerRef = ref<InstanceType<typeof TextViewer> | null>(null);
const highlightChunks = ref<string[]>([]);
let highlightClearTimer: number | null = null;

// 文件类型处理器映射
const fileHandlers: Record<string, (file: File) => Promise<string>> = {
  ".pdf": (file: File) => extractPdfText(file),
  ".docx": (file: File) => extractDocxText(file),
};

// 处理文件上传
async function handleFile(file: File) {
  loading.value = true;
  error.value = "";
  text.value = "";
  summary.value = null;
  summaryError.value = "";

  try {
    const fileName = file.name.toLowerCase();
    const extension = fileName.substring(fileName.lastIndexOf("."));
    const handler = fileHandlers[extension];

    if (!handler) {
      error.value = "不支持的文件类型，仅支持 PDF 和 DOCX 格式";
      return;
    }

    text.value = await handler(file);
    const overlapChunks = splitIntoChunksWithOverlap(text.value);
    console.log('1.去重前的片段：', overlapChunks)
    // 去重合并重复片段
    const uniqueChunks = removeDuplicateChunks(overlapChunks);
    chunks.value = uniqueChunks;
    console.log('2.去重后的片段：', chunks.value)
    // 生成摘要
    await generateSummary();
  } catch (err: any) {
    error.value = "解析失败：" + err.message;
  } finally {
    loading.value = false;
  }
}

type Segment =
  | { type: "text"; text: string }
  | { type: "ref"; ids: string[] };

function parseWithRefs(str: string): Segment[] {
  const segments: Segment[] = [];
  // 支持形如 [[chunk-1,chunk-4]]、[[#chunk-1,#chunk-4]] 或 [[1,4]] 等格式
  const regex = /\[\[([#\w\d\-,\s，、]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: str.slice(lastIndex, match.index) });
    }
    const ids = match[1]
      .split(/[,，、]/)
      .map((id) => id.trim().replace(/^#/, ""))
      .filter(Boolean);
    if (ids.length) {
      segments.push({ type: "ref", ids });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) {
    segments.push({ type: "text", text: str.slice(lastIndex) });
  }
  return segments;
}

/**
 * 将引用ID映射为chunk ID（用于跳转）
 */
function mapRefsToChunkIds(ids: string[]): string[] {
  return ids.map(id => {
    // 如果已经是chunk-id格式，直接使用
    if (id.startsWith('chunk-')) {
      return id;
    }
    // 如果是数字，转换为chunk-id格式
    const num = parseInt(id);
    if (!isNaN(num) && num > 0 && num <= chunks.value.length) {
      return `chunk-${num}`;
    }
    return id;
  }).filter(id => id);
}

/**
 * 处理多引用跳转
 * - 滚动到最小编号的片段（第一个引用）
 * - 高亮所有引用的片段
 * - 3秒后自动取消高亮
 */
function scrollToChunks(ids: string[]) {
  if (!ids || ids.length === 0) return;
  // 过滤无效ID
  const validIds = ids.filter((id) => id && id.trim());
  if (validIds.length === 0) return;

  // 清除之前的高亮清除定时器
  if (highlightClearTimer) {
    clearTimeout(highlightClearTimer);
    highlightClearTimer = null;
  }

  // 设置高亮数组（所有引用ID）
  highlightChunks.value = validIds;

  // 滚动到第一个引用的位置
  const firstId = validIds[0];
  textViewerRef.value?.scrollToChunk(firstId);
  
  // 3秒后自动取消高亮
  highlightClearTimer = window.setTimeout(() => {
    highlightChunks.value = [];
    highlightClearTimer = null;
  }, 3000);
}

// 生成总结和关键点
async function generateSummary() {
  if (!chunks.value.length) return;
  summaryLoading.value = true;
  summaryError.value = "";

  const userMessage = `
${chunks.value.map((c) => `#${c.index}: ${c.text}`).join("\n------------\n")}
`;

  const messages = [
    { role: "system", content: PARSE_SYSTEM_PROMPT },
    { role: "user", content: userMessage }
  ];

  try {
    let streamed = "";
    const res = await streamDeepSeekAPI(
      messages,
      false,
      (partial: string) => {
        streamed += partial;
      }
    );
    const content = res;
    const parsed = content
    if (parsed?.summary && Array.isArray(parsed?.key_points)) {
      summary.value = {
        summary: parsed.summary,
        key_points: parsed.key_points
      };
    } else {
      summaryError.value = "模型返回格式不符合预期，请重试。";
    }
  } catch (e: any) {
    console.error("[Summary] 生成摘要失败:", e);
    summaryError.value = e?.message || "生成摘要失败";
  } finally {
    summaryLoading.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 48px 20px 64px;
  background: var(--bg-page);
  color: var(--text-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  box-sizing: border-box;
}

.hero {
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  position: relative;
}

.hero-content {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);
  position: relative;
  overflow: hidden;
}

/* 背景装饰效果 */
.hero-content::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -5%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-header {
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.12));
  color: #6366f1;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.3px;
  margin: 0 0 12px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.tag:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.18));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.tag-icon {
  font-size: 14px;
  filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
}

h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.3px;
  font-weight: 800;
  background: linear-gradient(135deg, #1e2239 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.3;
}

.hero-upload {
  position: relative;
  z-index: 1;
}

.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  opacity: 0.8;
}

.status-section {
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.status-card {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 12px 40px rgba(79, 70, 229, 0.08);
}

.status-card.error {
  border-color: #fecaca;
  background: #fef2f2;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 2s ease-in-out infinite;
}

.status-indicator.loading {
  background: #3b82f6;
}

.status-indicator.error {
  background: #ef4444;
  animation: none;
}

.error-text {
  color: #dc2626;
  font-weight: 500;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.layout {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  align-items: stretch; /* 让所有卡片高度一致 */
}

.card {
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(79, 70, 229, 0.08);
  padding: 20px 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #1E2239;
  margin-bottom: 16px;
  font-size: 16px;
}

.text-card-title {
  font-size: 16px;
  color: #fff;
  font-weight: 700;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot.blue {
  background: var(--primary);
}

.dot.purple {
  background: var(--primary);
}

.count {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-2);
  font-weight: 500;
  padding: 4px 10px;
  background: var(--primary-weak);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
}
.ui-badge{
  background: #6366f1;
  border-radius: #999;
  border: 1px solid #6366f1;
  color: #fff;
}
.summary-card {
  min-height: 400px;
  max-height: 700px;
  height: 100%; /* 填充网格单元格 */
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.summary-card .card-header {
  flex-shrink: 0;
}

.summary-card .summary-content,
.summary-card .summary-loading,
.summary-card .summary-error,
.summary-card .summary-placeholder {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* 摘要卡片滚动条样式 */
.summary-card .summary-content::-webkit-scrollbar,
.summary-card .summary-loading::-webkit-scrollbar,
.summary-card .summary-error::-webkit-scrollbar,
.summary-card .summary-placeholder::-webkit-scrollbar {
  width: 6px;
}

.summary-card .summary-content::-webkit-scrollbar-track,
.summary-card .summary-loading::-webkit-scrollbar-track,
.summary-card .summary-error::-webkit-scrollbar-track,
.summary-card .summary-placeholder::-webkit-scrollbar-track {
  background: rgba(99, 102, 241, 0.05);
  border-radius: 3px;
}

.summary-card .summary-content::-webkit-scrollbar-thumb,
.summary-card .summary-loading::-webkit-scrollbar-thumb,
.summary-card .summary-error::-webkit-scrollbar-thumb,
.summary-card .summary-placeholder::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 3px;
}

.summary-card .summary-content::-webkit-scrollbar-thumb:hover,
.summary-card .summary-loading::-webkit-scrollbar-thumb:hover,
.summary-card .summary-error::-webkit-scrollbar-thumb:hover,
.summary-card .summary-placeholder::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.3);
}

.summary-loading,
.summary-error,
.summary-placeholder {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6b7280;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px 16px 18px;
}

.summary-error {
  color: #dc2626;
}

.skeleton-lines {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.skeleton-line {
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(245, 247, 255, 0.9), rgba(225, 230, 255, 0.95), rgba(245, 247, 255, 0.9));
  position: relative;
  overflow: hidden;
}

.skeleton-line::after {
  content: "";
  position: absolute;
  top: 0;
  left: -40%;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9), transparent);
  animation: shimmer 1.2s ease-in-out infinite;
}

.skeleton-line.long {
  width: 98%;
}

.skeleton-line.short {
  width: 78%;
}

.skeleton-line:not(.long):not(.short) {
  width: 92%;
}

.skeleton-panel {
  width: 100%;
  min-height: 180px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(243, 244, 255, 0.9), rgba(228, 232, 255, 0.85));
  border: 1px solid rgba(99, 102, 241, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 8px 24px rgba(79, 70, 229, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

@keyframes shimmer {
  0% { transform: translateX(0); }
  100% { transform: translateX(250%); }
}

.summary-content h3 {
  margin: 0 0 6px;
  font-size: 18px;
  color: #1E2239;
}

.summary-content h4 {
  margin: 12px 0 6px;
  font-size: 16px;
  color: #1E2239;
}

.summary-content p {
  margin: 0 0 10px;
  line-height: 1.6;
  color: #1E2239;
}

.summary-content ul {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #1E2239;
}

.kp-index {
  color: #a855f7;
  margin-right: 6px;
}

.ref-group {
  margin: 0 2px;
}

.ref-link {
  color: #1E2239;
  text-decoration: none;
  margin-right: 4px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.18);
  transition: all 0.2s ease;
  font-weight: 600;
  font-size: 12px;
}

.ref-link:hover {
  background: rgba(99, 102, 241, 0.2);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.ref-link:active {
  transform: translateY(1px);
}

.text-card {
  min-height: 400px;
  max-height: 700px;
  height: 100%; /* 填充网格单元格 */
  background: var(--bg-card-dark);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
}

.text-card .card-header {
  flex-shrink: 0;
}

.text-card .text-viewer {
  flex: 1;
  min-height: 0;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.empty-card {
  padding: 48px 24px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 15px;
  box-shadow: 0 12px 40px rgba(79, 70, 229, 0.08);
}

@media (max-width: 640px) {
  .page {
    padding: 32px 16px 48px;
    gap: 20px;
  }

  .hero-content {
    padding: 16px 18px;
  }

  .hero-header {
    margin-bottom: 14px;
  }

  .tag {
    font-size: 10px;
    padding: 4px 10px;
    margin-bottom: 10px;
  }

  h1 {
    font-size: 20px;
    letter-spacing: -0.2px;
  }

  .hint {
    font-size: 11px;
    margin-top: 8px;
  }

  .card {
    padding: 16px 18px;
  }

  .summary-card {
    min-height: 300px;
    max-height: 500px;
  }

  .text-card {
    min-height: 300px;
    max-height: 500px;
  }

  .qa-card {
    min-height: 300px;
    max-height: 500px;
  }
}
</style>