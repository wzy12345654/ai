type FileRecord = { uri?: string; upload_url?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilReadable(uri: string) {
  // 对象存储 PUT 成功后，媒体代理可能需要短暂时间同步；避免推理任务立即读取时得到 404。
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch(uri, { method: "HEAD", credentials: "include", cache: "no-store" });
      if (response.ok) return;
    } catch {
      // 同步期间继续轮询。
    }
    await sleep(500 * (attempt + 1));
  }
  throw new Error("音频上传后暂时无法读取，请稍后重试。");
}

/**
 * 通过 luffy proxy 调 inference.sh /files 拿预签名 upload_url, 再浏览器端直传 R2.
 * 返回 inference 侧识别的 uri (传给 runInference 的 image/audio 等 file 字段).
 * 手写 fetch 拿到的是原始 envelope ({success,status,data}), 自己取 .data.
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
  if (!record?.upload_url || !record.uri) {
    throw new Error("上传准备失败: 没有拿到 upload_url / uri");
  }

  const put = await fetch(record.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`上传文件失败: ${put.statusText || put.status}`);
  await waitUntilReadable(record.uri);
  return record.uri;
}
