import Link from "next/link";
import { ArrowRight, FileText, MessagesSquare, ListChecks } from "lucide-react";
import { Brand } from "@/components/ui";
import { DemoButton } from "@/components/welcome";
import { ExperimentPreview } from "@/components/experiment-preview";
import { OrbitScene } from "@/components/orbit-scene";
import { agentCatalog, aiRoles } from "@/lib/domain/ai";
import { emptySection } from "@/lib/domain/completion";
import { generateRoadmap } from "@/lib/domain/roadmap";
import { sectionKeys, sectionSchemas } from "@/lib/domain/schemas";
import { demoProfile, demoStrategy } from "@/server/demo";

const exampleSections = sectionKeys.map(key => ({ ...emptySection(key), data: sectionSchemas[key].parse(demoStrategy[key]) }));
const exampleTask = generateRoadmap(demoProfile, exampleSections).find(task => task.ruleKey === "icp-interviews")!;

export default function Welcome() {
  return <div className="app-surface welcome">
    <section className="hero" aria-labelledby="hero-title">
      <OrbitScene className="hero-scene"/>
      <header className="hero-bar"><Brand/><nav aria-label="Welcome"><a href="#paths">How it works</a><span className="demo-tag"><span className="demo-dot" aria-hidden/>Demo mode</span></nav></header>
      <div className="hero-copy">
        <p className="eyebrow">Go-to-market studio for early-stage founders</p>
        <h1 id="hero-title" tabIndex={-1}>Five decisions.<br/>Your first 30 days.</h1>
        <p className="lead">Tell us about your startup in your own words or answer a guided brief, attach the deck you already have, and get a reviewed strategy draft and a 30-day plan you can act on.</p>
        <div className="hero-actions">
          <Link href="/startups/new" className="button primary">Create startup<ArrowRight size={17} aria-hidden className="arrow"/></Link>
          <DemoButton/>
        </div>
        <p className="hero-note">Demo mode · no login · synthetic, non-sensitive data</p>
      </div>
      <a className="hero-scroll" href="#paths" aria-label="Scroll to how it works"><span/></a>
    </section>

    <main id="content">
      <section className="paths" id="paths" aria-labelledby="paths-title">
        <div className="section-intro"><p className="eyebrow">Two ways in</p><h2 id="paths-title">Start the way you think.</h2></div>
        <div className="path-grid">
          <article className="path-card">
            <MessagesSquare size={22} aria-hidden/>
            <h3>Free form</h3>
            <p>Write it the way you would explain it to a cofounder. If something important is missing, a short conversation asks for it — seven questions at most, none if you already covered it.</p>
          </article>
          <article className="path-card">
            <ListChecks size={22} aria-hidden/>
            <h3>Guided brief</h3>
            <p>Precise choices where the answer is a choice, short open questions where it is a thought. Every option set is complete, so you never force your startup into a box.</p>
          </article>
          <article className="path-card quiet">
            <FileText size={22} aria-hidden/>
            <h3>Bring what you have</h3>
            <p>Attach a pitch deck, notes or a one-pager on either path. Your material is read alongside your answers, and everything stays a draft until you confirm it.</p>
          </article>
        </div>
      </section>

      <section className="agents" aria-labelledby="agents-title">
        <div className="section-intro"><p className="eyebrow">Then, while you keep working</p><h2 id="agents-title">Six specialists review your brief.</h2>
          <p className="lead">Each step is real work you can inspect: sources, proposals and the critic’s objections. You apply what you agree with, section by section.</p></div>
        <ol className="agent-track">{aiRoles.map((role, i) => <li key={role}><span className="agent-n num">{String(i + 1).padStart(2, "0")}</span><h3>{agentCatalog[role].name}</h3><p>{agentCatalog[role].description}</p></li>)}</ol>
        <p className="field-help agents-note">Without AI access the same journey runs on transparent rules, and it says so.</p>
      </section>

      <section className="trace" aria-labelledby="trace-title">
        <div className="section-intro"><p className="eyebrow">Why every task exists</p><h2 id="trace-title">A saved problem becomes a test, not a to-do.</h2></div>
        <ExperimentPreview name={demoProfile.name} buyer={demoProfile.customerSegment} pain={demoStrategy.icp.painPoint} task={exampleTask}/>
      </section>

      <section className="welcome-honest" aria-labelledby="honest-title">
        <h2 id="honest-title" className="sr-only">What this is and isn’t</h2>
        <div className="honest-is"><p className="eyebrow">What it is</p><ul><li>A structured workspace for your go-to-market decisions</li><li>Reviewed drafts and a transparent 30-day plan</li><li>A shareable link that keeps your work</li></ul></div>
        <div className="honest-isnt"><p className="label">What it isn’t</p><ul><li>Proof that your assumptions are right</li><li>A decision made for you</li><li>A place for sensitive data</li></ul></div>
      </section>
    </main>
    <footer className="welcome-footer"><p className="field-help">Built for the Black Orbit ecosystem · independent prototype · synthetic data only</p></footer>
  </div>;
}
