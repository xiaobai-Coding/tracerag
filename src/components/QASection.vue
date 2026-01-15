<template>
  <div class="ui-card qa-card">
    <div class="card-header">
      <div class="dot purple"></div>
      <span>RAG 文档问答</span>
      <div class="strategy-selector-header">
        <div class="strategy-dropdown" :class="{ open: showStrategyMenu }" @click="toggleStrategyMenu">
          <span class="strategy-text">{{ currentStrategyText }}</span>
          <div class="strategy-arrow">▼</div>
        </div>
        <div class="strategy-indicator" :class="currentStrategyClass"></div>
        <div v-if="showStrategyMenu" class="strategy-menu">
          <div
            class="strategy-option"
            v-for="option in strategyOptions"
            :key="option.value"
            :class="{ active: option.value === retrievalStrategy }"
            @click.stop="selectStrategy(option.value)"
          >
            {{ option.label }}
          </div>
        </div>
      </div>
      <span class="count" v-if="chunks?.length">片段 {{ chunks.length }} 个</span>
    </div>

    <div class="qa-input">
      <div class="textarea-wrapper">
        <textarea
          v-model="question"
          class="qa-textarea"
          rows="3"
          placeholder="向文档提问，如：这份文档的主要结论是什么？"
          :disabled="loading"
          @keydown="handleKeyDown"
        ></textarea>
        <div class="textarea-overlay" v-if="loading">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <span class="loading-text">AI 正在思考中...</span>
          </div>
        </div>
      </div>
      <div class="qa-actions">
        <button class="ask-btn" :disabled="loading || !question.trim()" @click="handleAsk">
          <span v-if="loading" class="btn-spinner"></span>
          <span v-else class="btn-text">
            <span class="btn-icon">💬</span>
            问文档
          </span>
        </button>
        <span class="qa-hint">
          <span class="hint-icon">⌨️</span>
          <span>Enter 发送 · Shift+Enter 换行 · 引用格式 [[1]] 或 [[1,3]]</span>
        </span>
      </div>
    </div>

    <!-- Loading 状态 -->
    <div class="qa-loading" v-if="loading && !answer">
      <div class="loading-card">
        <div class="loading-animation">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
        <p class="loading-message">AI 正在分析文档并生成回答...</p>
      </div>
    </div>

    <!-- 证据不足状态 -->
    <div class="qa-no-evidence" v-else-if="answer?.status === 'no_evidence'">
      <div class="evidence-header">
        <div class="evidence-icon">❌</div>
        <div>
          <div class="evidence-title">证据不足</div>
          <div class="evidence-subtitle">文档中未找到相关信息</div>
        </div>
      </div>
      <div class="evidence-content">
        <p class="evidence-text">抱歉，文档内容中没有找到足够的相关信息来回答您的问题。</p>
        <div class="evidence-metrics" v-if="answer.metrics">
          <span class="metrics-label">检索信息：</span>
          <span class="metrics-value">最高相似度 {{ (answer.metrics.top1_score * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- 需要澄清状态 -->
    <div class="qa-need-clarify" v-else-if="answer?.status === 'need_clarify'">
      <div class="clarify-header">
        <div class="clarify-icon">🤔</div>
        <div>
          <div class="clarify-title">需要澄清</div>
          <div class="clarify-subtitle">请提供更多具体信息</div>
        </div>
      </div>
      <div class="clarify-content">
        <p class="clarify-text">您的问题比较模糊，请尝试：</p>
        <ul class="clarify-options">
          <li v-for="(option, idx) in answer.clarify_options" :key="idx" class="clarify-option">
            {{ option }}
          </li>
        </ul>
        <div class="clarify-metrics" v-if="answer.metrics">
          <span class="metrics-label">检索信息：</span>
          <span class="metrics-value">相似度 {{ (answer.metrics.top1_score * 100).toFixed(1) }}% ({{ answer.metrics.low * 100 }}%-{{ answer.metrics.high * 100 }}% 区间)</span>
        </div>
      </div>
    </div>

    <!-- AI 回答卡片 -->
    <div class="qa-answer" v-else-if="answer?.status === 'has_evidence'">
      <div class="answer-header">
        <div class="answer-title-wrapper">
          <div class="answer-icon">✨</div>
          <div>
            <div class="answer-title">AI 回答</div>
            <div class="answer-subtitle">基于文档内容生成</div>
          </div>
        </div>
        <div class="answer-badge" v-if="answer.citations?.length">
          {{ answer.citations.length }} 个引用
        </div>
      </div>
      <div class="answer-content">
        <p class="answer-text">
          <span v-for="(seg, idx) in parseWithRefs(answer.answer || '')" :key="`ans-${idx}`">
            <template v-if="seg.type === 'text'">{{ seg.text }}</template>
            <span v-else class="ref-group">
              <a
                href="#"
                class="ref-link"
                @click.prevent="handleRefClick(seg.ids)"
              >[[{{ seg.ids.join(',') }}]]</a>
            </span>
          </span>
        </p>
        <div class="sources" v-if="answer.citations?.length">
          <span class="source-label">
            <span class="source-icon">📎</span>
            引用片段：
          </span>
          <div class="source-chips">
            <button
              v-for="s in answer.citations"
              :key="s"
              class="source-chip"
              @click="handleRefClick([s])"
            >
              #{{ mapIdsToDisplayIndices([s])[0] }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div class="qa-error" v-else-if="error">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <div class="error-title">出错了</div>
        <div class="error-message">{{ error }}</div>
      </div>
    </div>

    <!-- 占位符 -->
    <div class="qa-placeholder" v-else>
      <div class="placeholder-icon">💡</div>
      <p class="placeholder-text">提问后将在这里展示 AI 回答</p>
      <p class="placeholder-hint">支持多引用格式，点击引用可跳转到对应片段</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Chunk } from "../utils/chunk";
import { answerQuestion } from "../services/qaService";
import type { QAResponse, ChatMessage } from "../types/qa";

const props = defineProps<{
  chunks: Chunk[];
}>();

const emit = defineEmits<{
  (e: "scroll-to-chunks", ids: string[]): void;
}>();

const question = ref("");
const loading = ref(false);
const answer = ref<QAResponse | null>(null);
const error = ref("");
const retrievalStrategy = ref<"auto" | "topk" | "mmr">("auto");
const showStrategyMenu = ref(false);
// 多轮对话历史，只保留最近若干轮
const chatHistory = ref<ChatMessage[]>([]);

type Segment =
  | { type: "text"; text: string }
  | { type: "ref"; ids: string[] };

/**
 * 解析文本中的引用标记，支持 [[1,4]]、[[2,5,6]] 等多引用格式
 * 返回 Segment 数组，每个 ref 类型的 segment 包含所有引用编号
 */
function parseWithRefs(str: string): Segment[] {
  const segments: Segment[] = [];
  // 支持形如 [[1,4]]、[[chunk-1,chunk-3]]、[[#2,5,6]]、[[1, 4]] 等多种格式
  const regex = /\[\[([#\w\d\-,\s，、]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: str.slice(lastIndex, match.index) });
    }
    // 解析引用编号：去除 # 号，分割逗号/顿号，保持原始格式
    const rawIds = match[1]
      ? match[1]
          .split(/[,，、]/)
          .map((id) => id.trim().replace(/^#/, ""))
          .filter(Boolean)
      : [];
    if (rawIds.length) {
      segments.push({ type: "ref", ids: rawIds });
    }
    
    lastIndex = regex.lastIndex; 
  }
  if (lastIndex < str.length) {
    segments.push({ type: "text", text: str.slice(lastIndex) });
  }
  return segments;
}

// 策略选项配置
const strategyOptions: any = [
  { value: 'auto', label: 'auto' },
  { value: 'topk', label: 'TopK' },
  { value: 'mmr', label: 'MMR' }
];

// 当前策略文本
const currentStrategyText = computed(() => {
  const option: any = strategyOptions.find((opt: any) => opt.value === retrievalStrategy.value);
  return option?.label || 'auto';
});

// 当前策略指示器样式类
const currentStrategyClass = computed(() => {
  switch (retrievalStrategy.value) {
    case 'auto': return 'indicator-auto';
    case 'topk': return 'indicator-topk';
    case 'mmr': return 'indicator-mmr';
    default: return 'indicator-auto';
  }
});

/**
 * 切换策略菜单显示
 */
function toggleStrategyMenu() {
  if (loading.value) return;
  showStrategyMenu.value = !showStrategyMenu.value;
}

/**
 * 选择策略
 */
function selectStrategy(strategy: "auto" | "topk" | "mmr") {
  retrievalStrategy.value = strategy;
  showStrategyMenu.value = false;
}

/**
 * 将引用ID转换为显示下标
 */
function mapIdsToDisplayIndices(ids: string[]): string[] {
  return ids.map(id => {
    // 如果是数字，转换为对应的chunk index
    const num = parseInt(id);
    if (!isNaN(num) && num > 0 && num <= props.chunks.length) {
      const chunk = props.chunks[num - 1]; // chunks数组是从0开始的
      if (chunk) {
        return chunk.index.toString();
      }
    }
    // 如果已经是chunk-id格式，转换为对应的index
    if (id.startsWith('chunk-')) {
      const num = parseInt(id.replace('chunk-', ''));
      if (!isNaN(num) && num > 0 && num <= props.chunks.length) {
        const chunk = props.chunks[num - 1];
        if (chunk) {
          return chunk.index.toString();
        }
      }
    }
    return id;
  });
}

/**
 * 处理引用点击事件
 * - 解析引用编号数组
 * - 滚动到最小编号（第一个引用）
 * - 高亮所有引用的片段
 */
function handleRefClick(ids: string[]) {
  const validIds = ids.filter((id) => id && id.trim());
  if (validIds.length === 0) return;

  // 将数字索引映射到chunk id
  const chunkIds = validIds.map(id => {
    // 如果已经是chunk-id格式，直接使用
    if (id.startsWith('chunk-')) {
      return id;
    }
    // 如果是数字，转换为chunk-id格式
    const num = parseInt(id);
    if (!isNaN(num) && num > 0 && num <= props.chunks.length) {
      return `chunk-${num}`;
    }
    return id;
  }).filter(id => id);

  if (chunkIds.length === 0) return;

  // 触发事件，传递所有引用ID数组
  emit("scroll-to-chunks", chunkIds);
}

/**
 * 处理键盘事件
 * - Enter: 发送（如果未按 Shift）
 * - Shift+Enter: 换行
 */
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!loading.value && question.value.trim()) {
      handleAsk();
    }
  }
}

/**
 * 处理点击事件，关闭策略菜单
 */
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const dropdown = target.closest('.strategy-dropdown');
  const menu = target.closest('.strategy-menu');

  // 如果点击的不是下拉框或菜单，则关闭菜单
  if (!dropdown && !menu) {
    showStrategyMenu.value = false;
  }
}

// 生命周期钩子
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// 文档提问
async function handleAsk() {
  if (!question.value.trim()) return;
  loading.value = true;
  error.value = "";
  answer.value = null;
  try {
    const res = await answerQuestion(
      question.value,
      props.chunks,
      retrievalStrategy.value,
      chatHistory.value
    );
    answer.value = res;

    // 将当前轮对话写入历史，只保留最近 3-5 轮以控制 Token
    const userMsg: ChatMessage = {
      role: "user",
      content: question.value.trim(),
    };

    let assistantContent = "";
    if (res.status === "has_evidence") {
      assistantContent = res.answer || "";
    } else if (res.status === "no_evidence") {
      assistantContent = "文档中没有找到足够的相关信息来回答这个问题。";
    } else if (res.status === "need_clarify") {
      assistantContent =
        res.clarify_options?.join("\n") || "你的问题比较模糊，请再具体一些。";
    }

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: assistantContent,
    };

    // 将当前轮对话写入历史
    // 注意：不再限制历史长度，由后端的 summarizeHistory 函数自动管理 Token
    // 前端保持完整历史记录，以便用户查看完整对话过程
    chatHistory.value = [...chatHistory.value, userMsg, assistantMsg];
  } catch (e: any) {
    error.value = e?.message || "提问失败，请重试";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.qa-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
  min-height: 400px;
  max-height: 700px;
  height: 100%; /* 填充网格单元格 */
  display: flex;
  flex-direction: column;
}

.qa-card .card-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: var(--space-3);
  font-size: var(--text-lg);
  justify-content: space-between;
}

.qa-card .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--primary);
}

