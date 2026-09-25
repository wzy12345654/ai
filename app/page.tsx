import LearningWorkbench from "./components/learning-workbench";

export default function Page() {
  return <main className="site-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="LinguaFlow 首页"><span className="brand-mark">L</span><span><b>Lingua</b>Flow</span></a><div className="top-note"><span className="status-dot" />英语听力学习工作台</div></header>

    <section className="hero" id="top"><div className="hero-copy"><div className="eyebrow"><span>LISTEN</span><i /> <span>UNDERSTAND</span><i /> <span>LEARN</span></div><h1>听见声音，也看清<br /><em>每一句英文</em></h1><p>按需选取学习片段，或直接使用完整音频，再生成可以校对、保存和反复学习的英文原文。</p></div><div className="hero-note"><span>当前开放</span><strong>可选剪切 + 提取内容</strong><p>使用选区或完整音频<br />识别英文并下载文本</p></div></section>

    <LearningWorkbench />

    <section className="privacy-banner"><span>◈</span><div><strong>这一次练习，只属于当前页面</strong><p>无需登录，不保存项目。刷新页面后，音频和识别结果将被重置。</p></div></section>
    <footer><div className="brand footer-brand"><span className="brand-mark">L</span><span><b>Lingua</b>Flow</span></div><span>少一点负担，多听懂一句。</span><span>Stage 02 · English transcription</span></footer>
  </main>;
}
