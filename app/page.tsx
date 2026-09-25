"use client";

import { useRef, useState } from "react";
import { useInferenceRun } from "@/lib/use-inference-run";
import { uploadFileThroughProxy } from "@/lib/upload-file";

// 默认 app + 字段名来自 infsh app get 真实核验, 不要凭记忆改.
const APP = "elevenlabs/stt";

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const { loading, error, run } = useInferenceRun();

  async function onTranscribe() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const audioUri = await uploadFileThroughProxy(file);
      const task = await run(APP, { audio: audioUri });
      const output = task.output as { text?: string } | null;
      setText(output?.text ?? null);
    } catch {
      // 错误已由 useInferenceRun 落进 error 状态
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="audio/*" disabled={loading} />
      <button type="button" onClick={onTranscribe} disabled={loading}>
        {loading ? "识别中..." : "转文字"}
      </button>
      {error ? <p>{error}</p> : null}
      {text ? <p>{text}</p> : null}
    </div>
  );
}
