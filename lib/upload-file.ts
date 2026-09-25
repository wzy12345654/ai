type FileRecord = { uri?: string; upload_url?: string; remote_path?: string };

/**
 * 通过 luffy proxy 调 inference.sh /files 拿预签名上传地址，浏览器直传 R2；
 * 随后由本站服务端等待模型可访问的 OSS 副本就绪，再返回公共媒体 URL。
 */
export async function uploadFileThroughProxy(file: File): Promise<string> {
  const proxyUrl = process.env.NEXT_PUBLIC_INFERENCE_PROXY_URL;
  if (!proxyUrl) throw new Error("当前环境缺少推理代理 URL");

  const create = await fetch(proxyUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-inf-target-url": "https://api.inference.sh/files",
    },
    body: JSON.stringify({ files: [{
      uri: "",
      filename: file.name || "upload.bin",
      content_type: file.type || "application/octet-stream",
      size: file.size,
    }] }),
  });
  if (!create.ok) {
    const text = await create.text();
    throw new Error(`上传准备失败 ${create.status}: ${text.slice(0, 200)}`);
  }
  const payload = (await create.json()) as { data?: FileRecord[] };
  const record = payload.data?.[0];
  if (!record?.upload_url || !record.remote_path) throw new Error("上传准备失败: 没有拿到上传地址");

  const put = await fetch(record.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`上传文件失败: ${put.statusText || put.status}`);

  const mediaUrl = `https://luffy-agent-platform.oss-cn-beijing.aliyuncs.com/inference-media/${record.remote_path}`;
  const ready = await fetch("/api/audio/ready", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: mediaUrl }),
  });
  if (!ready.ok) {
    const payload = await ready.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "音频同步失败，请稍后重试");
  }
  return mediaUrl;
}