.qa-card .count {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-2);
  font-weight: 500;
  padding: 4px 10px;
  background: var(--primary-weak);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
}

.qa-card .qa-input {
  flex-shrink: 0;
}

.qa-card .qa-loading,
.qa-card .qa-answer,
.qa-card .qa-no-evidence,
.qa-card .qa-need-clarify,
.qa-card .qa-error,
.qa-card .qa-placeholder {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* QA 卡片滚动条样式 */
.qa-card .qa-answer::-webkit-scrollbar,
.qa-card .qa-loading::-webkit-scrollbar,
.qa-card .qa-error::-webkit-scrollbar,
.qa-card .qa-placeholder::-webkit-scrollbar {
  width: 6px;
}

.qa-card .qa-answer::-webkit-scrollbar-track,
.qa-card .qa-loading::-webkit-scrollbar-track,
.qa-card .qa-error::-webkit-scrollbar-track,
.qa-card .qa-placeholder::-webkit-scrollbar-track {
  background: rgba(99, 102, 241, 0.05);
  border-radius: 3px;
}

.qa-card .qa-answer::-webkit-scrollbar-thumb,
.qa-card .qa-loading::-webkit-scrollbar-thumb,
.qa-card .qa-error::-webkit-scrollbar-thumb,
.qa-card .qa-placeholder::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 3px;
}

