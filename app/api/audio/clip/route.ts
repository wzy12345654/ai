import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_DURATION = 60 * 60;
const EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".webm", ".flac"]);

function run(command: string, args: string[], timeoutMs = 180_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("音频处理超时")); }, timeoutMs);
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(-4000); });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(); else reject(new Error(stderr || `FFmpeg exited with ${code}`));
    });
  });
}

export async function POST(request: Request) {
  let directory = "";
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const start = Number(form.get("start"));
    const end = Number(form.get("end"));
    if (!(audio instanceof File)) return NextResponse.json({ error: "缺少音频文件。" }, { status: 400 });
    if (audio.size <= 0 || audio.size > MAX_BYTES) return NextResponse.json({ error: "音频文件必须小于 100 MB。" }, { status: 413 });
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > MAX_DURATION || end - start < 0.1) {
      return NextResponse.json({ error: "剪切时间范围无效，请重新选择。" }, { status: 400 });
    }
    const extension = extname(audio.name).toLowerCase();
    if (!audio.type.startsWith("audio/") && !EXTENSIONS.has(extension)) return NextResponse.json({ error: "不支持这个文件格式。" }, { status: 415 });

    directory = await mkdtemp(join(tmpdir(), "linguaflow-"));
    const inputPath = join(directory, `${randomUUID()}${EXTENSIONS.has(extension) ? extension : ".audio"}`);
    const outputPath = join(directory, `${randomUUID()}.mp3`);
    await writeFile(inputPath, Buffer.from(await audio.arrayBuffer()));
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-i", inputPath, "-t", (end - start).toFixed(3), "-vn", "-map_metadata", "-1", "-codec:a", "libmp3lame", "-q:a", "3", "-y", outputPath]);
    const output = await readFile(outputPath);
    return new Response(output, { status: 200, headers: { "Content-Type": "audio/mpeg", "Content-Disposition": "attachment; filename=learning-clip.mp3", "Content-Length": String(output.byteLength), "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Audio clipping failed:", message);
    if (message.includes("ENOENT")) return NextResponse.json({ error: "服务器暂未安装音频处理组件。" }, { status: 503 });
    return NextResponse.json({ error: "无法剪切该音频，请确认文件可以正常播放后重试。" }, { status: 422 });
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
