// api/ai.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { kv } from "@vercel/kv";
// env requireds: AI_API_KEY, AI_API_BASE_URL
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
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

import { logger } from "../src/utils/logger.js";
// Vercel API handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1️⃣ 方法校验
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2️⃣ 获取 Locale
  const locale = (req.headers["accept-language"] || "zh") as string;

  return await logger.runWithTrace(async () => {
    // 3️⃣ IP 限流
    const rawIp =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "unknown";
    const ip = normalizeIp(rawIp);
    if (!(await checkRateLimit(ip))) {
      return res.status(429).json({
        error: "已经达到请求限制，请稍后再试。"
      });
    }
    // 4️⃣ 客户端 Token 校验
    const CLIENT_TOKEN = process.env.CLIENT_TOKEN;

    if (!CLIENT_TOKEN) {
      throw new Error("Missing CLIENT_TOKEN");
    }

    const clientToken = req.headers["x-client-token"];

    if (clientToken !== CLIENT_TOKEN) {
      return res.status(401).json({
        error: "Unauthorized client"
      });
    }
    // 5️⃣ 参数校验
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid request body: messages is required"
      });
    }

    // 6️⃣ 读取服务端 Key
    const API_KEY = requireEnv("AI_API_KEY");
    const API_BASE_URL = requireEnv("AI_API_BASE_URL");
    
    // 检查是否请求流式
    const isStream = req.body.stream === true;

    try {
      // 7️⃣ 转发请求到 DeepSeek
      const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          temperature: 0.2,
          stream: isStream // 动态控制
        })
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error("API", "DeepSeekError", new Error(text));
        return res.status(502).json({
          error: "AI service error",
          details: text
        });
      }

      // 如果开启了流式，建立 SSE 通道
      if (isStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // Vercel Serverless 环境下可能需要刷新头部
        res.flushHeaders?.(); 

        if (!response.body) {
          throw new Error("No response body from upstream");
        }

        // @ts-ignore
        for await (const chunk of response.body) {
          res.write(chunk);
        }
        
        res.end();
        return;
      }

      // 非流式情况，保持原有逻辑
      const data = await response.json();
      return res.status(200).json(data);

    } catch (err) {
      logger.error("API", "AIRequestFailed", err);
      return res.status(500).json({
        error: "Internal Server Error"
      });
    }
  }, undefined, locale);
}