.qa-card .qa-answer::-webkit-scrollbar-thumb:hover,
.qa-card .qa-loading::-webkit-scrollbar-thumb:hover,
.qa-card .qa-error::-webkit-scrollbar-thumb:hover,
.qa-card .qa-placeholder::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.3);
}


.qa-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.textarea-wrapper {
  position: relative;
}

.qa-textarea {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  padding: 14px 16px;
  font-size: 14px;
  font-family: "Inter", "PingFang SC", system-ui, -apple-system, sans-serif;
  resize: vertical;
  min-height: 100px;
  outline: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(250, 251, 255, 0.95));
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.06);
}

.qa-textarea:focus {
  border-color: rgba(99, 102, 241, 0.25);
  box-shadow: 
    0 4px 16px rgba(79, 70, 229, 0.12),
    0 0 0 3px rgba(99, 102, 241, 0.08);
  background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(250, 251, 255, 0.98));
}

.qa-textarea:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.textarea-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(4px);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 13px;
  color: #6366f1;
  font-weight: 500;
}

.qa-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.strategy-selector-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.strategy-dropdown {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.strategy-text {
  font-size: 12px;
  color: #666;
  font-weight: 500;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.strategy-dropdown:hover .strategy-text {
  background: rgba(99, 102, 241, 0.05);
  color: #6366f1;
}

.strategy-dropdown.open .strategy-text {
  background: rgba(99, 102, 241, 0.08);
  color: #7c3aed;
}

.strategy-arrow {
  font-size: 10px;
  color: #6366f1;
  font-weight: bold;
  transition: all 0.2s ease;
  margin-left: 2px;
  opacity: 0.7;
}

.strategy-dropdown:hover .strategy-arrow,
.strategy-dropdown.open .strategy-arrow {
  opacity: 1;
  color: #7c3aed;
}

.strategy-dropdown.open .strategy-arrow {
  transform: rotate(180deg);
}

.strategy-hint {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(99, 102, 241, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);
  backdrop-filter: blur(8px);
  z-index: 10;
  animation: hintFadeIn 0.2s ease-out;
}

@keyframes hintFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hint-text {
  font-size: 11px;
  color: #6b7280;
  font-weight: 400;
  line-height: 1.3;
  white-space: nowrap;
}

.strategy-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
  z-index: 10000;
  min-width: 80px;
  margin-top: 4px;
  padding: 4px 0;
}

.strategy-option {
  padding: 8px 12px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.strategy-option:hover {
  background: rgba(99, 102, 241, 0.05);
  color: #6366f1;
}

.strategy-option.active {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-weight: 500;
}

.strategy-option.active::after {
  content: '✓';
  position: absolute;
  right: 8px;
  color: #6366f1;
  font-weight: bold;
}

.strategy-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: 4px;
  transition: all 0.2s ease;
}

.indicator-auto {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  box-shadow: 0 0 6px rgba(99, 102, 241, 0.4);
}

.indicator-topk {
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.indicator-mmr {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.ask-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #8b5cf6 100%);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 12px rgba(99, 102, 241, 0.3),
    0 0 0 0 rgba(99, 102, 241, 0.4);
  position: relative;
  overflow: hidden;
}

.ask-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s ease;
}

.ask-btn:hover::before {
  left: 100%;
}

.ask-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.ask-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 
    0 8px 20px rgba(99, 102, 241, 0.4),
    0 0 0 4px rgba(99, 102, 241, 0.1);
}

