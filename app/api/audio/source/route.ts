import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = join("/tmp", "linguaflow-stt");
const MAX_BYTES = 100 * 1024 * 1024;
const TTL_MS = 30 * 60 * 1000;
const SAFE_ID = /^[a-f0-9-]{36}\.[a-z0-9]{2,5}$/;
const MIME: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".flac": "audio/flac", ".webm": "audio/webm" };

async function cleanupExpired() {
  await mkdir(ROOT, { recursive: true });
  const entries = await readdir(ROOT).catch(() => []);
  const now = Date.now();
  await Promise.all(entries.map(async (name) => {
    if (!SAFE_ID.test(name)) return;
    const path = join(ROOT, name);
    const info = await stat(path).catch(() => null);
    if (info && now - info.mtimeMs > TTL_MS) await rm(path, { force: true });
  }));
}

export async function POST(request: Request) {
  await cleanupExpired();
  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "缺少音频文件" }, { status: 400 });
  if (audio.size <= 0 || audio.size > MAX_BYTES) return NextResponse.json({ error: "音频文件必须小于 100 MB" }, { status: 413 });
  const extension = extname(audio.name).toLowerCase();
  if (!MIME[extension]) return NextResponse.json({ error: "不支持该音频格式" }, { status: 415 });
  const id = `${randomUUID()}${extension}`;
  await writeFile(join(ROOT, id), Buffer.from(await audio.arrayBuffer()));
  return NextResponse.json({ path: `/api/audio/source?id=${encodeURIComponent(id)}` });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!SAFE_ID.test(id)) return NextResponse.json({ error: "文件地址无效" }, { status: 400 });
  const path = join(ROOT, id);
  const info = await stat(path).catch(() => null);
  if (!info || Date.now() - info.mtimeMs > TTL_MS) {
    await rm(path, { force: true }).catch(() => undefined);
    return NextResponse.json({ error: "音频已过期" }, { status: 404 });
  }
  const data = await readFile(path);
  return new Response(data, { headers: {
    "Content-Type": MIME[extname(id)] || "application/octet-stream",
    "Content-Length": String(data.byteLength),
    "Cache-Control": "private, max-age=300",
    "Accept-Ranges": "bytes",
  } });
}
