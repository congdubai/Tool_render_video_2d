/**
 * Định nghĩa các kiểu dữ liệu cho toàn bộ ứng dụng dựng video 2D
 */

// Cấu hình giọng đọc TTS
export interface VoiceConfig {
  provider: "edge" | string;
  name: string;
  rate?: string;
}

// Metadata trong file script.json
export interface ScriptMeta {
  width: number;
  height: number;
  fps: number;
  music?: string | null;
  musicVolume?: number;
  fadeSeconds?: number;
  voice: VoiceConfig;
  externalVoice?: string | null;
}

// Từng dòng lời đọc trong script.json
export interface ScriptLine {
  id: string;
  narration: string;
  pause?: number; // Mặc định 0.35s
}

// Cấu trúc toàn bộ file script.json
export interface ScriptData {
  meta: ScriptMeta;
  lines: ScriptLine[];
}

// Mốc thời gian từng từ (nếu TTS hỗ trợ hoặc chia đều)
export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

// Từng dòng trong timeline.json
export interface TimelineLine {
  id: string;
  start: number;
  end: number;
  voiceEnd: number;
  audio: string;
  words: WordTimestamp[] | null;
}

// Cấu trúc toàn bộ file timeline.json
export interface TimelineData {
  totalSeconds: number;
  lines: TimelineLine[];
}

// Cấu hình chuyển động camera
export interface CameraConfig {
  zoom?: [number, number]; // [bắt đầu, kết thúc] ví dụ [1, 1.08]
  pan?: [number, number];  // [dịch X, dịch Y] theo tỉ lệ khung hình
}

// Cấu hình nhân vật xuất hiện trong cảnh (Hỗ trợ cả static image và Character System V2)
export interface CharacterConfig {
  image?: string;       // Đường dẫn trong public/ (vd: characters/ngac-nhien.png)
  characterId?: string; // ID nhân vật từ Character Library V2 (vd: "chibi_max", "chibi_jake")
  pose?: string;        // Tên tư thế: stand, walk, run, sit, wave, point, talk...
  expression?: string;  // Tên biểu cảm: neutral, happy, sad, angry, surprised, thinking...
  facing?: string;      // Hướng nhìn: front, three_quarter_right, three_quarter_left, side_right...
  enterAt?: number;     // Giây xuất hiện tính từ đầu cảnh (mặc định 0)
  x?: number;           // Vị trí tâm ngang 0-1 (mặc định 0.5)
  baseY?: number;       // Mép dưới theo chiều cao khung 0-1 (mặc định 0.8)
  height?: number;      // Chiều cao theo tỉ lệ khung (mặc định 0.5)
  bob?: boolean;        // Nhấp nhô nhẹ sau khi xuất hiện (mặc định true)
  flip?: boolean;       // Lật ngang ảnh (mặc định false)
}

// Lớp tiền cảnh (foreground) vẽ đè lên nhân vật
export interface ForegroundConfig {
  image: string;       // Đường dẫn trong public/
  x?: number;          // Mặc định 0.5
  baseY?: number;      // Mặc định 0.8
  height?: number;     // Mặc định 0.5
}

// Cấu hình một cảnh trong scenes.json
export interface SceneItem {
  id: string;
  start: number;
  end: number;
  line?: string;
  bg: string;
  camera?: CameraConfig;
  character?: CharacterConfig | null;
  foreground?: ForegroundConfig | null;
}

// Cấu trúc toàn bộ file scenes.json
export interface ScenesData {
  scenes: SceneItem[];
}

// InputProps truyền vào Remotion Composition
export interface VideoCompositionProps extends Record<string, unknown> {
  scriptData: ScriptData;
  timelineData: TimelineData;
  scenesData: ScenesData;
}
