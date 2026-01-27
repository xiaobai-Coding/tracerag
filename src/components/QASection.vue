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

    

    <!-- 对话气泡列表 -->
    <div class="qa-chat" ref="chatContainer">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        class="chat-row"
        :class="msg.role === 'user' ? 'chat-row-user' : 'chat-row-assistant'"
      >
        <div
          class="chat-bubble"
          :class="msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'"
        >
          <div class="chat-content" :class="{ collapsed: msg.role === 'assistant' && isCollapsed(idx, msg) }">
            <template v-if="msg.role === 'assistant' && msg.status === 'no_evidence'">
              <div class="qa-no-evidence">
                <div class="evidence-header">
                  <div class="evidence-icon">🧪</div>
                  <div>
                    <div class="evidence-title">证据不足</div>
                    <div class="evidence-subtitle">未找到足够相关的文档片段</div>
                  </div>
                </div>
                <div class="evidence-content">
                  <p class="evidence-text">可能原因：</p>
                  <ul class="clarify-options">
                    <li class="clarify-option" v-for="r in deriveNoEvidenceReasons(msg)" :key="r">{{ r }}</li>
                  </ul>
                  <p class="evidence-text">建议操作：</p>
                  <ul class="clarify-options">
                    <li class="clarify-option" v-for="s in deriveNoEvidenceSuggestions()" :key="s">{{ s }}</li>
                  </ul>
                  <div class="evidence-metrics">
                    <span class="metrics-label">top1:</span>
                    <span class="metrics-value">{{ msg.metrics?.top1_score ?? '-' }}</span>
                    <span class="metrics-label" style="margin-left:8px;">strategy:</span>
                    <span class="metrics-value">{{ msg.metrics?.strategy ?? 'auto' }}</span>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="msg.role === 'assistant' && msg.status === 'need_clarify'">
              <div class="qa-need-clarify">
                <div class="clarify-header">
                  <div class="clarify-icon">🧭</div>
                  <div>
                    <div class="clarify-title">需要澄清</div>
                    <div class="clarify-subtitle">选择或补充以下信息</div>
                  </div>
                </div>
                <div class="clarify-content">
                  <p class="clarify-text">可选项：</p>
                  <ul class="clarify-options">
                    <li class="clarify-option" v-for="opt in (msg.clarifyOptions || [])" :key="opt">{{ opt }}</li>
                  </ul>
                </div>
              </div>
            </template>
            <template v-else>
              <span
                v-for="(seg, j) in parseWithRefs(msg.content)"
                :key="`m-${idx}-${j}`"
              >
                <template v-if="seg.type === 'text'">
                  {{ seg.text }}
                </template>
                <span v-else class="ref-group">
                  <template v-for="(id, idx) in seg.ids" :key="idx">
                    <a
                      href="#"
                      class="ref-link"
                      :class="{ 'inherited': msg.inheritedIds?.includes(id) }"
                      @click.prevent="handleRefClick([id])"
                      :title="msg.inheritedIds?.includes(id) ? '引用来源：上一轮' : '引用来源：本轮检索'"
                    >[[{{ id }}]]<sup v-if="msg.inheritedIds?.includes(id)">↻</sup></a>
                  </template>
                </span>
              </span>
            </template>
          </div>
          <div v-if="msg.role === 'assistant' && isLong(msg.content)" class="collapse-actions">
            <button class="collapse-btn" @click="toggleCollapse(idx)">{{ isCollapsed(idx, msg) ? '展开' : '收起' }}</button>
          </div>
          <div
            v-if="msg.citations && msg.citations.length && !isCollapsed(idx, msg) && msg.status !== 'no_evidence' && msg.status !== 'need_clarify'"
            class="chat-sources"
          >
            <span class="source-label">
              <span class="source-icon">📎</span>
              引用片段：
            </span>
            <div class="source-chips">
              <button
                v-for="s in msg.citations"
                :key="s"
                class="source-chip"
                :class="{ 'inherited': msg.inheritedIds?.includes(s) }"
                @click="handleRefClick([s])"
                :title="msg.inheritedIds?.includes(s) ? '引用来源：上一轮' : '引用来源：本轮检索'"
              >
                #{{ mapIdsToDisplayIndices([s])[0] }}
                <span v-if="msg.inheritedIds?.includes(s)" class="inherited-badge">↻</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div class="qa-placeholder" v-if="!messages.length && !loading && !error">
        <div class="placeholder-icon">💡</div>
        <p class="placeholder-text">提问后将在这里展示 AI 对话</p>
        <p class="placeholder-hint">支持多轮对话与引用跳转，试着问点什么吧</p>
      </div>

      <!-- 错误状态 -->
      <div class="qa-error" v-if="error">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <div class="error-title">出错了</div>
          <div class="error-message">{{ error }}</div>
        </div>
      </div>

      <!-- Loading 气泡 -->
      <div class="chat-row chat-row-assistant" v-if="loading">
        <div class="chat-bubble chat-bubble-assistant loading-bubble">
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="qa-input">
      <div class="textarea-wrapper">
        <textarea
          v-model="question"
          class="qa-textarea"
          rows="1"
          placeholder="向文档提问，如：这份文档的主要结论是什么？"
          :disabled="loading"
          @keydown="handleKeyDown"
          @input="autoResize"
          ref="textareaRef"
        ></textarea>
        <button
          :class="['input-send-btn', { loading }]"
          :disabled="loading || !question.trim()"
          @click="handleAsk"
        >
          <span v-if="loading" class="btn-spinner"></span>
          <span class="btn-text">{{ loading ? '生成中…' : '问文档' }}</span>
        </button>
      </div>
      <div class="qa-actions">
        <span class="qa-hint">
          <span class="hint-icon">⌨️</span>
          <span>Enter 发送 · Shift+Enter 换行 · 引用格式 [[1]] 或 [[1,3]]</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import type { Chunk } from "../utils/chunk";
