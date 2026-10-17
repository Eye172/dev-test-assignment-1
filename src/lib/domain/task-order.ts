import type { Task } from "./types";

/** Stable prerequisite order; historical malformed cycles keep a finite order. */
export function orderTasks(tasks:Task[]):Task[] {
  const sorted=[...tasks].sort((a,b)=>a.week-b.week), output:Task[]=[], visiting=new Set<string>(),done=new Set<string>();
  const visit=(task:Task)=>{
    if(done.has(task.id)||visiting.has(task.id))return;
    visiting.add(task.id);
    for(const key of task.experiment?.dependsOn||[]){
      const dependency=sorted.find(t=>t.experiment?.key===key&&t.week<=task.week);
      if(dependency)visit(dependency);
    }
    visiting.delete(task.id);done.add(task.id);output.push(task);
  };
  sorted.forEach(visit);return output;
}
