import { CircleDashed } from "lucide-react";
import type { TaskSuggestion } from "@/lib/domain/roadmap";

/** A static trace: saved problem → rule → task → evidence. Readable without JavaScript; the task comes from the real rules. */
export function ExperimentPreview({ name, buyer, pain, task }: { name: string; buyer: string; pain: string; task: TaskSuggestion }) {
  return <figure className="trace-figure" aria-labelledby="preview-caption">
    <figcaption id="preview-caption"><span>{name} example</span><span className="trace-tag">Synthetic · not validated</span></figcaption>
    <ol className="trace-steps">
      <li><span className="label">Saved problem</span>
        <blockquote>“{pain}”</blockquote>
        <p className="trace-meta">{buyer} <span className="preview-untested"><CircleDashed size={13} aria-hidden/>Untested</span></p></li>
      <li><span className="label">Rule fired</span><p>{task.rationale}</p></li>
      <li><span className="label">Week {task.week} · suggested experiment</span><h3>{task.title}</h3></li>
      <li><span className="label">Evidence to collect</span><p>Five interview notes: who has the problem, when it happens, and what they use today.</p></li>
    </ol>
  </figure>;
}
