export type ChatMediaKind = "image" | "video" | "document" | "audio";

export const MEDIA_CAPTION_MAX = 1024;

export const MEDIA_MAX_BYTES_BY_KIND: Record<ChatMediaKind, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
};

export const PICKER_ACCEPT = {
  imageVideo: "image/png,image/jpeg,image/webp,video/mp4,video/3gpp",
  document:
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain",
};

const DOCUMENT_MIME_TYPES = new Set(PICKER_ACCEPT.document.split(","));

export function getChatMediaKind(file: File): ChatMediaKind | null {
  if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp") return "image";
  if (file.type === "video/mp4" || file.type === "video/3gpp") return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (DOCUMENT_MIME_TYPES.has(file.type)) return "document";
  return null;
}

export function getChatMediaSizeLimit(file: File): number | null {
  const kind = getChatMediaKind(file);
  return kind ? MEDIA_MAX_BYTES_BY_KIND[kind] : null;
}
