import AudioClipper from "./components/audio-clipper";

const stages = [
  { number: "01", title: "剪切音频", detail: "选取学习片段", active: true },
  { number: "02", title: "提取内容", detail: "生成英文原文" },
  { number: "03", title: "内容翻译", detail: "生成中英对照" },
  { number: "04", title: "教学音频", detail: "定制学习模式" },
];

export default function Page() {
  return <main className="site-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="LinguaFlow 首页"><span className="brand-mark">L</span><span><b>Lingua</b>Flow</span></a><div className="top-note"><span className="status-dot" />英语听力学习工作台</div></header>

    <section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><span>LISTEN</span><i /> <span>UNDERSTAND</span><i /> <span>LEARN</span></div><h1>把长音频，变成<br /><em>刚刚好的学习片段</em></h1><p>从你真正关心的几分钟开始。剪切、理解、翻译，再生成专属的双语教学音频。</p></div><div className="hero-note"><span>本阶段</span><strong>先完成音频剪切</strong><p>不识别内容，不调用 AI<br />等你验收后再进入下一步</p></div></section>

    <nav className="stage-nav" aria-label="学习音频制作流程">{stages.map((stage, index) => <div className={`stage-item ${stage.active ? "active" : "locked"}`} key={stage.number}><div className="stage-number">{stage.active ? stage.number : "⌑"}</div><div><strong>{stage.title}</strong><span>{stage.detail}</span></div>{index < stages.length - 1 && <i className="stage-line" />}</div>)}</nav>

    <AudioClipper />

    <section className="future-section"><div className="future-heading"><span>接下来</span><h2>一段音频，逐步变成一堂听力课</h2><p>后续阶段已经为学习流程留好位置，本轮暂不开放。</p></div><div className="future-grid"><article><span className="future-icon">Aa</span><small>STEP 02 · 待开放</small><h3>提取英文内容</h3><p>将选中音频转为可编辑的英文原文，并提供文本下载。</p><b>等待本阶段验收后开放</b></article><article><span className="future-icon">译</span><small>STEP 03 · 待开放</small><h3>生成中文翻译</h3><p>逐句形成中英对照，方便理解语境、表达和句型。</p><b>等待内容提取完成</b></article><article><span className="future-icon">♪</span><small>STEP 04 · 待开放</small><h3>制作教学音频</h3><p>按你的模式组合中英文、语速、重复与单词讲解。</p><b>核心学习功能 · 后续开发</b></article></div></section>

    <section className="privacy-banner"><span>◈</span><div><strong>这一次练习，只属于当前页面</strong><p>无需登录，不保存项目。刷新页面后，原音频和剪切结果将被重置。</p></div></section>
    <footer><div className="brand footer-brand"><span className="brand-mark">L</span><span><b>Lingua</b>Flow</span></div><span>少一点负担，多听懂一句。</span><span>Stage 01 · Audio clipping</span></footer>
  </main>;
}