.ask-btn:not(:disabled):active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.btn-icon {
  font-size: 16px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.qa-hint {
  font-size: 11px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.8;
}

.hint-icon {
  font-size: 12px;
}

/* Loading 状态 */
.qa-loading {
  margin-top: 0;
}

.loading-card {
  background: linear-gradient(135deg, rgba(236, 239, 255, 0.98), rgba(225, 234, 255, 0.95), rgba(219, 234, 254, 0.92));
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 12px 40px rgba(79, 70, 229, 0.08);
}

.loading-animation {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.loading-dot {
  width: 10px;
  height: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 50%;
  animation: loadingBounce 1.4s ease-in-out infinite;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loadingBounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1.2);
    opacity: 1;
  }
}

.loading-message {
  margin: 0;
  font-size: 14px;
  color: #6366f1;
  font-weight: 500;
}

/* 证据不足状态 */
.qa-no-evidence {
  margin-top: 0;
  background: linear-gradient(135deg, rgba(254, 226, 226, 0.95), rgba(254, 215, 215, 0.9));
  border: 1px solid rgba(220, 38, 38, 0.15);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(220, 38, 38, 0.08);
  position: relative;
  overflow: hidden;
  animation: evidenceSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes evidenceSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.evidence-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 0 20px;
}

.evidence-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(220, 38, 38, 0.3));
}

