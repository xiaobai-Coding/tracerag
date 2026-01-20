import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
import { scanInjectionRisk } from "./_utils/scanInjectionRisk.js";
import { logger } from "../src/utils/logger.js"; // 确保路径正确，可能需要调整 tsconfig 或打包配置

interface RequestBody {
  texts: string[];
  purpose?: "query" | "doc";
}

interface SuccessResponse {
  status: "ok";
  data: { embeddings: number[][] };
  meta: {
    provider: string;
    model: string;
    hasInjectionRisk: boolean;
    flaggedIndexes: number[];
    requestId: string;
  };
}

interface ErrorResponse {
  status: "error";
  code:
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "RATE_LIMITED"
    | "UPSTREAM_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  requestId: string;
}
/**
 * ========= 简单内存限流 =========
 * 每个 IP 每分钟最多 20 次
 */
const rateLimitMap = new Map<string, number[]>();

function normalizeIp(raw?: string | undefined) {
  if (!raw) return "unknown";
  // x-forwarded-for may contain a comma-separated list, take the first entry
  const first = raw.split(",")[0].trim();
  // strip IPv6 bracket/port or trailing port if present
  const noBracket = first.replace(/^\[(.*)\](:\d+)?$/, "$1");
  const noPort = noBracket.replace(/:\d+$/, "");
  if (noPort === "::1") return "127.0.0.1";
  if (noPort.startsWith("::ffff:")) return noPort.replace("::ffff:", "");
  return noPort;
}

// 限流函数，用于检查IP是否超过限制
async function checkRateLimit(ip: string) {
  const windowSeconds = 60; // 时间窗：60 秒
  const limit = 10; // 限制次数
  const key = `rate_limit:${ip}`;

  // 原子自增
  const count = await kv.incr(key);

  // 第一次请求，设置过期时间
  if (count === 1) {
    await kv.expire(key, windowSeconds);
  }

  if (count > limit) {
    return false;
  }

  return true;
}
// 生成请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 验证请求体
function validateRequest(body: any): { isValid: boolean; error?: string } {
  if (!body || typeof body !== "object") {
    return { isValid: false, error: "请求体必须是JSON对象" };
  }

  if (!Array.isArray(body.texts)) {
    return { isValid: false, error: "texts必须是字符串数组" };
  }

  if (body.texts.length === 0) {
    return { isValid: false, error: "texts不能为空数组" };
  }

  if (body.texts.length > 64) {
    return { isValid: false, error: "texts最多支持64条" };
  }

  for (let i = 0; i < body.texts.length; i++) {
    const text = body.texts[i];
    if (typeof text !== "string") {
      return { isValid: false, error: `texts[${i}]必须是字符串` };
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { isValid: false, error: `texts[${i}]不能为空字符串` };
    }

    if (trimmed.length > 4000) {
      return { isValid: false, error: `texts[${i}]长度不能超过4000字符` };
    }

    // 替换为处理后的文本
    body.texts[i] = trimmed;
  }

  if (body.purpose && !["query", "doc"].includes(body.purpose)) {
    return { isValid: false, error: 'purpose必须是"query"或"doc"' };
  }

  return { isValid: true };
}

// 调用DashScope Embedding API
async function callDashScopeEmbedding(texts: string[]) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY环境变量未设置');

  const model = process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v3';
  const endpoint =
    'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

  const timeoutMs = Number(process.env.DASHSCOPE_TIMEOUT_MS || 15000);

  const BATCH_SIZE = 10;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: { texts: batch },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`上游API错误: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      const embeddings = (result.output?.embeddings || []).map((item: any) => item.embedding);
      if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
        throw new Error('上游API返回embedding数量不匹配');
      }

      allEmbeddings.push(...embeddings);
    } catch (err: any) {
      if (err?.name === 'AbortError') throw new Error(`UPSTREAM_TIMEOUT:${timeoutMs}`);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { embeddings: allEmbeddings, model };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // 1️⃣ 只允许POST方法
    if (request.method !== "POST") {
      const errorResponse: ErrorResponse = {
        status: "error",
        code: "BAD_REQUEST",
        message: "只支持POST方法",
        requestId
      };
      response.status(405).json(errorResponse);
      return;
    }
    // 2️⃣ IP 限流
    const rawIp =
      (request.headers["x-forwarded-for"] as string) ||
      request.socket.remoteAddress ||
      "unknown";
    const ip = normalizeIp(rawIp);
    if (!(await checkRateLimit(ip))) {
      response.status(429).json({
        error: "已经达到请求限制，请稍后再试。"
      });
      return;
    }
    // 3️⃣ 客户端 Token 校验
    const CLIENT_TOKEN = process.env.CLIENT_TOKEN;
    if (!CLIENT_TOKEN) {
      throw new Error("Missing CLIENT_TOKEN");
    }

    const clientToken = request.headers["x-client-token"];

    if (clientToken !== CLIENT_TOKEN) {
      response.status(401).json({
        error: "Unauthorized client"
      });
      return;
    }
    // parse request body
    let body: RequestBody;
    try {
      body = JSON.parse(JSON.stringify(request.body));
    } catch (e) {
      const errorResponse: ErrorResponse = {
        status: "error",
        code: "BAD_REQUEST",
        message: "请求体必须是有效的JSON",
        requestId
      };
      response.status(400).json(errorResponse);
      return;
    }

    // 验证请求体
    const validation = validateRequest(body);
    if (!validation.isValid) {
      const errorResponse: ErrorResponse = {
        status: "error",
        code: "BAD_REQUEST",
        message: validation.error!,
        requestId
      };
      response.status(400).json(errorResponse);
      return;
    }

    // 扫描注入风险
    const injectionResult = scanInjectionRisk(body.texts);

    // 调用DashScope API
    const { embeddings, model } = await callDashScopeEmbedding(body.texts);
    const duration = Date.now() - startTime;
    
    // 使用新的 Logger 输出结构化日志
    logger.info("API", "Embedding", {
      requestId,
      purpose: body.purpose || "unknown",
      texts_count: body.texts.length,
      duration_ms: duration,
      hasInjectionRisk: injectionResult.hasRisk
    });

    // 成功响应
    const successResponse: SuccessResponse = {
      status: "ok",
      data: { embeddings },
      meta: {
        provider: "dashscope",
        model,
        hasInjectionRisk: injectionResult.hasRisk,
        flaggedIndexes: injectionResult.flaggedIndexes,
        requestId
      }
    };

    response.status(200).json(successResponse);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("API", "EmbeddingFailed", error, { requestId, duration_ms: duration });

    let code: ErrorResponse["code"] = "INTERNAL_ERROR";
    let message = "内部服务器错误";
    let statusCode = 500;

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      if (
        errorMessage.includes("环境变量") ||
        errorMessage.includes("api key")
      ) {
        code = "INTERNAL_ERROR"; // 不暴露配置问题
        message = "服务配置错误";
      } else if (
        errorMessage.includes("上游api错误") ||
        errorMessage.includes("上游api返回")
      ) {
        code = "UPSTREAM_ERROR";
        message = "向量化服务暂时不可用";
        statusCode = 502;
      } else {
        code = "INTERNAL_ERROR";
        message = "处理请求时发生错误";
      }
    }

    const errorResponse: ErrorResponse = {
      status: "error",
      code,
      message,
      requestId
    };

    response.status(statusCode).json(errorResponse);
  }
}
