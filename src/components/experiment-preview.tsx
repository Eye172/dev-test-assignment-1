import { CircleDashed } from "lucide-react";
import type { TaskSuggestion } from "@/lib/domain/roadmap";

/** Static, accessible sample. Its task is selected by the same rules as a real roadmap. */
export function ExperimentPreview({ name, buyer, pain, task }: { name: string; buyer: string; pain: string; task: TaskSuggestion }) {
  return <figure className="experiment-preview" aria-labelledby="preview-caption">
    <figcaption id="preview-caption"><span>{name} example</span><span>Synthetic · not validated</span></figcaption>
    <div className="preview-input">
      <div className="preview-heading"><span className="label">Ideal customer</span><span className="preview-untested"><CircleDashed size={14} aria-hidden/>Untested</span></div>
      <blockquote>“{pain}”</blockquote>
      <p className="preview-buyer">{buyer}</p>
    </div>
    <div className="preview-connection">
      <svg viewBox="0 0 64 54" fill="none" aria-hidden="true"><path pathLength="1" d="M12 1v22a12 12 0 0 0 12 12h27m-8-8 8 8-8 8"/></svg>
      <p>{task.rationale}</p>
    </div>
    <div className="preview-task">
      <div className="preview-heading"><span className="preview-week">Week {task.week}</span><span className="label">Suggested experiment</span></div>
      <h2>{task.title}</h2>
      <div className="preview-evidence"><span className="label">Evidence to collect</span><p>Five interview notes: who has the problem, when it happens, and what they use today.</p></div>
    </div>
  </figure>;
}
