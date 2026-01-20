import type { ChatMessage } from "../types/qa";
import { REWRITE_PROMPT} from "../prompts/prompt"
import { logger } from "./logger";

/**
 * 调用后端 /api/ai，对当前用户问题进行「独立检索词」改写。
 * - 消除代词指代、补全语义，使其可以单轮检索
 * - 如果判断为纯闲聊/寒暄，则返回 "NO_SEARCH_NEEDED"
 */
export async function getStandaloneQuery(
  history: ChatMessage[],
  currentQuery: string
): Promise<string> {
  const question = currentQuery.trim();
  if (!question) return "NO_SEARCH_NEEDED";

  // 简单本地规则：明显的纯打招呼/感谢，直接跳过检索，减少一次模型调用
  const smallTalkPatterns = [/^你好[。！!]*$/i, /^hi$/i, /^hello$/i, /^谢谢[。！!]*$/i];
  if (smallTalkPatterns.some((re) => re.test(question))) {
    logger.info("QueryRewriter", "SmallTalkDetected", { original_query: question });
    return "NO_SEARCH_NEEDED";
  }

  return await logger.trackTime('QueryRewrite', 'Rewrite', async () => {
    const historyText =
        history && history.length
        ? history
            .map((m, idx) => {
                const prefix = m.role === "user" ? "user" : "assistant";
                return `${idx + 1}. ${prefix}：${m.content}`;
            })
            .join("\n")
        : "（无）";

    const userPrompt = `

    【对话历史（Chat History）】
    ${historyText}

    【当前用户问题 （Current Query）】
    ${question}
    `.trim();

    const requestBody = {
        messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: userPrompt },
        ],
        // 标记不需要流式，只要一次性响应；temperature 在服务端也会设置为较低值
        stream: false,
        temperature: 0.1,
    };

    const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        "x-client-token": "tracerag-web",
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const text = await response.text();
        logger.error('QueryRewriter', 'ApiError', new Error(text), { status: response.status });
        // 出错时保底：直接用原始问题做检索
        return question;
    }

    const data = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
        logger.error('QueryRewriter', 'InvalidContent', new Error("AI Content is empty"));
        return question;
    }

    const rewritten = content.trim().replace(/^["']|["']$/g, "");
    
    // Log Metadata inside the tracker will be handled by the logger if we could return it
    // But since trackTime returns T, we can log extra info here or rely on the return value wrapper
    // We can also use logger.info to log the result
    logger.logQueryRewrite(0, { original_query: question, rewritten_query: rewritten }); // Duration is 0 here as placeholder, trackTime logs the duration separately

    return rewritten || question;
  }, { original_query: question, rewritten_query: 'PENDING' }); // Initial metadata
}

