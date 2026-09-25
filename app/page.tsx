"use client";

import { useState } from "react";
import { useInferenceRun } from "@/lib/use-inference-run";

// 默认 app + 字段名来自 infsh app get 真实核验, 不要凭记忆改.
const APP = "anthropic/claude-haiku-4-5";

// 需要结构化结果 (表格/打分/分类) 时: 在 system_prompt 里规定 JSON 字段,
// 输出再用 parseJsonLoose 容错解析. 语义判断一律交给大模型完成,
// 禁止退化成关键词/正则规则 —— 规则在真实数据上必然失真.
const SYSTEM_PROMPT = `你是文本分析助手。只输出 JSON, 不要 markdown 代码块, 格式:
{"summary": "一句话总结", "sentiment": "正面|中性|负面", "keywords": ["关键词"]}`;

/** 容错解析模型输出: 剥掉可能的 ```json 围栏, 截取首尾大括号之间的部分. */
function parseJsonLoose<T>(raw: string): T | null {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

type Analysis = { summary?: string; sentiment?: string; keywords?: string[] };

export default function Page() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);
  const { loading, error, run } = useInferenceRun();

  async function onAnalyze() {
    try {
      // 不传 stream (走 app 默认 true): Anthropic 上游对大 max_tokens 的非流式请求直接报错
      const task = await run(APP, { text, system_prompt: SYSTEM_PROMPT });
      const output = task.output as { response?: string } | null;
      setResult(parseJsonLoose<Analysis>(output?.response ?? ""));
    } catch {
      // 错误已由 useInferenceRun 落进 error 状态
    }
  }

  return (
    <div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴要分析的文本" />
      <button type="button" onClick={onAnalyze} disabled={loading || !text}>
        {loading ? "分析中..." : "开始分析"}
      </button>
      {error ? <p>{error}</p> : null}
      {result ? (
        <div>
          <p>总结: {result.summary}</p>
          <p>情感: {result.sentiment}</p>
          <p>关键词: {result.keywords?.join("、")}</p>
        </div>
      ) : null}
    </div>
  );
}
