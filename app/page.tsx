"use client";

import { useRef, useState } from "react";
import { useInferenceRun } from "@/lib/use-inference-run";
import { uploadFileThroughProxy } from "@/lib/upload-file";

const STT_APP = "elevenlabs/stt";
const TRANSLATE_APP = "anthropic/claude-haiku-4-5";
const TRANSLATE_PROMPT = `你是专业英语翻译助手。请将输入的英文转写内容翻译为自然、准确、通顺的简体中文。只输出 JSON，不要 markdown 代码块，格式为 {"translation":"中文翻译"}。保留原文的段落结构和说话语气，不要添加解释。`;

type View = { id: number; source: string; translation: string };

function parseTranslation(raw: string) {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return (JSON.parse(cleaned.slice(start, end + 1)) as { translation?: string }).translation || raw; } catch { /* use raw */ }
  }
  return raw;
}

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [views, setViews] = useState<View[]>([]);
  const [copied, setCopied] = useState(false);
  const stt = useInferenceRun();
  const translator = useInferenceRun();
  const loading = stt.loading || translator.loading;

  async function translateAudio() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const audioUri = await uploadFileThroughProxy(file);
      const sttTask = await stt.run(STT_APP, { audio: audioUri });
      const source = String((sttTask.output as { text?: string } | null)?.text || "").trim();
      if (!source) throw new Error("没有识别到有效的语音内容");
      const translationTask = await translator.run(TRANSLATE_APP, { text: source, system_prompt: TRANSLATE_PROMPT });
      const raw = String((translationTask.output as { response?: string } | null)?.response || "").trim();
      setViews([{ id: Date.now(), source, translation: parseTranslation(raw) }]);
    } catch { /* errors are displayed by the hooks */ }
  }

  const error = stt.error || translator.error;
  const current = views[0];
  const outputText = current ? `${current.source}\n\n${current.translation}` : "";

  async function copyResult() {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">文</span><span>LinguaFlow</span></div>
        <div className="topbar-note"><span className="status-dot" /> AI 语音翻译</div>
      </header>

      <section className="hero">
        <div className="eyebrow"><span>EN</span><span className="arrow">→</span><span>中</span> 音频翻译工作台</div>
        <h1>让每一句话，<em>清晰相遇</em></h1>
        <p>上传英语音频，AI 将为你提取内容并生成精准的中英文对照文本。</p>
      </section>

      <section className="workspace">
        <div className="panel upload-panel">
          <div className="panel-head"><div><span className="step">01</span><h2>上传音频</h2></div><span className="format-hint">MP3 · WAV · M4A</span></div>
          <input ref={fileRef} className="file-input" type="file" accept="audio/*" disabled={loading} onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
          <button className={`dropzone ${fileName ? "has-file" : ""}`} type="button" onClick={() => fileRef.current?.click()} disabled={loading}>
            <span className="upload-icon">↑</span>
            {fileName ? <><strong>{fileName}</strong><small>点击重新选择文件</small></> : <><strong>点击选择或拖入音频文件</strong><small>支持最大 100 MB</small></>}
          </button>
          <button className="primary-btn" type="button" disabled={loading || !fileName} onClick={translateAudio}>
            <span>{loading ? "正在处理…" : "开始翻译"}</span><span className="btn-arrow">→</span>
          </button>
          {error && <div className="error-box">{error}</div>}
          <div className="privacy"><span>✦</span> 你的音频仅用于本次处理，我们不会保存原始文件</div>
        </div>

        <div className="panel result-panel">
          <div className="panel-head"><div><span className="step">02</span><h2>中英对照</h2></div>{current && <button className="copy-btn" onClick={copyResult}>{copied ? "已复制 ✓" : "复制全文 ⧉"}</button>}</div>
          {!current && !loading && <div className="empty-state"><div className="empty-art"><span>中</span><i>EN</i></div><strong>翻译结果将在这里呈现</strong><p>上传一段英语音频<br />开始你的第一次翻译</p></div>}
          {loading && <div className="empty-state processing"><div className="loader" /><strong>{stt.loading ? "正在识别音频内容…" : "正在生成中文翻译…"}</strong><p>通常需要几秒钟，请耐心等待</p></div>}
          {current && !loading && <div className="comparison"><div className="language-label"><span className="lang-tag en">EN</span><span>English transcript</span></div><div className="text-block source-text">{current.source}</div><div className="divider" /><div className="language-label"><span className="lang-tag zh">中</span><span>中文翻译</span></div><div className="text-block translation-text">{current.translation}</div></div>}
        </div>
      </section>
      <footer><span>LINGUAFLOW <b>·</b> SIMPLE TRANSLATION</span><span>为沟通，少一点距离。</span></footer>
    </main>
  );
}
