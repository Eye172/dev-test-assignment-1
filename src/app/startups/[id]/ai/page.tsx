import { AiStudio } from "@/components/ai-studio";
export const metadata = { title: "AI specialists" };
export default function AiPage() {
  return <div className="ai-page">
    <div className="page-heading"><div><p className="eyebrow">Reviewed, never automatic</p><h1 tabIndex={-1}>AI specialists</h1>
      <p className="lead">Six roles research, draft and criticise your strategy. Nothing changes until you apply it, section by section, and nothing is called validated.</p></div></div>
    <AiStudio/>
  </div>;
}
