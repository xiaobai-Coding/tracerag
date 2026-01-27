import { createMultiKeyStreamer } from "../utils/utils";
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
  onPartialResponse?: (chunk: string, key?: string) => void
): Promise<StreamResult> => {
   
    const useServerApi = import.meta.env.VITE_USE_SERVER_API === "true";

    const endpoint = `${config.apiBaseUrl}/chat/completions`;
    const requestBody = {
      model: config.model,
      messages: userMessages,
      temperature: config.temperature,
      stream: true // 强制开启流式
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
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let buffer = "";
        let fullContent = "";
        let isFirstChunk = true;
        
        // 专门用于解析 JSON 响应中的多个字段 (打字机效果)
        // 我们同时监听 result (普通问答), summary (摘要), key_points (摘要关键点), answer (QA问答)
        const multiStreamer = onPartialResponse ? createMultiKeyStreamer((key, chunk) => {
             // 简单的策略：无论哪个字段有更新，都回调
             // 如果需要区分字段，可以修改 onPartialResponse 的签名，或者由调用方解析
             // 但为了保持接口兼容，我们这里直接透传 chunk
             // 对于 summary 场景，key_points 数组的 chunk 也会被透传，前端显示可能会有些乱（显示出JSON片段）
             // 但总比不显示好，且最终会修正
             onPartialResponse(chunk, key);
        }, ["result", "summary", "key_points", "answer"]) : null;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: !done });
                buffer += chunk;
                
                // TTFT 埋点：收到第一个数据包
                if (isFirstChunk) {
                    logger.recordTTFT(startTime, { prompt_tokens: Math.round(inputTokens) });
                    isFirstChunk = false;
                }
            }

            // 处理 SSE 数据流 (data: ...)
            // 兼容 SSE 格式：data: {...} \n\n
            let index: number;
            while ((index = buffer.indexOf("\n\n")) !== -1) {
                const rawEvent = buffer.slice(0, index);
                buffer = buffer.slice(index + 2);

                const line = rawEvent.trim();
                if (!line || !line.startsWith("data:")) continue;

                const dataPayload = line.replace(/^data:\s*/, "");
                if (dataPayload === "[DONE]") {
                    done = true;
                    break;
                }

                try {
                    const parsed = JSON.parse(dataPayload);
                    // DeepSeek 标准格式: choices[0].delta.content
                    const deltaContent = parsed.choices?.[0]?.delta?.content;
                    
                    if (deltaContent) {
                        fullContent += deltaContent;
                        
                        // 流式回调
                        if (multiStreamer) {
                            multiStreamer.handleChunk(deltaContent);
                        } else if (onPartialResponse) {
                             // 如果没有 streamer (说明不需要解析 JSON 里的 result)，直接回调文本
                            onPartialResponse(deltaContent);
                        }
                    }
                } catch (e) {
                    // 忽略解析错误的行（可能是心跳包等）
                }
            }
        }
        
        // 结束时 finalize
        if (multiStreamer) multiStreamer.finalize();

        // Output Tokens 估算
        const outputTokens = fullContent.length / 3;
        
        logger.logTokenUsage({
            input_tokens: Math.round(inputTokens),
            output_tokens: Math.round(outputTokens),
            total_tokens: Math.round(inputTokens + outputTokens),
            model: config.model
        });

        // 尝试解析最终结果为 JSON (兼容旧的 JSON 返回逻辑)
        // 如果 fullContent 是一个 JSON 字符串（例如 {"result": "..."}），我们尝试解析它
        // 如果是纯文本回答，我们构造一个伪 JSON 对象返回
        
        // 尝试清理 Markdown 标记（例如 ```json ... ```）
        const jsonStr = fullContent.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
        console.log('jsonStr:', jsonStr)
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            // 如果解析失败，说明返回的可能就是纯文本答案，或者不完整的 JSON
            // 这种情况下，我们返回一个符合 StreamResult 结构的兜底对象
             return {
                message: { role: "assistant", content: fullContent },
                content: fullContent,
                debug_reasoning: null,
                raw: fullContent
             } as any;
        }
    }, { model: config.model });
  };