.evidence-title {
  font-weight: 800;
  font-size: 18px;
  color: #dc2626;
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.evidence-subtitle {
  font-size: 12px;
  color: #991b1b;
  margin-top: 2px;
  opacity: 0.8;
}

.evidence-content {
  padding: 16px 20px 20px 20px;
}

.evidence-text {
  margin: 0 0 12px;
  line-height: 1.6;
  color: #7f1d1d;
  font-size: 14px;
}

.evidence-metrics {
  font-size: 12px;
  color: #991b1b;
  opacity: 0.7;
}

/* 需要澄清状态 */
.qa-need-clarify {
  margin-top: 0;
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95), rgba(254, 215, 170, 0.9));
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(245, 158, 11, 0.08);
  position: relative;
  overflow: hidden;
  animation: clarifySlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes clarifySlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.clarify-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 0 20px;
}

.clarify-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(245, 158, 11, 0.3));
}

.clarify-title {
  font-weight: 800;
  font-size: 18px;
  color: #d97706;
  background: linear-gradient(135deg, #d97706, #b45309);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.clarify-subtitle {
  font-size: 12px;
  color: #92400e;
  margin-top: 2px;
  opacity: 0.8;
}

.clarify-content {
  padding: 16px 20px 20px 20px;
}

.clarify-text {
  margin: 0 0 12px;
  line-height: 1.6;
  color: #9a3412;
  font-size: 14px;
}

.clarify-options {
  margin: 0 0 12px;
  padding-left: 16px;
}

.clarify-option {
  color: #9a3412;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 4px;
  opacity: 0.85;
}

.clarify-metrics {
  font-size: 12px;
  color: #92400e;
  opacity: 0.7;
}

.metrics-label {
  font-weight: 500;
}

.metrics-value {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

/* AI 回答卡片 - 简约炫酷样式，与摘要卡片风格一致 */
.qa-answer {
  margin-top: 0;
  background: linear-gradient(135deg, rgba(236, 239, 255, 0.98), rgba(225, 234, 255, 0.95), rgba(219, 234, 254, 0.92));
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 16px;
  padding: 0;
  box-shadow: 0 12px 40px rgba(79, 70, 229, 0.08);
  position: relative;
  overflow: hidden;
  animation: answerSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes answerSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

.answer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.08);
  background: transparent;
}

.answer-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.answer-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
  animation: iconFloat 2s ease-in-out infinite;
}

