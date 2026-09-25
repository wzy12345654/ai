type FileRecord = { uri?: string; upload_url?: string; remote_path?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 通过 luffy proxy 调 inference.sh /files 拿预签名 upload_url, 再浏览器端直传 R2.
 * 返回 inference 侧可直接识别的对象 URL。
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
    body: JSON.stringify({
      files: [{
        uri: "",
        filename: file.name || "upload.bin",
        content_type: file.type || "application/octet-stream",
        size: file.size,
      }],
    }),
  });
  if (!create.ok) {
    const text = await create.text();
    throw new Error(`上传准备失败 ${create.status}: ${text.slice(0, 200)}`);
  }
  const payload = (await create.json()) as { data?: FileRecord[] };
  const record = payload.data?.[0];
  if (!record?.upload_url || !record.uri) throw new Error("上传准备失败: 没有拿到上传地址");

  const put = await fetch(record.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`上传文件失败: ${put.statusText || put.status}`);

  // 不在浏览器探测媒体 URL：最终 OSS 重定向未开放 CORS，会制造多条无意义的
  // 控制台错误。PUT 已成功后仅留出对象存储传播时间，再把最终公开地址交给模型。
  await sleep(1800);
  if (record.remote_path) {
    return `https://luffy-agent-platform.oss-cn-beijing.aliyuncs.com/inference-media/${record.remote_path}`;
  }
  return record.uri;
}
