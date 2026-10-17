import { describe,expect,it } from "vitest";
import { orderTasks } from "@/lib/domain/task-order";
import type { Task } from "@/lib/domain/types";
import { analysisLabels,analysisCopy } from "@/ui/analysis-copy";

const task=(id:string,dependsOn:string[]=[],week=1)=>({id,week,experiment:{key:id,dependsOn}} as Task);
describe("release presentation regressions",()=>{
  it("places prerequisites first within the same week without duplicating tasks or looping on old cycles",()=>{
    const tasks=[task("admission",["access"]),task("access"),task("continue",["outcome"],4),task("outcome",[],4)];
    expect(orderTasks(tasks).map(t=>t.id)).toEqual(["access","admission","outcome","continue"]);
    expect(orderTasks([task("one",["two"]),task("two",["one"])] )).toHaveLength(2);
    expect(tasks[0].id).toBe("admission");
  });
  it("localizes controlled analysis labels and resource errors without altering founder text",()=>{
    for(const [source,translations] of Object.entries(analysisLabels)){
      expect(translations.every(t=>t.trim().length>0),source).toBe(true);
      expect(analysisCopy(source,"en")).toBe(source);
    }
    expect(analysisCopy("Оплата пилота: KZT spending is unknown.","ru")).toBe("Оплата пилота: расходы в KZT неизвестны.");
    expect(analysisCopy("Capacity check","ru")).toBe("Проверка нагрузки");
    expect(analysisCopy("Week 2 needs 810 minutes; capacity is 720.","ru")).toContain("810");
    expect(analysisCopy("Founder explicitly said: $49/month, unknown retention.","kk")).toBe("Founder explicitly said: $49/month, unknown retention.");
  });
});