@keyframes iconFloat {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.answer-title {
  font-weight: 800;
  font-size: 18px;
  color: #1e2239;
  margin: 0;
  background: linear-gradient(135deg, #1e2239 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.answer-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
  opacity: 0.8;
}

.answer-badge {
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.12));
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #6366f1;
}

.answer-content {
  padding: 20px;
}

.answer-text {
  margin: 0 0 16px;
  line-height: 1.8;
  color: #1f2937;
  word-break: break-word;
  font-size: 15px;
}

.ref-group {
  margin: 0 2px;
}

.ref-link {
  color: #6366f1;
  text-decoration: none;
  margin: 0 2px;
  padding: 4px 8px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.12));
  border: 1px solid rgba(99, 102, 241, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 700;
  font-size: 12px;
  display: inline-block;
  position: relative;
  overflow: hidden;
}

.ref-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.5s ease;
}

.ref-link:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2));
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 
    0 4px 12px rgba(99, 102, 241, 0.3),
    0 0 0 2px rgba(99, 102, 241, 0.1);
  transform: translateY(-1px);
}

.ref-link:hover::before {
  left: 100%;
}

.sources {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(99, 102, 241, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.source-label {
  font-size: 13px;
  color: #4b5563;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.source-icon {
  font-size: 14px;
}

.source-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.source-chip {
  border: 1px solid rgba(99, 102, 241, 0.25);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.1));
  color: #6366f1;
  border-radius: 12px;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 600;
  font-size: 12px;
  position: relative;
  overflow: hidden;
}

.source-chip::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s ease, height 0.4s ease;
}

.source-chip:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.18));
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 
    0 4px 12px rgba(99, 102, 241, 0.25),
    0 0 0 2px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}

.source-chip:hover::before {
  width: 100px;
  height: 100px;
}

/* 错误状态 */
.qa-error {
  margin-top: 16px;
  background: linear-gradient(135deg, rgba(254, 242, 242, 0.95), rgba(254, 226, 226, 0.9));
  border: 1px solid rgba(220, 38, 38, 0.15);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(220, 38, 38, 0.08);
}

.error-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.error-content {
  flex: 1;
}

.error-title {
  font-weight: 700;
  font-size: 15px;
  color: #dc2626;
  margin-bottom: 4px;
}

.error-message {
  font-size: 13px;
  color: #991b1b;
  line-height: 1.5;
}

/* 占位符 */
.qa-placeholder {
  margin-top: 16px;
  background: linear-gradient(135deg, rgba(236, 239, 255, 0.6), rgba(225, 234, 255, 0.5));
  border: 1px dashed rgba(99, 102, 241, 0.15);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.05);
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
  display: block;
  filter: drop-shadow(0 2px 8px rgba(99, 102, 241, 0.2));
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.placeholder-text {
  margin: 0 0 8px;
  color: #4b5563;
  font-size: 15px;
  font-weight: 600;
}

.placeholder-hint {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
  opacity: 0.8;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 响应式设计 */
@media (max-width: 640px) {
  .qa-card {
    max-height: 600px;
  }
}
</style>

