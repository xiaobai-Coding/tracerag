/**
 * 文档切片对象
 */
export interface Chunk {
  id: string;         // 唯一标识符，如 "chunk-1", "chunk-2"
  index: number;      // 显示用的下标，如 1, 2, 3...
  text: string;       // 切片内容
  startPos: number;   // 在原文档中的起始位置
  endPos: number;      // 在原文档中的结束位置
}

/**
 * Overlap 重叠切片
 * @param text 输入文本
 * @param chunkSize 每个切片最大长度
 * @param overlapSize 上下重叠长度
 */
export function splitIntoChunksWithOverlap(
    text: string,
    chunkSize: number = 400,
    overlapSize: number = 80
  ): Chunk[] {
    if (!text || chunkSize <= 0) return [];

    const result: Chunk[] = [];
    const cleaned = text.trim().replace(/\s+/g, " "); // 简单清洗

    let start = 0;
    let chunkIndex = 1;

    while (start < cleaned.length) {
      const end = Math.min(start + chunkSize, cleaned.length);
      const chunkText = cleaned.slice(start, end);

      if (chunkText.length >= 20) {
        result.push({
          id: `chunk-${chunkIndex}`,
          index: chunkIndex,
          text: chunkText,
          startPos: start,
          endPos: end
        });
        chunkIndex++;
      }

      start += chunkSize - overlapSize; // 往前走但保留部分重叠
    }

    return result;
  }

  // 一个生成随机id的函数 
  function toreadom (){
    return 
  }