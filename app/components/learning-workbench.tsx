"use client";

import { useEffect, useRef, useState } from "react";
import AudioClipper, { ClipReadyResult } from "./audio-clipper";
import { useInferenceRun } from "@/lib/use-inference-run";
import { uploadFileThroughProxy } from "@/lib/upload-file";

const STT_APP = "elevenlabs/stt";

const stages = [
  { number: "01", title: "剪切音频", detail: "选取学习片段" },
  { number: "02", title: "提取内容", detail: "生成英文原文" },
  { number: "03", title: "内容翻译", detail: "生成中英对照" },
  { number: "04", title: "教学音频", detail: "定制学习模式" },
];

function transcriptName(audioName: string) {
  return `${audioName.replace(/\.[^.]+$/, "") || "english-transcript"}-transcript.txt`;
}

export default function LearningWorkbench() {
  const extractionRef = useRef<HTMLElement>(null);
  const [clip, setClip] = useState<ClipReadyResult | null>(null);
  const [transcript, setTranscript] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const stt = useInferenceRun();

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);

  function clearTranscript() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl("");
    setTranscript("");
    setClip(null);
  }

  function onClipReady(result: ClipReadyResult) {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setTranscript("");
    setDownloadUrl("");
    setClip(result);
    window.setTimeout(() => extractionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  async function extractContent() {
    if (!clip) return;
    try {
      const audioFile = new File([clip.blob], clip.name, { type: "audio/mpeg" });
      const audioUri = await uploadFileThroughProxy(audioFile);
      const task = await stt.run(STT_APP, { audio: audioUri });
      const text = String((task.output as { text?: string } | null)?.text || "").trim();
      if (!text) throw new Error("没有识别到英文内容，请确认片段中有人声后重试。");
      setTranscript(text);
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(url);
    } catch {
      // useInferenceRun 已记录服务错误；本地校验错误由下方兜底状态呈现。
    }
  }

  function updateTranscript(value: string) {
    setTranscript(value);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(value ? URL.createObjectURL(new Blob([value], { type: "text/plain;charset=utf-8" })) : "");
  }

  async function copyTranscript() {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const extractionDone = Boolean(transcript.trim());
  return <>
    <nav className="stage-nav" aria-label="学习音频制作流程">{stages.map((stage, index) => {
      const state = index === 0 ? (clip ? "complete" : "active") : index === 1 ? (clip ? "active" : "waiting") : "locked";
      return <div className={`stage-item ${state}`} key={stage.number}><div className="stage-number">{state === "complete" ? "✓" : state === "locked" ? "⌑" : stage.number}</div><div><strong>{stage.title}</strong><span>{stage.detail}</span></div>{index < stages.length - 1 && <i className="stage-line" />}</div>;
    })}</nav>

    <AudioClipper onClipReady={onClipReady} onClipCleared={clearTranscript} />

    <section ref={extractionRef} className={`extraction-card ${clip ? "available" : "disabled"}`} aria-labelledby="extract-title">
      <div className="section-title-row"><div><span className="section-kicker">STEP 02 · 当前开发阶段</span><h2 id="extract-title">提取英文内容</h2><p>从剪切后的片段中识别英文，你可以校对、复制并下载文本。</p></div><span className={`stage-badge ${extractionDone ? "complete" : ""}`}>{extractionDone ? "已完成 ✓" : clip ? "可开始" : "等待音频剪切"}</span></div>
      {!clip ? <div className="extract-locked"><span>02</span><strong>先在上方准备学习音频</strong><p>你可以导出选区，也可以跳过剪切直接使用完整音频。</p></div> : <>
        <div className="clip-summary"><div><span className="summary-icon">♫</span><div><small>准备识别的学习片段</small><strong>{clip.name}</strong><span>{clip.durationLabel} · MP3</span></div></div><audio controls src={clip.url} /></div>
        {!extractionDone && <div className="extract-start"><div className="extract-illustration">Aa<span>EN</span></div><div><strong>{stt.loading ? "正在听取并整理英文内容…" : "让我们听懂这段英语"}</strong><p>{stt.loading ? "识别时间取决于音频长度，请保持页面打开。" : "系统只会处理你刚刚剪切的片段。识别完成后可直接校对。"}</p></div><button className="primary-button extract-button" type="button" onClick={extractContent} disabled={stt.loading}>{stt.loading ? <><i className="button-spinner" /> 提取中…</> : <>开始提取英文 <b>→</b></>}</button></div>}
        {stt.error && <div className="error-message" role="alert">!&nbsp; {stt.error}</div>}
        {extractionDone && <div className="transcript-workspace"><div className="transcript-toolbar"><div><span className="lang-pill">EN</span><strong>English transcript</strong><small>{transcript.trim().split(/\s+/).filter(Boolean).length} words · 可直接编辑校对</small></div><div><button type="button" onClick={copyTranscript}>{copied ? "已复制 ✓" : "复制文本"}</button><a href={downloadUrl} download={transcriptName(clip.name)}>↓ 下载 TXT</a></div></div><textarea aria-label="英文识别内容" value={transcript} onChange={(event) => updateTranscript(event.target.value)} spellCheck="true" /><div className="transcript-foot"><span>提示：建议在进入翻译前校对人名、地名和专业词汇。</span><button type="button" onClick={extractContent} disabled={stt.loading}>↻ 重新提取</button></div></div>}
      </>}
    </section>

    <section className="future-section compact"><div className="future-heading"><span>后续阶段</span><h2>把英文原文继续变成你的听力课程</h2><p>内容翻译与教学音频仍保持锁定，等待第二阶段验收。</p></div><div className="future-grid two"><article><span className="future-icon">译</span><small>STEP 03 · 待开放</small><h3>生成中文翻译</h3><p>逐句形成中英对照，方便理解语境、表达和句型。</p><b>等待内容提取验收</b></article><article><span className="future-icon">♪</span><small>STEP 04 · 待开放</small><h3>制作教学音频</h3><p>按你的模式组合中英文、语速、重复与单词讲解。</p><b>核心学习功能 · 后续开发</b></article></div></section>
  </>;
}