import { answerQuestion } from "../services/qaService";
import type { ChatMessage, QAResponse } from "../types/qa";

const props = defineProps<{
  chunks: Chunk[];
}>();

const emit = defineEmits<{
  (e: "scroll-to-chunks", ids: string[]): void;
}>();

const question = ref("");
const loading = ref(false);
const error = ref("");
const retrievalStrategy = ref<"auto" | "topk" | "mmr">("auto");
const showStrategyMenu = ref(false);
// 后端使用的多轮对话历史
const chatHistory = ref<ChatMessage[]>([]);

// 前端展示用的对话消息列表
type UIBubble = {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  status?: "no_evidence" | "need_clarify" | "has_evidence";
  metrics?: {
    top1_score: number;
    strategy: "topk" | "mmr";
    k: number;
    low: number;
    high: number;
    context_chars: number;
    context_chunks: number;
  };
  clarifyOptions?: string[];
  inheritedIds?: string[]; // 继承证据ID集合
};
const messages = ref<UIBubble[]>([]);
const chatContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

type Segment =
  | { type: "text"; text: string }
  | { type: "ref"; ids: string[] };

const collapsedStates = ref<Record<number, boolean>>({});

function isLong(content: string): boolean {
  const lines = content.split(/\r?\n/);
  if (lines.length > 6) return true;
  return content.length > 600;
}

function isCollapsed(idx: number, msg: UIBubble): boolean {
  const state = collapsedStates.value[idx];
  if (state === undefined) {
    return msg.role === "assistant" && isLong(msg.content);
  }
  return state;
}

function toggleCollapse(idx: number) {
  collapsedStates.value[idx] = !isCollapsed(idx, messages.value[idx] as UIBubble);
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement;
  if (!el) return;
  el.style.height = 'auto';
  const max = 150;
  const newH = Math.min(max, el.scrollHeight);
  el.style.height = `${newH}px`;
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
}

