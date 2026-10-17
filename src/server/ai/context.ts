import "server-only";
import type { AiStep } from "@/lib/domain/ai";
import type { AiStore, LeasedRun } from "./store";
import { fingerprint } from "./identity";

/** Role views select from a frozen snapshot. Live business edits never enter an existing run. */
export async function executionInput(store:AiStore,run:LeasedRun,step:AiStep,completed:AiStep[]){
  const startupId=run.snapshot.workspace.startup.id;
  const current=(await store.analysis.findings(startupId)).filter(f=>f.runId===run.id&&f.active);
  const graph=[...run.snapshot.parent.filter(p=>!completed.some(s=>s.role===p.role)).map(p=>p.result),...completed.map(s=>s.result!)];
  const refs=new Set<string>([...current.map(f=>f.id!),...(run.snapshot.memory||[]).filter(m=>["active","accepted"].includes(m.status)).flatMap(m=>m.data.proposal.findingRefs)]);
  const visit=(value:unknown)=>{if(Array.isArray(value)){value.forEach(visit);return;}if(value&&typeof value==="object")for(const [key,v] of Object.entries(value)){if(key==="findingRefs"&&Array.isArray(v))v.forEach(id=>refs.add(String(id)));else visit(v);}};
  for(const result of graph){result.analysis?.findings.forEach(f=>refs.add(f.id!));visit(result);}
  const findings=[...new Map([...(run.snapshot.findings||[]).filter(f=>refs.has(f.id!)),...current].map(f=>[f.id,f])).values()];
  const passageIds=new Set(findings.flatMap(f=>f.passageIds));
  const pages=[...(run.snapshot.pages||[]),...await store.analysis.pages(run.id)];
  const capturedPages=pages.map(p=>({...p,passages:p.passages.filter(x=>passageIds.has(x.id))})).filter(p=>p.passages.length);
  const {workspace,evidence,parent,memory=[]}=run.snapshot;
  const relevant:Record<string,string[]>={intake:[],researcher:["intake","researcher","critic"],strategist:["intake","researcher","strategist","critic"],monetizer:["intake","researcher","strategist","monetizer","critic"],experimenter:["intake","researcher","strategist","monetizer","experimenter","critic"],critic:["intake","researcher","strategist","monetizer","experimenter","critic"]};
  const view=(role:string,result:NonNullable<AiStep["result"]>)=>{
    const a=result.analysis,research=a?.research;
    const detailedResearch=step.role==="researcher"||step.role==="strategist"||step.role==="critic";
    return {...result,claims:result.claims.slice(0,6),analysis:a?{...a,findings:[],research:research&&!detailedResearch?{question:research.question,alternatives:research.alternatives,ideaAdvantages:research.ideaAdvantages,ideaDisadvantages:research.ideaDisadvantages,coverage:research.coverage,nextChecks:research.nextChecks}:research}:null,
      experiments:role==="experimenter"&&step.role!=="critic"?result.experiments.map(e=>({title:e.title,week:e.week,hypothesis:e.hypothesis,contract:e.contract})):result.experiments};
  };
  const upstream=completed.filter(s=>relevant[step.role].includes(s.role)).map(s=>({stepId:s.id,role:s.role,round:s.round,result:view(s.role,s.result!)}));
  const parentArtifacts=parent.filter(p=>relevant[step.role].includes(p.role)&&!completed.some(s=>s.role===p.role)).map(p=>({...p,result:view(p.role,p.result)}));
  const fullTasks=step.role==="experimenter"||step.role==="critic";
  const tasks=workspace.tasks.map(t=>fullTasks?t:{id:t.id,title:t.title,week:t.week,status:t.status,archived:t.archived,edited:t.edited,source:t.source});
  const currentDecisions=memory.filter(m=>m.status==="accepted"||m.status==="active");
  const historicalDecisions=memory.filter(m=>["rejected","deferred","superseded"].includes(m.status)).map(m=>({id:m.id,status:m.status,data:m.data,reason:m.reason}));
  const openIssues=(await store.analysis.issues(run.id)).filter(i=>i.status==="open");
  const [r]=await store.db.query("SELECT sources FROM ai_runs WHERE id=$1",[run.id]);
  const material=run.snapshot.founderMaterial;
  const textLimit=step.role==="intake"?16000:6000;
  const founderMaterial=material?{text:material.text,files:material.files.map(f=>({...f,text:f.text.slice(0,textLimit),coverage:f.coverage+(f.text.length>textLimit?`; this role sees the first ${textLimit} characters; full extraction retained in private snapshot`:"")}))}:undefined;
  return {
    asOf:new Date().toISOString(),role:step.role,round:step.round,brief:run.brief,
    snapshot:{workspace:{...workspace,tasks},evidence,currentDecisions,historicalDecisions,pendingDecisions:memory.filter(m=>m.status==="proposed"&&m.revision>1),parentArtifacts,founderMaterial,intakeInterpretation:run.snapshot.intake?{id:run.snapshot.intake.id,result:run.snapshot.intake.result}:undefined},
    precedingArtifacts:upstream,sourceLedger:step.role==="researcher"?r.sources:(r.sources as {url:string}[]).filter(s=>pages.some(p=>p.url===s.url)),capturedPages,findings,openIssues,
    manifest:{snapshotHash:fingerprint(run.snapshot),memory:memory.map(m=>({id:m.id,revision:m.revision,status:m.status})),evidenceIds:evidence.map(e=>e.id),artifactIds:completed.map(s=>s.id),pageVersions:pages.map(p=>({id:p.id,contentHash:p.contentHash,accessedAt:p.accessedAt})),taskView:fullTasks?"full":"summary"},
    instruction:"The confirmed saved profile is authoritative over earlier onboarding extraction and material when fields conflict; disclose other contradictions. Uploaded material and intake interpretation are founder-provided context, not independently verified sources. Use current accepted decisions separately from historical proposals. Make the next decision concrete. New observations can challenge an accepted direction without silently replacing it. A captured passage is source text, not proof that a vendor's assertion is true.",
  };
}
