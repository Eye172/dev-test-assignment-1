"use client";
import { useEffect, useRef } from "react";
import { useDisplay } from "../display";

/** Particle assembly from the supplied Particle-logo-simulation idea: loose
 * observations become five connected decisions. One bounded entrance, no loop. */
export function SignalFlow() {
  const ref=useRef<HTMLCanvasElement>(null);
  const played=useRef(false);
  const {theme,version}=useDisplay();
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const ctx=el.getContext("2d");if(!ctx)return;
    const reduce=matchMedia("(prefers-reduced-motion: reduce)");
    const points=Array.from({length:420},(_,i)=>{
      const node=i%5, a=i*2.399963, r=Math.sqrt((i%83)/83)*12;
      const x=30+node*42+Math.cos(a)*r, y=65+Math.sin(node*1.25)*22+Math.sin(a)*r;
      return {x,y,sx:120+Math.cos(a)*110,sy:65+Math.sin(a*1.7)*60,r:i%7===0?1.3:0.7};
    });
    let raf=0,started=played.current;
    const draw=(p:number)=>{
      const dpr=Math.min(devicePixelRatio||1,2);
      if(el.width!==240*dpr) {el.width=240*dpr;el.height=130*dpr;}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,240,130);
      const accent=getComputedStyle(el).getPropertyValue("--accent-ink").trim();
      ctx.strokeStyle=accent;ctx.globalAlpha=p*0.3;ctx.lineWidth=1.5;ctx.beginPath();
      for(let n=0;n<5;n++){const x=30+n*42,y=65+Math.sin(n*1.25)*22;if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
      points.forEach((v,i)=>{ctx.globalAlpha=(0.25+(i%5)*0.15);ctx.fillStyle=accent;
        ctx.beginPath();ctx.arc(v.sx+(v.x-v.sx)*p,v.sy+(v.y-v.sy)*p,v.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    };
    draw(1);
    const io=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting||started)return;started=true;played.current=true;io.disconnect();
      if(reduce.matches)return;
      const start=performance.now();
      const frame=(now:number)=>{const p=Math.min(1,(now-start)/1200);draw(1-Math.pow(1-p,4));if(p<1)raf=requestAnimationFrame(frame);};
      raf=requestAnimationFrame(frame);
    },{threshold:0.5});io.observe(el);
    const stop=()=>{if(reduce.matches||document.hidden){cancelAnimationFrame(raf);draw(1);}};
    const scheme=matchMedia("(prefers-color-scheme: dark)");const recolor=()=>draw(1);scheme.addEventListener("change",recolor);
    reduce.addEventListener("change",stop);document.addEventListener("visibilitychange",stop);
    return()=>{scheme.removeEventListener("change",recolor);cancelAnimationFrame(raf);io.disconnect();reduce.removeEventListener("change",stop);document.removeEventListener("visibilitychange",stop);};
  },[theme,version]);
  return <canvas className="land-signal" ref={ref} width={480} height={260} aria-hidden="true"/>;
}
