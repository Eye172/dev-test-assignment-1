import type { AiEvidence, AiResult, AiRole, AiStep } from "@/lib/domain/ai";
import type { MemoryItem, SourcePage } from "@/lib/domain/analysis";
import { artifactId } from "./identity";
import type { StoredFinding } from "./analysis-store";

type Issue=AiResult["issues"][number];
export const CONTRACT_VALIDATOR_VERSION = "orbit-contract-2.0.1";
export function prepareAnalysis(result:AiResult,step:Pick<AiStep,"id"|"role">,context:{memory:MemoryItem[];findings:StoredFinding[];pages:SourcePage[];evidence:AiEvidence[];taskIds:string[]},report?:(issues:Issue[])=>void) {
  if(!result.analysis){report?.([]);return result;} // Retained version-1 artifacts and offline fixtures.
  const a=structuredClone(result.analysis);const issues:Issue[]=[];
  const problem=(topic:string,reason:string,target:AiRole=step.role)=>issues.push({severity:"blocking",target,topic:`Contract: ${topic}`,reason,correction:"Correct the typed references or supporting evidence in a new artifact; do not waive this check."});
  const map=new Map<string,string>();
  for(const [kind,items] of [["finding",a.findings],["hypothesis",a.hypotheses],["decision",a.decisions]] as const){
    const keys=new Set<string>();
    for(const item of items){
      if(keys.has(item.key))problem("Duplicate keys",`Repeated ${kind} key: ${item.key}.`);keys.add(item.key);
      const existing=kind!=="finding"&&item.id?context.memory.find(m=>m.id===item.id&&m.data.kind===kind):null;
      if(kind!=="finding"&&item.id&&!existing)problem("Unknown memory",`${item.id} is absent from the supplied ${kind} memory.`);
      item.id=existing?.id||artifactId(step.id,kind,item.key);map.set(item.key,item.id);
    }
  }
  const resolve=(refs:string[])=>refs.map(ref=>map.get(ref)||ref);
  const findings=new Map(context.findings.map(f=>[f.id!,f]));for(const f of a.findings)findings.set(f.id!,{...f,support:"unchecked",stepId:step.id,runId:""});
  const hypothesisIds=new Set([...context.memory.filter(m=>m.data.kind==="hypothesis").map(m=>m.id),...a.hypotheses.map(h=>h.id!)]);
  const decisionIds=new Set([...context.memory.filter(m=>m.data.kind==="decision").map(m=>m.id),...a.decisions.map(h=>h.id!)]);
  const evidenceIds=new Set(context.evidence.map(e=>e.id));
  const passages=new Map(context.pages.filter(p=>p.status==="captured").flatMap(p=>p.passages.map(x=>[x.id,x] as const)));
  const findingRefs=(refs:string[])=>{const ids=resolve(refs);for(const id of ids)if(!findings.has(id))problem("Unknown finding",`Finding ${id} was not supplied in this context.`);return ids;};
  const evidenceRefs=(ids:string[])=>{for(const id of ids)if(!evidenceIds.has(id))problem("Unknown observation",`Observation ${id} was not supplied in this snapshot.`);};
  for(const f of a.findings){
    evidenceRefs(f.evidenceIds);
    for(const id of f.passageIds)if(!passages.has(id))problem("Unknown passage",`Finding '${f.key}' references unavailable passage ${id}.`);
    if(f.kind==="source_reported"&&!f.passageIds.some(id=>passages.has(id)))problem("Unverified external claim",`External finding '${f.statement.slice(0,180)}' has no captured supporting passage.`);
    if(f.kind==="founder_statement"&&!f.evidenceIds.length)f.limitation=`Founder brief or statement; not independently verified. ${f.limitation}`.trim().slice(0,1800);
  }
  for(const h of a.hypotheses){h.findingRefs=findingRefs(h.findingRefs);evidenceRefs(h.evidenceIds);}
  for(const d of a.decisions){
    d.findingRefs=findingRefs(d.findingRefs);evidenceRefs(d.evidenceIds);d.hypothesisRefs=resolve(d.hypothesisRefs);
    for(const id of d.hypothesisRefs)if(!hypothesisIds.has(id))problem("Unknown hypothesis",`Decision '${d.key}' references unavailable hypothesis ${id}.`);
    if(!d.options.some(o=>o.key===d.selectedOption))problem("Decision option",`Decision '${d.key}' selects an absent option.`);
    for(const option of d.options)option.findingRefs=findingRefs(option.findingRefs);
  }
  if(a.research){
    const r=a.research,axes=new Set(r.axes.map(x=>x.key)),alternatives=new Set(r.alternatives.map(x=>x.key));
    const capturedSupport=(ids:string[])=>ids.some(id=>{const f=findings.get(id);return f?.kind==="source_reported"&&f.passageIds.some(p=>passages.has(p));});
    const observationSupport=(ids:string[])=>ids.some(id=>{const f=findings.get(id);return f?.kind==="founder_statement"&&f.evidenceIds.some(e=>evidenceIds.has(e));});
    if(axes.size!==r.axes.length||alternatives.size!==r.alternatives.length)problem("Research keys","Comparison axes and alternative keys must be unique.");
    if(!r.alternatives.some(x=>x.category==="manual"||x.category==="do_nothing"))problem("Current workflow","Include the buyer's current/manual or do-nothing alternative; do not assume adoption is necessary.");
    const cells=new Set<string>();
    for(const c of r.cells){
      c.findingRefs=findingRefs(c.findingRefs);const pair=`${c.alternativeKey}:${c.axisKey}`;
      if(cells.has(pair)||!alternatives.has(c.alternativeKey)||!axes.has(c.axisKey))problem("Comparison cells",`Duplicate or unknown comparison cell ${pair}.`);cells.add(pair);
      if((c.basis==="reported"||c.basis==="observed")&&!c.findingRefs.length)problem("Unsupported comparison",`${pair} needs a finding or an explicit unknown/inference label.`);
      const alternative=r.alternatives.find(x=>x.key===c.alternativeKey);
      if(c.basis==="reported"&&["direct","indirect"].includes(alternative?.category||"")&&!capturedSupport(c.findingRefs))problem("Comparison evidence type",`${pair}: reported external capabilities require a captured source finding, not an inference.`);
      if(c.basis==="observed"&&!observationSupport(c.findingRefs)&&!(alternative?.category==="idea"&&c.findingRefs.some(id=>findings.get(id)?.kind==="workspace_record")))problem("Comparison evidence type",`${pair}: observed behavior needs a linked recorded observation; otherwise label it reported, inferred or unknown.`);
    }
    for(const alt of r.alternatives){
      alt.findingRefs=findingRefs(alt.findingRefs);alt.pricing.findingRefs=findingRefs(alt.pricing.findingRefs);
      for(const axis of axes)if(!cells.has(`${alt.key}:${axis}`))problem("Comparison coverage",`Missing ${alt.name} / ${axis}; include an unknown cell instead of omitting it.`);
      if(alt.pricing.amount!==null&&!alt.pricing.currency){alt.pricing.amount=null;alt.pricing.conditions=`Currency code is unconfirmed; numeric comparison is unavailable. ${alt.pricing.conditions}`.slice(0,800);}
      if(alt.pricing.amount!==null&&(!alt.pricing.unit||!alt.pricing.period||!alt.pricing.findingRefs.length))problem("Pricing terms",`${alt.name}: numeric list price needs billing period, unit and source support.`);
      if(alt.pricing.amount!==null&&["direct","indirect"].includes(alt.category)&&!capturedSupport(alt.pricing.findingRefs))problem("Pricing evidence type",`${alt.name}: a numeric competitor list price must link to captured source evidence, not a hypothesis.`);
    }
    for(const x of [...r.ideaAdvantages,...r.ideaDisadvantages])x.findingRefs=findingRefs(x.findingRefs);
  }
  const experiments=result.experiments.map(e=>({...e,contract:e.contract?structuredClone(e.contract):null}));
  if(step.role==="experimenter"){
    const keys=new Set(experiments.map(e=>e.contract?.key));
    if(keys.size!==experiments.length||keys.has(undefined))problem("Experiment keys","Each experiment needs its own typed contract and unique key.");
    const visit=(id:string,path:Set<string>):boolean=>{if(path.has(id))return true;const e=experiments.find(e=>e.contract?.key===id);return !!e?.contract?.dependsOn.some(k=>visit(k,new Set([...path,id])));};
    for(const e of experiments){
      const c=e.contract;if(!c)continue;
      c.hypothesisRefs=resolve(c.hypothesisRefs);c.decisionRefs=resolve(c.decisionRefs);
      for(const id of c.hypothesisRefs)if(!hypothesisIds.has(id))problem("Experiment hypothesis",`${c.key} references absent hypothesis ${id}.`);
      for(const id of c.decisionRefs)if(!decisionIds.has(id))problem("Experiment decision",`${c.key} references absent decision ${id}.`);
      for(const id of c.existingTaskIds)if(!context.taskIds.includes(id))problem("Experiment task",`${c.key} references a task outside this snapshot.`);
      for(const id of c.dependsOn)if(!keys.has(id))problem("Experiment dependency",`${c.key} depends on absent experiment ${id}.`);
      if(visit(c.key,new Set()))problem("Dependency cycle",`Experiment ${c.key} participates in a dependency cycle.`);
      const start=(e.week-1)*7+1,end=e.week===4?30:e.week*7;
      if(c.measurement.deadlineDay<start||c.measurement.deadlineDay>end)problem("Experiment deadline",`${c.key}'s deadline is outside its assigned week.`);
    }
    if(!a.planLimits)problem("Plan limits","The proposal must state resource limits or explicitly unknown limits.");
  }
  if(step.role==="critic"){
    for(const finding of context.findings.filter(f=>f.kind==="source_reported")){
      const check=a.sourceChecks.find(c=>c.findingId===finding.id);
      if(!check||check.outcome!=="supports")problem(`Source support ${finding.id}`,check?.reason||`No claim-to-passage assessment for '${finding.statement.slice(0,150)}'.`,"researcher");
    }
    for(const check of a.sourceChecks)if(!findings.has(check.findingId))problem("Source check reference",`The critic checked an unknown finding ${check.findingId}.`);
  }
  // Old summary fields must not become a route around version-2 provenance.
  if(result.claims.some(c=>c.kind==="source_reported")&&!a.findings.some(f=>f.kind==="source_reported"))problem("Summary provenance","External summary claims need matching typed external findings with captured passages.");
  report?.(issues);
  return {...result,analysis:a,experiments,issues:[...issues,...result.issues].slice(0,12)};
}
