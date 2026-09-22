"use client";

import { useMemo, useState } from "react";
import { useInferenceRun } from "@/lib/use-inference-run";

const TEXT_APP = "anthropic/claude-haiku-4-5";
const IMAGE_APP = "xai/grok-imagine-image";

const seedTitles = [
  { tag: "反常识", title: "别再逼孩子报班了，真正拉开差距的从来不是补课", meta: "反常识 · 制造认知冲突" },
  { tag: "情绪共鸣", title: "成年人的崩溃，往往从一句“没事”开始", meta: "情绪共鸣 · 评论区共振" },
  { tag: "经验分享", title: "我把家里这 3 个东西扔掉后，生活突然顺了", meta: "经验分享 · 强实用性" },
  { tag: "犀利观点", title: "月薪 1 万还存不下钱？不是你不会理财，是太爱体面", meta: "犀利观点 · 敢于对立" },
  { tag: "生活方式", title: "不买大房、不生二胎，我的 35 岁反而更自由了", meta: "生活方式 · 价值选择" },
  { tag: "热点借势", title: "最近刷屏的“松弛感”，可能只是另一种自我安慰", meta: "热点借势 · 话题延展" },
];

const styles = ["杂志拼贴", "生活方式", "极简留白", "复古胶片"];

export default function Page() {
  const [topic, setTopic] = useState("");
  const [titles, setTitles] = useState(seedTitles);
  const [selected, setSelected] = useState(0);
  const [copy, setCopy] = useState("真正的松弛感，不是朋友圈里那张躺平的照片。\n\n而是你终于接受：有些事，努力了也未必有结果。\n\n最近很流行一个词，叫“松弛感”。大家都在教你慢下来、少内耗、别焦虑。但我想说，很多人不是不会松弛，是根本没有资格松弛。\n\n房贷要还、孩子要养、工作不能丢。你告诉他“别卷了”，他只会在心里翻个白眼。\n\n真正的松弛，是你看清了自己的筹码，依然敢做选择。不是躺平，更不是假装看开。\n\n所以，别再羡慕别人的松弛感了。先把自己的生活，过成不需要向任何人解释的样子。\n\n你觉得呢？");
  const [activeTab, setActiveTab] = useState<"titles" | "copy" | "cover" | "images">("titles");
  const [style, setStyle] = useState(styles[0]);
  const [coverRatio, setCoverRatio] = useState("9:16");
  const [coverHistory, setCoverHistory] = useState<Array<{ id: number; images: string[]; ratio: string; style: string }>>([]);
  const [bodyImages, setBodyImages] = useState<string[]>([]);
  const [bodyCount, setBodyCount] = useState("3");
  const [bodyRatio, setBodyRatio] = useState("1:1");
  const [bodyResolution, setBodyResolution] = useState("1K");
  const { loading: textLoading, error: textError, run: runText } = useInferenceRun();
  const { loading: imageLoading, error: imageError, run: runImage } = useInferenceRun();

  const currentTitle = titles[selected]?.title ?? seedTitles[0].title;
  const wordCount = useMemo(() => copy.replace(/\s/g, "").length, [copy]);

  async function generateTitles() {
    if (!topic.trim()) return;
    try {
      const task = await runText(TEXT_APP, {
        system_prompt: "你是一位资深小红书爆款编辑。请根据用户选题输出6个不同策略的标题，要求去AI味、口语化、有冲突、有评论区讨论空间。只输出JSON数组，每项包含tag,title,meta。",
        text: `选题关键词：${topic}\n请结合当下网络热点生成标题。`,
      });
      const raw = task.output as { response?: string } | null;
      const parsed = raw?.response ? JSON.parse(raw.response.replace(/```json|```/g, "").trim()) : [];
      if (Array.isArray(parsed) && parsed.length) setTitles(parsed.slice(0, 6));
    } catch {
      setTitles(seedTitles);
    }
  }

  async function generateCopy() {
    try {
      const task = await runText(TEXT_APP, {
        system_prompt: "你是小红书爆款文案作者。根据标题写300字左右正文，口语化、有个性、少AI味，在合适位置埋钩子，允许有争议但不要虚构事实。只输出正文。",
        text: currentTitle,
      });
      const raw = task.output as { response?: string } | null;
      if (raw?.response) setCopy(raw.response.replace(/```/g, "").trim());
    } catch {
      // 保留当前编辑内容
    }
    setActiveTab("copy");
  }

  async function generateCover() {
    try {
      const task = await runImage(IMAGE_APP, { prompt: `小红书爆款封面，标题“${currentTitle}”，${style}风格，强视觉冲突，中文排版留出标题区域，${coverRatio}比例。请生成一张完整封面。`, aspect_ratio: coverRatio, n: 1, quality: "low", resolution: "1K" });
      const output = task.output as { images?: string[]; image?: string } | null;
      const generated = output?.images?.filter(Boolean) ?? (output?.image ? [output.image] : []);
      if (generated.length) setCoverHistory((history) => [{ id: Date.now(), images: generated, ratio: coverRatio, style }, ...history]);
    } catch {
      // 保留历史生成结果，避免一次失败清空画布
    }
    setActiveTab("cover");
  }

  async function generateBodyImages() {
    try {
      const count = Number(bodyCount);
      const generated: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const task = await runImage(IMAGE_APP, { prompt: `小红书正文配图，第 ${i + 1} 张。标题“${currentTitle}”，正文内容：${copy}。${style}风格，画面不要添加文字，突出生活化细节与情绪氛围。`, aspect_ratio: bodyRatio, n: 1, quality: "low", resolution: bodyResolution });
        const output = task.output as { images?: string[]; image?: string } | null;
        const url = output?.images?.[0] ?? output?.image;
        if (url) generated.push(url);
      }
      if (generated.length) setBodyImages((history) => [...generated, ...history]);
    } catch {
      // 保留已有正文配图
    }
    setActiveTab("images");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">◎</span><span>爆文实验室</span><span className="beta">BETA</span></div>
        <nav><button className="nav-active">创作台</button><button>灵感库</button><button>我的作品</button></nav>
        <div className="top-actions"><button className="icon-button">⌘</button><button className="avatar">林</button></div>
      </header>

      <section className="hero"><div><p className="eyebrow">XIAOHONGSHU CONTENT STUDIO</p><h1>把灵感，变成<br /><em>让人停下来的内容。</em></h1><p className="hero-sub">从一个关键词开始，生成有态度、有钩子、有人味的爆款内容。</p></div><div className="hero-note"><span>●</span><div><strong>今日灵感</strong><p>真正的松弛感，是你不再向任何人证明自己。</p></div></div></section>

      <section className="workspace">
        <aside className="steps"><div className="step-label">创作流程</div>{[["01", "选题与标题", "从一个关键词开始"], ["02", "正文创作", "让观点自然流动"], ["03", "视觉配图", "让内容更有记忆点"]].map(([num, title, desc], i) => <button key={num} className={`step ${i === (activeTab === "titles" ? 0 : activeTab === "copy" ? 1 : 2) ? "step-active" : ""}`} onClick={() => setActiveTab(i === 0 ? "titles" : i === 1 ? "copy" : "cover")}><span className="step-num">{num}</span><span><b>{title}</b><small>{desc}</small></span><span className="step-arrow">→</span></button>)}<div className="tip-card"><span>✦</span><p>小提示<br /><b>敢于表达不完美，反而更容易被记住。</b></p></div></aside>

        <div className="editor-area">
          <div className="editor-head"><div><span className="section-kicker">STEP 01 / TOPIC</span><h2>先找到那个，值得被讨论的角度。</h2></div><span className="status-pill"><i /> AI 已就绪</span></div>
          <div className="topic-input"><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="输入你的选题关键词，例如：职场松弛感、独居生活..." onKeyDown={(e) => e.key === "Enter" && generateTitles()} /><button onClick={generateTitles} disabled={textLoading}>{textLoading ? "分析中…" : "生成标题 →"}</button></div>
          {textError && <p className="error-text">{textError}</p>}

          <div className="results-head"><div><span className="section-kicker">为你生成的 6 个方向</span><h3>挑一个，让它先发声。</h3></div><button className="ghost-button" onClick={generateTitles}>↻ 换一批</button></div>
          <div className="title-grid">{titles.map((item, i) => <button key={`${item.title}-${i}`} className={`title-card ${selected === i ? "selected" : ""}`} onClick={() => setSelected(i)}><div className="card-top"><span className="tag">{item.tag}</span><span className="radio">{selected === i ? "✓" : ""}</span></div><strong>{item.title}</strong><span className="card-meta">{item.meta}</span></button>)}</div>

          <div className="chosen-bar"><div><span>已选择标题</span><strong>“{currentTitle}”</strong></div><button onClick={generateCopy}>进入正文创作 <span>→</span></button></div>

          <div className="lower-tabs"><button className={activeTab === "copy" ? "tab-active" : ""} onClick={() => setActiveTab("copy")}>正文创作</button><button className={activeTab === "cover" ? "tab-active" : ""} onClick={() => setActiveTab("cover")}>封面图</button><button className={activeTab === "images" ? "tab-active" : ""} onClick={() => setActiveTab("images")}>正文配图</button></div>
          {activeTab === "copy" && <div className="copy-panel"><div className="panel-head"><div><span className="section-kicker">STEP 02 / COPY</span><h3>{currentTitle}</h3></div><button className="outline-button" onClick={generateCopy}>{textLoading ? "生成中…" : "↻ 重写"}</button></div><textarea value={copy} onChange={(e) => setCopy(e.target.value)} /><div className="copy-footer"><span>{wordCount} 字 · 小红书风格</span><button onClick={() => setCopy(copy.replace(/\n/g, "\n\n"))}>轻微改写 →</button></div></div>}
          {activeTab === "cover" && <div className="visual-panel"><div className="style-row"><span className="section-kicker">封面风格</span>{styles.map((s) => <button key={s} className={style === s ? "style-active" : ""} onClick={() => setStyle(s)}>{s}</button>)}</div><div className="style-row ratio-row"><span className="section-kicker">比例</span><button className={coverRatio === "9:16" ? "style-active" : ""} onClick={() => setCoverRatio("9:16")}>9:16 竖版</button><button className={coverRatio === "4:3" ? "style-active" : ""} onClick={() => setCoverRatio("4:3")}>4:3 横版</button></div><div className="generate-row"><div><strong>生成 2 张封面</strong><small>默认 1K · 低质量 · 快速生成</small></div><button className="generate-image" onClick={generateCover} disabled={imageLoading}><span className="sparkle">✦</span>{imageLoading ? "正在生成…" : "开始生成封面"}<span>→</span></button></div>{imageError && <p className="error-text">{imageError}</p>}<div className="cover-preview">{imageUrl ? <img src={imageUrl} alt="AI生成封面" /> : <><span>✦</span><p>选择风格后，生成两张不同构图的封面</p><small>确认风格与比例后开始生成</small></>}</div></div>}
          {activeTab === "images" && <div className="empty-panel"><span>✦</span><h3>让正文里的画面，也被看见。</h3><p>生成与全文内容呼应的配图，默认 1K 低分辨率。</p><button className="outline-button" onClick={() => setActiveTab("cover")}>先去生成封面 →</button></div>}
        </div>
      </section>
      <footer className="footer"><span>© 2024 爆文实验室</span><span>用内容，和世界发生一点有趣的摩擦。</span></footer>
    </main>
  );
}
