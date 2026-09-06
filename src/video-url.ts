export function parseDroppedVideoUrl(uriList: string, text: string): string {
  const links = uriList.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#"));
  return parseVideoUrl(links.length ? links.join("\n") : text);
}

export function parseVideoUrl(value: string): string {
  const clean = value.trim();
  if (!clean) {
    throw new Error("กรุณาระบุลิงก์วิดีโอ");
  }
  // Check for concatenated URLs in path or directly appended after video parameter
  if (
    (clean.split(/[?#]/, 1)[0].match(/https?:\/\//gi) || []).length > 1 ||
    /(?:watch\?v=[^&]+|video\/\d+|youtu\.be\/[^?&]+)https?:\/\//i.test(clean) ||
    /https?:\/\/[^\s]+https?:\/\//i.test(clean.replace(/[?&](?:url|next|redirect|link|dest|target)=https?:\/\/[^&]*/gi, ""))
  ) {
    throw new Error("พบลิงก์ซ้อนกัน กรุณาวางลิงก์วิดีโอเพียงอันเดียว");
  }
  try {
    const url = new URL(clean);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /\s/.test(clean)) {
      throw new Error();
    }
  } catch {
    throw new Error("วางลิงก์วิดีโอที่ขึ้นต้นด้วย https:// หรือ http://");
  }
  return clean;
}