watch(question, async () => {
  await nextTick();
  const el = textareaRef.value;
  if (el) {
    el.style.height = 'auto';
    const max = 150;
    const newH = Math.min(max, el.scrollHeight);
    el.style.height = `${newH}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }
});

function deriveNoEvidenceReasons(msg: UIBubble): string[] {
  const rs: string[] = [];
  const s = msg.metrics?.top1_score ?? 0;
  const ck = msg.metrics?.context_chunks ?? 0;
  if (ck === 0) rs.push("未检索到相关片段或片段数量过少");
  if (s < 0.35) rs.push("最高相似度较低，相关性不足");
  if (msg.citations && msg.citations.length === 0) rs.push("回答未引用任何文档证据");
  if (rs.length === 0) rs.push("当前问题与文档内容关联不强");
  return rs;
}

function deriveNoEvidenceSuggestions(): string[] {
  const ss: string[] = [];
  ss.push("重述问题并加入更具体的关键词");
  ss.push("引用具体章节或段落编号，例如 [[1]] 或 [[chunk-2]]");
  ss.push("切换检索策略为 TopK 或 MMR");
  ss.push("将问题拆分为更小的子问题逐步求解");
  return ss;
}
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
  const currentQuestion = question.value.trim();
  // 先将用户消息追加到对话列表
  messages.value.push({
    role: "user",
    content: currentQuestion,
  });
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }

  loading.value = true;
  error.value = "";
  try {
    let isStreamingStarted = false;
    let assistantMsgIndex = -1;

    const res = await answerQuestion(
      currentQuestion,
      props.chunks,
      retrievalStrategy.value,
      chatHistory.value,
      (chunk) => {
        // 收到第一个 chunk 时，关闭 loading，创建占位消息
        if (!isStreamingStarted) {
          isStreamingStarted = true;
          loading.value = false;
          messages.value.push({
            role: "assistant",
            content: "",
            status: "has_evidence"
          });
          assistantMsgIndex = messages.value.length - 1;
        }
        
        // 追加内容
        if (assistantMsgIndex !== -1) {
          const targetMsg = messages.value[assistantMsgIndex];
          if (targetMsg) {
            targetMsg.content += chunk;
            
            // 滚动到底部
            const container = chatContainer.value;
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }
        }
      }
    );

    const userMsg: ChatMessage = {
      role: "user",
      content: currentQuestion,
    };

    let assistantContent = "";
    let assistantCitations: string[] | undefined;
    if (res.status === "has_evidence") {
      assistantContent = res.answer || "";
      assistantCitations = res.citations || [];
    } else if (res.status === "no_evidence") {
      assistantContent = "文档中没有找到足够的相关信息来回答这个问题。";
    } else if (res.status === "need_clarify") {
      assistantContent =
        res.clarify_options?.join("\n") || "你的问题比较模糊，请再具体一些。";
    }

    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: assistantContent,
      usedChunks: res.used_chunks_detail,
    };

    // 将当前轮对话写入历史
    // 注意：不再限制历史长度，由后端的 summarizeHistory 函数自动管理 Token
    // 前端保持完整历史记录，以便用户查看完整对话过程
    chatHistory.value = [...chatHistory.value, userMsg, assistantMsg];

    // 如果之前已经开始流式输出，则更新该消息
    if (isStreamingStarted && assistantMsgIndex !== -1) {
       const msg = messages.value[assistantMsgIndex];
       if (msg) {
         // 最终修正内容（确保完整性）
         if (res.status === 'has_evidence') {
            // 保持流式内容或使用最终 answer（通常一致）
            msg.content = assistantContent; 
         } else {
            // 如果变成了其他状态，覆盖内容
            msg.content = assistantContent;
         }
         
         msg.citations = assistantCitations;
         msg.status = res.status;
         msg.metrics = res.metrics;
         msg.clarifyOptions = res.clarify_options;
         msg.inheritedIds = res.inherited_ids;
         
         collapsedStates.value[assistantMsgIndex] = isLong(assistantContent);
       }
    } else {
      // 如果没有流式输出（例如直接返回 no_evidence），则走旧逻辑追加消息
      messages.value.push({
        role: "assistant",
        content: assistantContent,
        citations: assistantCitations,
        status: res.status,
        metrics: res.metrics,
        clarifyOptions: res.clarify_options,
        inheritedIds: res.inherited_ids,
      });
      collapsedStates.value[messages.value.length - 1] = isLong(assistantContent);
    }

    await nextTick();
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }

    // 清空输入框
    question.value = "";
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
.qa-card .qa-error,
.qa-card .qa-placeholder,
.qa-card .qa-chat {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 80px;
}

/* QA 卡片滚动条样式 */
.qa-card .qa-answer::-webkit-scrollbar,
.qa-card .qa-loading::-webkit-scrollbar,
.qa-card .qa-error::-webkit-scrollbar,
.qa-card .qa-placeholder::-webkit-scrollbar,
.qa-card .qa-chat::-webkit-scrollbar {
  width: 6px;
}

.qa-card .qa-answer::-webkit-scrollbar-track,
.qa-card .qa-loading::-webkit-scrollbar-track,
.qa-card .qa-error::-webkit-scrollbar-track,
.qa-card .qa-placeholder::-webkit-scrollbar-track,
.qa-card .qa-chat::-webkit-scrollbar-track {
  background: rgba(99, 102, 241, 0.05);
  border-radius: 3px;
}

.qa-card .qa-answer::-webkit-scrollbar-thumb,
.qa-card .qa-loading::-webkit-scrollbar-thumb,
.qa-card .qa-error::-webkit-scrollbar-thumb,
.qa-card .qa-placeholder::-webkit-scrollbar-thumb,
.qa-card .qa-chat::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 3px;
}

.qa-card .qa-answer::-webkit-scrollbar-thumb:hover,
.qa-card .qa-loading::-webkit-scrollbar-thumb:hover,
.qa-card .qa-error::-webkit-scrollbar-thumb:hover,
.qa-card .qa-placeholder::-webkit-scrollbar-thumb:hover,
.qa-card .qa-chat::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.3);
}


.qa-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.qa-input::before {
  content: '';
  position: absolute;
  top: -12px;
  left: 0;
  right: 0;
  height: 12px;
  background: linear-gradient(to bottom, rgba(255,255,255,0), var(--bg-card));
}

.textarea-wrapper {
  position: relative;
}

.qa-textarea {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--primary);
  padding: 12px 84px 12px 16px;
  font-size: 14px;
  font-family: "Inter", "PingFang SC", system-ui, -apple-system, sans-serif;
  resize: none;
  min-height: 60px;
  max-height: 150px;
  outline: none;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.08);
  overflow-y: hidden;
}

.qa-textarea::placeholder {
  color: #6b7280;
  text-align: center;
}

.qa-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  background: #ffffff;
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
  gap: 8px;
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

.input-send-btn {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  border: none;
  background: var(--primary);
  color: #fff;
  border-radius: 9999px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.input-send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-send-btn:not(:disabled):hover {
  background: #7c3aed;
}

.input-send-btn.loading {
  background: linear-gradient(90deg, #6366f1 0%, #7c3aed 50%, #6366f1 100%);
  background-size: 200% 100%;
  animation: buttonShimmer 1.2s linear infinite;
}

.input-send-btn .btn-text {
  font-weight: 700;
}

@keyframes buttonShimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.textarea-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, rgba(99,102,241,0.2), rgba(99,102,241,0.6), rgba(99,102,241,0.2));
  background-size: 200% 100%;
  animation: loadingBar 1.2s linear infinite;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}

@keyframes loadingBar {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
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
  margin-top: 4px;
  background: rgba(254, 226, 226, 0.6);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 10px;
  box-shadow: none;
  position: relative;
  overflow: hidden;
  animation: evidenceSlideIn 0.2s ease-out;
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
  gap: 8px;
  padding: 10px 12px 0 12px;
}

.evidence-icon {
  font-size: 18px;
}

.evidence-title {
  font-weight: 700;
  font-size: 14px;
  color: #b91c1c;
}

.evidence-subtitle {
  font-size: 11px;
  color: #991b1b;
  margin-top: 0;
  opacity: 0.8;
}

.evidence-content {
  padding: 10px 12px 12px 12px;
}

.evidence-text {
  margin: 0 0 8px;
  line-height: 1.5;
  color: #7f1d1d;
  font-size: 13px;
}

.evidence-metrics {
  font-size: 11px;
  color: #991b1b;
  opacity: 0.7;
}

/* 需要澄清状态 */
.qa-need-clarify {
  margin-top: 4px;
  background: rgba(255, 237, 213, 0.6);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  box-shadow: none;
  position: relative;
  overflow: hidden;
  animation: clarifySlideIn 0.2s ease-out;
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
  gap: 8px;
  padding: 10px 12px 0 12px;
}

.clarify-icon {
  font-size: 18px;
}

.clarify-title {
  font-weight: 700;
  font-size: 14px;
  color: #b45309;
}

.clarify-subtitle {
  font-size: 11px;
  color: #92400e;
  margin-top: 0;
  opacity: 0.8;
}

.clarify-content {
  padding: 10px 12px 12px 12px;
}

.clarify-text {
  margin: 0 0 8px;
  line-height: 1.5;
  color: #9a3412;
  font-size: 13px;
}

.clarify-options {
  margin: 0 0 8px;
  padding-left: 16px;
}

.clarify-option {
  color: #9a3412;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 3px;
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
  padding: 4px 12px;
  border-radius: 9999px;
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

.ref-link.inherited {
  color: #d97706;
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.ref-link.inherited:hover {
  background: rgba(245, 158, 11, 0.2);
  border-color: #d97706;
}

.ref-link sup {
  font-size: 10px;
  vertical-align: super;
  margin-left: 1px;
  opacity: 0.8;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--primary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all 0.2s;
}

.source-chip:hover {
  background: var(--primary-weak);
  border-color: var(--primary);
}

.source-chip.inherited {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: #d97706;
}

.source-chip.inherited:hover {
  background: rgba(245, 158, 11, 0.2);
  border-color: #d97706;
}

.inherited-badge {
  font-size: 10px;
  line-height: 1;
  opacity: 0.8;
  margin-left: 2px;
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

/* 对话气泡区域 */
.qa-chat {
  padding-top: 12px;
  padding-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-row {
  display: flex;
  width: 100%;
}

.chat-row-user {
  justify-content: flex-end;
}

.chat-row-assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 80%;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap; /* 基本 Markdown 文本换行支持 */
}

.chat-bubble-user {
  background: var(--primary);
  color: #ffffff;
  border-radius: 8px;
}

.chat-bubble-assistant {
  background: var(--primary-weak);
  color: #111827;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.chat-content {
  font-size: 14px;
}

.chat-content.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collapse-actions {
  margin-top: 6px;
}

.collapse-btn {
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.08));
  color: #6366f1;
  border-radius: 9999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), rgba(139, 92, 246, 0.12));
  border-color: rgba(99, 102, 241, 0.45);
}

.chat-sources {
  margin-top: 8px;
}

.loading-bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
}

.loading-dots {
  display: inline-flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9ca3af;
  animation: chatDot 1.2s infinite ease-in-out;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes chatDot {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.6; }
  40% { transform: scale(1.1); opacity: 1; }
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
