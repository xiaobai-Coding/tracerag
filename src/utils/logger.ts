// src/utils/logger.ts

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface BaseLog {
  ts: string;
  level: LogLevel;
  traceId: string;
  module: string;
  step: string;
  duration_ms?: number;
  metadata?: any;
}

export type VectorMetadata = { text_length: number; model: string; };
export type QueryRewriteMetadata = { original_query: string; rewritten_query: string; strategy?: string; };
export type MapReduceMetadata = { phase: 'map' | 'reduce'; shard_count?: number; shard_id?: number; input_length?: number; };
export type TokenMetadata = { input_tokens: number; output_tokens: number; total_tokens: number; model?: string; };
export type TTFTMetadata = { ttft_ms: number; prompt_tokens?: number; };

export type RAGMetadata = 
  | VectorMetadata 
  | QueryRewriteMetadata 
  | MapReduceMetadata 
  | TokenMetadata 
  | TTFTMetadata
  | Record<string, any>;

interface TraceStore {
  traceId: string;
}

// Simple abstraction for Context Storage (Works in Browser & Node)
// In Node, we ideally use AsyncLocalStorage. In Browser, we use a simple closure/global (since single user).
class ContextStorage {
  private store: TraceStore | null = null;
  private nodeALS: any = null;

  constructor() {
    // 简单判断是否在 Node 环境
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        // 使用 import.meta.env 判断是否是浏览器构建环境 (Vite)
        // 只有在非浏览器环境下才尝试 require('async_hooks')
        // @ts-ignore
        if (typeof window === 'undefined') {
             // Dynamic require to avoid build errors in Browser
            // @ts-ignore
            const { AsyncLocalStorage } = typeof require !== 'undefined' ? require('async_hooks') : { AsyncLocalStorage: null };
            if (AsyncLocalStorage) {
                // @ts-ignore
                this.nodeALS = new AsyncLocalStorage();
            }
        }
      } catch (e) { /* ignore */ }
    }
  }

  run(store: TraceStore, fn: () => any) {
    if (this.nodeALS) {
      // @ts-ignore
      return this.nodeALS.run(store, fn);
    }
    const prev = this.store;
    this.store = store;
    try {
      return fn();
    } finally {
      this.store = prev;
    }
  }

  getStore(): TraceStore | undefined {
    if (this.nodeALS) {
      return this.nodeALS.getStore();
    }
    return this.store || undefined;
  }
}

const contextStorage = new ContextStorage();

class Logger {
  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  public runWithTrace<T>(fn: () => T, traceId?: string): T {
    const id = traceId || this.generateTraceId();
    return contextStorage.run({ traceId: id }, fn);
  }

  public getTraceId(): string {
    return contextStorage.getStore()?.traceId || 'no-trace';
  }

  private output(level: LogLevel, module: string, step: string, metadata?: RAGMetadata, duration_ms?: number) {
    const logEntry: BaseLog = {
      ts: new Date().toISOString(),
      level,
      traceId: this.getTraceId(),
      module,
      step,
      duration_ms,
      metadata,
    };
    
    const str = JSON.stringify(logEntry);

    if (typeof process !== 'undefined' && process.stdout && process.stdout.write) {
      process.stdout.write(str + '\n');
    } else {
      // Browser fallback
      console.log(`[${level}] ${module}:${step}`, logEntry);
    }
  }

  public info(module: string, step: string, metadata?: RAGMetadata) {
    this.output('INFO', module, step, metadata);
  }

  public error(module: string, step: string, error: Error | any, metadata?: RAGMetadata) {
    this.output('ERROR', module, step, { ...metadata, error_message: error?.message || String(error) });
  }

  public async trackTime<T>(
    module: string, 
    step: string, 
    fn: () => Promise<T>, 
    metadata?: RAGMetadata
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.output('INFO', module, step, metadata, Number(duration.toFixed(2)));
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.output('ERROR', module, step, { ...metadata, error_message: String(error) }, Number(duration.toFixed(2)));
      throw error;
    }
  }

  public recordTTFT(startTime: number, metadata?: Partial<TTFTMetadata>) {
    const duration = performance.now() - startTime;
    this.output('INFO', 'LLM', 'TTFT', { ...metadata, ttft_ms: Number(duration.toFixed(2)) }, Number(duration.toFixed(2)));
  }

  public logTokenUsage(metadata: TokenMetadata) {
    this.output('INFO', 'LLM', 'TokenUsage', metadata);
  }
  public logVectorization(duration: number, metadata: VectorMetadata) {
    this.output('INFO', 'Vector', 'Embedding', metadata, duration);
  }

  public logQueryRewrite(duration: number, metadata: QueryRewriteMetadata) {
    this.output('INFO', 'QueryRewrite', 'Rewrite', metadata, duration);
  }
}

export const logger = new Logger();
