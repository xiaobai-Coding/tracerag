import { createResultStreamer } from "../utils/utils";
import { logger } from "../utils/logger";
import { countTokens } from "../utils/tokenCounter"; // Assuming we have this or similar

// 从环境变量中读取配置
const getConfig = () => ({
    apiKey: import.meta.env.VITE_AI_API_KEY || "",
    // apiKey: "",
    apiBaseUrl: import.meta.env.VITE_AI_API_BASE_URL || "https://api.deepseek.com",
    appTitle: import.meta.env.VITE_APP_TITLE || "DeepSeek AI聊天",
    debug: import.meta.env.VITE_APP_DEBUG === "true",
    model: "deepseek-chat",
    temperature: 0.3 // 控制回复的随机性
  });

const config = getConfig();

  // 极简 + 正确版：只流式输出 JSON 里的 result 字段
type StreamResult = {
  message: { role: string; content: string | null; tool_calls?: any[] };
  content: string;
  debug_reasoning: string | null;
  tool_calls?: any[];
  raw?: string;
};
/**
 * 流式输出 JSON 里的 result 字段
 * @param userMessages 用户消息
 * @param _showDebugReasoning 是否显示推理内容
 * @param onPartialResponse 部分响应回调
 * @returns StreamResult
 */
export const streamDeepSeekAPI = async (
  userMessages: any[],
  _showDebugReasoning: boolean = false, // 保留签名，暂未使用
): Promise<StreamResult> => {
   
    const useServerApi = import.meta.env.VITE_USE_SERVER_API === "true";

    const endpoint = `${config.apiBaseUrl}/chat/completions`;
    const requestBody = {
      model: config.model,
      messages: userMessages,
      temperature: config.temperature,
      // stream: true
    };
  
    // 2. 发送请求
    return await logger.trackTime('LLM', 'StreamRequest', async () => {
        const startTime = performance.now();
        // 估算 Input Tokens (粗略)
        const inputTokens = userMessages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 3; // 粗略估算

        const response = await fetch('/api/ai', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-client-token": "tracerag-web"
            // Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
        });
    
        if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorText}`);
        }
    
        if (!response.body) {
        throw new Error("未能获取到可读的响应流 (response.body 为空)");
        }
        
        // TTFT: 首字延迟记录 (此处实际上是首包延迟，因为我们用的是 fetch)
        // 在流式场景下，如果使用 reader 读取第一个 chunk，那才是真正的 TTFT
        // 但由于当前实现是等待整个 JSON 返回 (非真流式)，所以 TTFT 等同于整个请求耗时
        // 如果改成真流式，需要在 reader.read() 第一次返回时记录
        
        // 鉴于当前逻辑是等待完整 JSON，我们记录为 TTFT
        logger.recordTTFT(startTime, { prompt_tokens: Math.round(inputTokens) });

        const data = await response.json();
        // console.log('data....', data)
        const choices = data?.choices?.[0]?.message?.content;
        if (!choices) {
            throw new Error("Invalid model response");
        }
    
        // 尝试清理 Markdown 标记（例如 ```json ... ```）
        const jsonStr = choices.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
        
        // Output Tokens 估算
        const outputTokens = choices.length / 3;
        
        logger.logTokenUsage({
            input_tokens: Math.round(inputTokens),
            output_tokens: Math.round(outputTokens),
            total_tokens: Math.round(inputTokens + outputTokens),
            model: config.model
        });

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("Failed to parse model response");
        }
    }, { model: config.model });
  };
