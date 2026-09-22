"use client";

import { useState } from "react";
import { useInferenceRun } from "@/lib/use-inference-run";

// 默认 app + 字段名来自 infsh 发现/验证 (plan Task C1), 不要凭记忆改.
const APP = "xai/grok-imagine-image";

export default function Page() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { loading, error, run } = useInferenceRun();

  async function onGenerate() {
    try {
      const task = await run(APP, { prompt, aspect_ratio: "1:1", n: 1 });
      const output = task.output as { images?: string[] } | null;
      setImageUrl(output?.images?.[0] ?? null);
    } catch {
      // 错误已由 useInferenceRun 落进 error 状态, 这里吞掉避免 unhandled rejection
    }
  }

  return (
    <div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="描述要生成的图片"
      />
      <button type="button" onClick={onGenerate} disabled={loading || !prompt}>
        {loading ? "生成中..." : "生成图片"}
      </button>
      {error ? <p>{error}</p> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imageUrl ? <img src={imageUrl} alt="generated" /> : null}
    </div>
  );
}
