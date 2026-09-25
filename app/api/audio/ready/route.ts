import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOST = "luffy-agent-platform.oss-cn-beijing.aliyuncs.com";
const ALLOWED_PREFIX = "/inference-media/";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    if (!body.url) return NextResponse.json({ error: "缺少媒体地址" }, { status: 400 });
    const url = new URL(body.url);
    if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST || !url.pathname.startsWith(ALLOWED_PREFIX)) {
      return NextResponse.json({ error: "媒体地址不合法" }, { status: 400 });
    }

    // R2 上传完成后会异步同步到模型可访问的 OSS。服务端轮询不受浏览器 CORS 限制。
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: { Range: "bytes=0-0" },
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok || response.status === 206) {
          await response.body?.cancel();
          // 给不同区域的识别 worker 再留出少量传播时间。
          await sleep(3000);
          return NextResponse.json({ ready: true });
        }
      } catch {
        // 未同步或短暂网络错误，继续等待。
      }
      await sleep(3000);
    }
    return NextResponse.json({ error: "音频同步超时，请稍后重试" }, { status: 504 });
  } catch {
    return NextResponse.json({ error: "无法检查音频状态" }, { status: 400 });
  }
}
