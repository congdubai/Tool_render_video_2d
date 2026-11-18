import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/BeVietnamPro";
import type { TimelineData, ScriptData, WordTimestamp } from "../types";

// Tải phông chữ Be Vietnam Pro hỗ trợ đầy đủ tiếng Việt có dấu
let beVietnamProFamily = "sans-serif";
try {
  const fontData = loadFont();
  beVietnamProFamily = fontData.fontFamily;
} catch (e) {
  beVietnamProFamily = "Arial, sans-serif";
}

interface SubtitlesProps {
  timelineData: TimelineData;
  scriptData: ScriptData;
}

interface SubtitleWord extends WordTimestamp {
  pageIndex: number;
  _used?: boolean;
}

interface SubtitlePage {
  pageIndex: number;
  start: number;
  end: number;
  lines: string[][]; // Mảng các dòng, mỗi dòng là mảng các từ
  words: SubtitleWord[];
}

export const Subtitles: React.FC<SubtitlesProps> = ({ timelineData, scriptData }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Lấy ánh xạ lời đọc từ scriptData
  const scriptMap = useMemo(() => {
    return new Map((scriptData.lines || []).map((l) => [l.id, l.narration]));
  }, [scriptData]);

  // Xây dựng danh sách các trang phụ đề (Pages)
  const pages = useMemo(() => {
    const allPages: SubtitlePage[] = [];
    const timelineLines = timelineData.lines || [];

    for (const tLine of timelineLines) {
      const text = scriptMap.get(tLine.id) || "";
      if (!text.trim()) continue;

      const rawWords = text.trim().split(/\s+/).filter(Boolean);
      if (rawWords.length === 0) continue;

      // 1. Chuẩn hóa mốc thời gian từng từ
      let wordTimestamps: WordTimestamp[] = [];
      if (tLine.words && tLine.words.length > 0) {
        wordTimestamps = tLine.words.map((w) => ({
          text: w.text,
          start: tLine.start + w.start,
          end: tLine.start + w.end
        }));
      } else {
        // Nếu không có words, chia đều theo số lượng từ trong khoảng giọng đọc
        const voiceDuration = Math.max(0.1, (tLine.voiceEnd || tLine.end) - tLine.start);
        const count = rawWords.length;
        wordTimestamps = rawWords.map((w, idx) => ({
          text: w,
          start: Number((tLine.start + (idx / count) * voiceDuration).toFixed(3)),
          end: Number((tLine.start + ((idx + 1) / count) * voiceDuration).toFixed(3))
        }));
      }

      // 2. Chia thành các dòng (tối đa 28 ký tự/dòng) và trang (tối đa 2 dòng/trang)
      const MAX_LINE_CHARS = 28;
      const MAX_LINES_PER_PAGE = 2;

      let currentPageWords: SubtitleWord[] = [];
      let currentLine: string[] = [];
      let currentLineCharCount = 0;
      let currentPageLines: string[][] = [];

      const flushCurrentPage = () => {
        if (currentLine.length > 0) {
          currentPageLines.push([...currentLine]);
          currentLine = [];
          currentLineCharCount = 0;
        }
        if (currentPageWords.length > 0) {
          const pageStart = currentPageWords[0].start;
          const pageEnd = currentPageWords[currentPageWords.length - 1].end + 0.15;
          allPages.push({
            pageIndex: allPages.length,
            start: pageStart,
            end: pageEnd,
            lines: [...currentPageLines],
            words: [...currentPageWords]
          });
          currentPageWords = [];
          currentPageLines = [];
        }
      };

      for (let i = 0; i < rawWords.length; i++) {
        const wordText = rawWords[i];
        const wordTiming = wordTimestamps[i] || {
          text: wordText,
          start: tLine.start,
          end: tLine.voiceEnd || tLine.end
        };

        const wordLen = wordText.length + 1; // Tính cả dấu cách
        if (currentLineCharCount + wordLen > MAX_LINE_CHARS && currentLine.length > 0) {
          // Xuống dòng mới
          currentPageLines.push([...currentLine]);
          currentLine = [];
          currentLineCharCount = 0;

          // Nếu đã đủ 2 dòng trong 1 trang -> ngắt trang mới
          if (currentPageLines.length >= MAX_LINES_PER_PAGE) {
            flushCurrentPage();
          }
        }

        currentLine.push(wordText);
        currentLineCharCount += wordLen;
        currentPageWords.push({
          ...wordTiming,
          text: wordText,
          pageIndex: allPages.length
        });
      }

      // Kết thúc dòng của câu
      flushCurrentPage();
    }

    return allPages;
  }, [timelineData, scriptMap]);

  // Tìm trang phụ đề đang kích hoạt tại currentTime
  const activePage = pages.find((p) => currentTime >= p.start && currentTime <= p.end);

  if (!activePage) {
    return null;
  }

  // Tạo map từ để kiểm tra trạng thái đọc
  const wordMap = new Map(activePage.words.map((w) => [w.text + "_" + w.start, w]));

  return (
    <div
      style={{
        position: "absolute",
        bottom: "60px",
        left: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 40px",
        boxSizing: "border-box",
        zIndex: 50,
        pointerEvents: "none"
      }}
    >
      <div
        style={{
          fontFamily: `${beVietnamProFamily}, Arial, sans-serif`,
          fontSize: "42px",
          fontWeight: 800,
          lineHeight: 1.4,
          textTransform: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px"
        }}
      >
        {activePage.lines.map((lineWords, lineIdx) => (
          <div
            key={lineIdx}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "10px"
            }}
          >
            {lineWords.map((word, wIdx) => {
              // Tìm timing của từ này trong trang
              const matchedWord = activePage.words.find(
                (w) => w.text === word && !w._used
              );
              if (matchedWord) {
                // Đánh dấu tạm để tránh trùng lặp từ giống nhau trong câu
                (matchedWord as any)._used = true;
              }

              const wStart = matchedWord ? matchedWord.start : 0;
              const wEnd = matchedWord ? matchedWord.end : 0;

              // Xác định trạng thái của từ:
              // Đang đọc: currentTime nằm trong khoảng [wStart, wEnd] -> màu vàng
              // Đã đọc xong: currentTime > wEnd -> màu trắng
              // Chưa đọc tới: currentTime < wStart -> màu trắng
              const isCurrent = currentTime >= wStart && currentTime <= wEnd;

              return (
                <span
                  key={wIdx}
                  style={{
                    color: isCurrent ? "#FFEB3B" : "#FFFFFF",
                    transform: isCurrent ? "scale(1.08)" : "scale(1.0)",
                    transition: "transform 0.1s ease, color 0.1s ease",
                    display: "inline-block",
                    textShadow:
                      "3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0px 4px 6px rgba(0,0,0,0.8)"
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
