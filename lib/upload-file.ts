/**
 * 将待识别音频临时上传到本站，由稳定的同源下载端点提供给 STT worker。
 * 文件仅保存在 /tmp，30 分钟后过期；避免平台代理文件在 R2→OSS 同步期间返回 404。
 */
export async function uploadFileThroughProxy(file: File): Promise<string> {
  const body = new FormData();
  body.append("audio", file);
  const response = await fetch("/api/audio/source", { method: "POST", body });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "音频上传失败，请稍后重试");
  }
  const payload = await response.json() as { path?: string };
  if (!payload.path) throw new Error("音频上传失败：没有下载地址");
  return new URL(payload.path, window.location.origin).toString();
}
