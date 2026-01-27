/**
 * 创建一个通用的 JSON 流式解析器，支持同时监听多个 key
 * @param onValue 回调函数，接收 (key, valueChunk)
 * @param targetKeys 要监听的 JSON 键名数组
 */
export const createMultiKeyStreamer = (
    onValue: (key: string, chunk: string) => void,
    targetKeys: string[] = ["result"]
) => {
    // 状态机定义
    type State =
        | "searchingKey"
        | "afterKey"
        | "waitingValue"
        | "inStringValue"
        | "inArrayValue" // 简单处理数组：只透传字符，不深度解析
        | "inObjectValue" // 简单处理对象
        | "nullValue";

    // 内部状态
    let state: State = "searchingKey";
    let currentKeyMatchIndex = 0;
    let matchedKey: string | null = null;
    
    // 用于匹配 targetKeys 中的任意一个
    // 简单的 Trie 或逐个匹配逻辑
    // 鉴于 keys 数量很少，我们只需记录当前匹配的字符数
    // 但因为可能是 "summary" vs "something_else"，逐字符匹配比较复杂
    // 简化逻辑：每次 buffer 足够长时检查是否匹配某个 key
    // 或者：状态机只寻找 `"` -> 读取 key -> `"` -> 检查是否在 targetKeys 中
    
    // 重新设计状态机：
    // 1. SEEK_KEY_START: 寻找 `"`
    // 2. READING_KEY: 读取 key 字符串
    // 3. CHECK_KEY: 检查 key 是否在 targetKeys 中
    // 4. SEEK_COLON: 寻找 `:`
    // 5. SEEK_VALUE_START: 寻找值开始 (`, [, {, t, f, n, 0-9, -)
    // 6. READING_VALUE: 读取值并回调

    let bufferState: "SEEK_KEY_START" | "READING_KEY" | "SEEK_COLON" | "SEEK_VALUE_START" | "READING_STRING" | "READING_OTHER" = "SEEK_KEY_START";
    let keyBuffer = "";
    let escapeNext = false;
    let currentActiveKey: string | null = null;
    
    // 辅助：处理 unicode 转义
    let inUnicode = false;
    let unicodeBuff = "";
    
    // 嵌套层级计数（用于 READING_OTHER，如数组/对象）
    let nestLevel = 0; 
    
    const handleChar = (char: string) => {
        if (escapeNext) {
            escapeNext = false;
            // 如果在读取字符串值，则透传
            if (bufferState === "READING_STRING" && currentActiveKey) {
                 // 处理转义字符的输出
                 // 简单透传：直接输出转义后的原字符，或者反转义？
                 // 通常流式输出给前端展示时，前端希望看到的是反转义后的字符（如换行符）
                 // 这里复用之前的 handleEscapedChar 逻辑
                 handleEscapedValueChar(char);
            } else if (bufferState === "READING_KEY") {
                keyBuffer += char; // key 中的转义暂不特殊处理，假设 key 都是简单字符
            }
            return;
        }

        if (char === "\\") {
            escapeNext = true;
            return;
        }

        switch (bufferState) {
            case "SEEK_KEY_START":
                if (char === '"') {
                    bufferState = "READING_KEY";
                    keyBuffer = "";
                }
                break;

            case "READING_KEY":
                if (char === '"') {
                    // Key 读取完毕
                    if (targetKeys.includes(keyBuffer)) {
                        currentActiveKey = keyBuffer;
                        bufferState = "SEEK_COLON";
                    } else {
                        currentActiveKey = null;
                        bufferState = "SEEK_COLON"; // 依然要找冒号和值，以便跳过
                    }
                } else {
                    keyBuffer += char;
                }
                break;

            case "SEEK_COLON":
                if (char === ':') {
                    bufferState = "SEEK_VALUE_START";
                }
                break;

            case "SEEK_VALUE_START":
                if (/\s/.test(char)) return; // 跳过空白
                if (char === '"') {
                    bufferState = "READING_STRING";
                } else if (char === '[' || char === '{') {
                    bufferState = "READING_OTHER";
                    nestLevel = 1;
                    if (currentActiveKey) onValue(currentActiveKey, char);
                } else {
                    // 数字、true/false/null
                    bufferState = "READING_OTHER";
                    nestLevel = 0; // 这些是标量，遇到 ,Or } 结束
                    if (currentActiveKey) onValue(currentActiveKey, char);
                }
                break;

            case "READING_STRING":
                if (char === '"') {
                    bufferState = "SEEK_KEY_START"; // 字符串值结束，回到寻找下一个 Key
                    currentActiveKey = null;
                } else {
                    if (currentActiveKey) onValue(currentActiveKey, char);
                }
                break;

            case "READING_OTHER":
                // 简单处理非字符串值：数组/对象/数字等
                // 这里只做简单透传，直到遇到该值的结束符
                // 实际上对于流式打字机，我们主要关注 string 类型的值
                // 如果是 array/object，我们可能只是透传原始 JSON 文本
                if (currentActiveKey) onValue(currentActiveKey, char);
                
                if (char === '{' || char === '[') nestLevel++;
                if (char === '}' || char === ']') nestLevel--;
                
                // 结束条件判断（简化版）
                if (nestLevel === 0 && (char === ',' || char === '}' || char === ']')) {
                    // 注意：这里可能会多输出一个逗号或括号，但在流式展示中通常不影响
                    // 严谨做法是 lookahead，但流式无法 lookahead
                    bufferState = "SEEK_KEY_START";
                    currentActiveKey = null;
                }
                break;
        }
    };

    // 复用之前的转义处理逻辑
    const handleEscapedValueChar = (char: string) => {
        if (!currentActiveKey) return;
        let decoded = char;
        switch (char) {
            case 'n': decoded = '\n'; break;
            case 't': decoded = '\t'; break;
            case 'r': decoded = '\r'; break;
            case 'b': decoded = '\b'; break;
            case 'f': decoded = '\f'; break;
            case '"': decoded = '"'; break;
            case '\\': decoded = '\\'; break;
            case '/': decoded = '/'; break;
            case 'u': 
                // unicode 处理略复杂，这里暂略，实际流中很少被截断在 u 中间
                // 如果需要支持，需要引入 inUnicode 状态
                decoded = ''; // 暂不支持流式中的 \uXXXX 转义解码，直接丢弃或原样输出
                // 更好的做法是保留 \uXXXX 原样，让前端渲染去处理，或者引入完整 unicode 缓冲
                break;
        }
        if (decoded) onValue(currentActiveKey, decoded);
    };

    return {
        handleChunk: (chunk: string) => {
            for (const char of chunk) {
                handleChar(char);
            }
        },
        finalize: () => {
            // cleanup
        }
    };
};

// 保持 createResultStreamer 向后兼容，但在内部使用 createMultiKeyStreamer
export const createResultStreamer = (onPartialResponse?: (chunk: string) => void, targetKey: string = "result") => {
    const streamer = createMultiKeyStreamer((key, chunk) => {
        if (key === targetKey && onPartialResponse) {
            onPartialResponse(chunk);
        }
    }, [targetKey]);
    
    return streamer;
};
