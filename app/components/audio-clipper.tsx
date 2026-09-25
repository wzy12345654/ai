"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { Region } from "wavesurfer.js/dist/plugins/regions.esm.js";

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_DURATION = 60 * 60;
const MIN_DURATION = 0.1;
const ALLOWED_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm", "flac"];

export type ClipReadyResult = { url: string; blob: Blob; name: string; start: number; end: number; durationLabel: string; formatLabel: string };
type ClipResult = ClipReadyResult;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function parseTime(value: string) {
  const text = value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (!/^\d+(?::\d+(?:\.\d+)?){1,2}$/.test(text)) return Number.NaN;
  const parts = text.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return Number.NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number.NaN;
}

function safeDownloadName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "-").trim() || "audio";
  return `${base}-clip.mp3`;
}

export default function AudioClipper({ onClipReady, onClipCleared }: { onClipReady?: (result: ClipReadyResult) => void; onClipCleared?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const loopRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [startInput, setStartInput] = useState("00:00.0");
  const [endInput, setEndInput] = useState("00:00.0");
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loadingWave, setLoadingWave] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ClipResult | null>(null);

  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => () => {
    wavesurferRef.current?.destroy();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
  }, []);

  function clearResult(notify = true) {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
    if (notify) onClipCleared?.();
  }

  function updateSelection(nextStart: number, nextEnd: number, updateRegion = true) {
    if (!duration) return;
    const safeStart = Math.max(0, Math.min(nextStart, duration - MIN_DURATION));
    const safeEnd = Math.max(safeStart + MIN_DURATION, Math.min(nextEnd, duration));
    setStart(safeStart);
    setEnd(safeEnd);
    setStartInput(formatTime(safeStart));
    setEndInput(formatTime(safeEnd));
    if (updateRegion && regionRef.current) regionRef.current.setOptions({ start: safeStart, end: safeEnd });
    clearResult();
  }

  async function loadFile(nextFile: File) {
    setError("");
    clearResult();
    const extension = nextFile.name.split(".").pop()?.toLowerCase() || "";
    if (!nextFile.type.startsWith("audio/") && !ALLOWED_EXTENSIONS.includes(extension)) {
      setError("请选择 MP3、WAV、M4A 等常见音频文件。");
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setError("文件超过 100 MB，请选择更小的音频。");
      return;
    }
    wavesurferRef.current?.destroy();
    wavesurferRef.current = null;
    regionRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    objectUrlRef.current = url;
    setFile(nextFile);
    setDuration(0);
    setStart(0);
    setEnd(0);
    setLoadingWave(true);
    setPlaying(false);

    await new Promise(requestAnimationFrame);
    if (!waveRef.current) return;
    const regions = RegionsPlugin.create();
    const wave = WaveSurfer.create({
      container: waveRef.current,
      height: 122,
      waveColor: "#bed9cc",
      progressColor: "#2d765f",
      cursorColor: "#194f40",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      plugins: [regions],
    });
    wavesurferRef.current = wave;
    wave.on("ready", (seconds) => {
      if (seconds > MAX_DURATION) {
        setError("音频超过 60 分钟，请先压缩或选择较短文件。");
        setLoadingWave(false);
        wave.destroy();
        wavesurferRef.current = null;
        setFile(null);
        return;
      }
      setDuration(seconds);
      setStart(0);
      setEnd(seconds);
      setStartInput(formatTime(0));
      setEndInput(formatTime(seconds));
      regionRef.current = regions.addRegion({ start: 0, end: seconds, color: "rgba(53, 154, 112, .18)", drag: true, resize: true });
      setLoadingWave(false);
    });
    wave.on("error", () => { setError("浏览器无法解码这个音频，请尝试转换为 MP3 或 WAV 后重试。"); setLoadingWave(false); });
    wave.on("play", () => setPlaying(true));
    wave.on("pause", () => setPlaying(false));
    wave.on("finish", () => setPlaying(false));
    regions.on("region-updated", (region) => updateSelection(region.start, region.end, false));
    regions.on("region-out", (region) => {
      if (region.id !== regionRef.current?.id) return;
      if (loopRef.current) region.play(); else { wave.pause(); setPlaying(false); }
    });
    try {
      // 直接加载用户选择的 Blob，避免预览代理环境中 blob: URL 被二次 fetch 时失败。
      await wave.loadBlob(nextFile);
    } catch {
      setError("浏览器无法读取这个音频。请确认文件未损坏，或转换为 MP3、WAV 后重试。");
      setLoadingWave(false);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) void loadFile(selected);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) void loadFile(selected);
  }

  function commitTime(kind: "start" | "end") {
    const parsed = parseTime(kind === "start" ? startInput : endInput);
    if (!Number.isFinite(parsed)) {
      setError("请输入秒数或 mm:ss 格式的时间。");
      setStartInput(formatTime(start)); setEndInput(formatTime(end)); return;
    }
    setError("");
    updateSelection(kind === "start" ? parsed : start, kind === "end" ? parsed : end);
  }

  function playSelection() {
    const wave = wavesurferRef.current;
    const region = regionRef.current;
    if (!wave || !region) return;
    if (wave.isPlaying()) wave.pause(); else region.play();
  }

  function resetSelection() { updateSelection(0, duration); wavesurferRef.current?.seekTo(0); }

  function useFullAudio() {
    if (!file || !duration) return;
    setError("");
    clearResult(false);
    const url = objectUrlRef.current || URL.createObjectURL(file);
    const readyResult: ClipReadyResult = {
      url,
      blob: file,
      name: file.name,
      start: 0,
      end: duration,
      durationLabel: formatTime(duration),
      formatLabel: (file.name.split(".").pop() || "audio").toUpperCase(),
    };
    setResult(readyResult);
    onClipReady?.(readyResult);
  }

  async function exportClip() {
    if (!file || end - start < MIN_DURATION) return;
    setError("");
    setExporting(true);
    clearResult(false);
    try {
      const body = new FormData();
      body.append("audio", file);
      body.append("start", start.toFixed(3));
      body.append("end", end.toFixed(3));
      const response = await fetch("/api/audio/clip", { method: "POST", body });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "剪切失败，请稍后重试。");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      const readyResult: ClipReadyResult = { url, blob, name: safeDownloadName(file.name), start, end, durationLabel: formatTime(end - start) };
      setResult(readyResult);
      onClipReady?.(readyResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "剪切失败，请稍后重试。");
    } finally { setExporting(false); }
  }

  return <section className="clipper-card" aria-labelledby="clipper-title">
    <div className="section-title-row"><div><span className="section-kicker">STEP 01 · 可选剪切</span><h2 id="clipper-title">准备你的学习音频</h2><p>需要时选取片段；不需要剪切，也可以直接使用完整音频。</p></div><span className={`stage-badge ${result ? "complete" : ""}`}>{result ? "已完成 ✓" : "进行中"}</span></div>

    {!file ? <div className={`dropzone ${dragging ? "dragging" : ""}`} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }} onClick={() => inputRef.current?.click()} onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <input ref={inputRef} className="file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={chooseFile} />
      <span className="upload-glyph">↥</span><strong>拖入音频，或点击选择文件</strong><p>MP3、WAV、M4A 等常见格式 · 最大 100 MB · 最长 60 分钟</p><span className="select-file">选择音频文件</span>
    </div> : <>
      <input ref={inputRef} className="file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={chooseFile} />
      <div className="file-strip"><div className="file-icon">♫</div><div className="file-copy"><strong title={file.name}>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB {duration ? `· ${formatTime(duration)}` : "· 正在读取"}</span></div><button type="button" onClick={() => inputRef.current?.click()} disabled={exporting}>更换文件</button></div>
      <div className="wave-card"><div className="wave-toolbar"><span>音频波形</span><span>拖动两侧手柄调整选区</span></div><div className="wave-wrap">{loadingWave && <div className="wave-loading"><i /> 正在解析音频波形…</div>}<div ref={waveRef} /></div><div className="wave-scale"><span>00:00</span><span>{formatTime(duration / 2)}</span><span>{formatTime(duration)}</span></div></div>
      {duration > 0 && <>
        <div className="selection-grid"><label><span>开始时间</span><input value={startInput} onChange={(e) => setStartInput(e.target.value)} onBlur={() => commitTime("start")} onKeyDown={(e) => e.key === "Enter" && commitTime("start")} disabled={exporting} /><small>支持 mm:ss 或秒数</small></label><div className="selection-duration"><span>选区时长</span><strong>{formatTime(end - start)}</strong></div><label><span>结束时间</span><input value={endInput} onChange={(e) => setEndInput(e.target.value)} onBlur={() => commitTime("end")} onKeyDown={(e) => e.key === "Enter" && commitTime("end")} disabled={exporting} /><small>不超过 {formatTime(duration)}</small></label></div>
        <div className="control-row"><button className="play-button" type="button" onClick={playSelection} disabled={exporting}><span>{playing ? "Ⅱ" : "▶"}</span>{playing ? "暂停试听" : "试听选区"}</button><label className="loop-control"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} disabled={exporting} /><span>循环播放</span></label><button className="text-button" type="button" onClick={resetSelection} disabled={exporting}>↺ 重置为完整音频</button></div>
        <div className="export-row"><div><strong>选择进入下一步的方式</strong><span>可以导出当前选区，也可以跳过剪切使用完整音频</span></div><div className="export-actions"><button className="secondary-button" type="button" onClick={useFullAudio} disabled={exporting}>跳过剪切，使用完整音频</button><button className="primary-button" type="button" onClick={exportClip} disabled={exporting}>{exporting ? <><i className="button-spinner" /> 正在剪切…</> : <>导出选区 <b>→</b></>}</button></div></div>
      </>}
    </>}
    {error && <div className="error-message" role="alert">!&nbsp; {error}</div>}
    {result && <div className="result-box"><div className="result-check">✓</div><div className="result-main"><span className="result-label">{result.blob === file ? "已使用完整音频 · 可进入下一步" : "剪切完成 · 可进入下一步"}</span><strong>{result.name}</strong><span>{formatTime(result.start)} — {formatTime(result.end)} · 共 {formatTime(result.end - result.start)}</span><audio controls src={result.url} /></div><div className="result-actions">{result.blob !== file && <a href={result.url} download={result.name}>↓ 下载剪切音频</a>}<button type="button" onClick={() => { clearResult(); window.scrollTo({ top: 330, behavior: "smooth" }); }}>重新选择</button></div></div>}
  </section>;
}
