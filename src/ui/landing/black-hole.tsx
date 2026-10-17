"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A lensed black hole in one fragment shader (no dependencies).
 * Rays are integrated through a Schwarzschild approximation (a = -1.5·h²·r / |r|⁵, r_s = 1), so the far side of the
 * accretion disk bends over and under the shadow (the "Gargantua hat"), with a photon ring and Doppler beaming
 * on the approaching side. The scene renders at native CSS resolution or above, with a filtered antialiasing pass. The loop pauses off-screen
 * and in hidden tabs, renders one still frame under reduced motion, and falls back to CSS without WebGL.
 */
const vertex = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const fragment = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uCenter; uniform float uScale; uniform float uIncl; uniform vec2 uMouse; uniform float uDist;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.55; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.1+vec2(13.7,7.1); a*=0.5; } return v; }

vec3 diskShade(vec3 hit, vec3 dir, float hr){
  float ang = atan(hit.z, hit.x);
  float omega = 1.0/(hr*sqrt(hr));
  float phase = ang - uTime*omega*4.5;
  // Spiral lanes that shear with the Keplerian rotation; seamless around the circle via cos/sin coordinates.
  vec2 q = vec2(cos(phase), sin(phase))*hr*0.9;
  float lanes = fbm(q*1.15 + vec2(hr*0.7, 0.0));
  float fine = fbm(vec2(hr*7.0, phase*4.0));
  float particles = pow(max(0.0, sin(phase*73.0 + hr*19.0)), 24.0) * pow(max(0.0, sin(hr*31.0 - uTime*0.7)), 12.0);
  float dens = (0.35 + 0.95*lanes*lanes + 0.35*fine) * smoothstep(2.55, 3.3, hr) * smoothstep(10.5, 6.0, hr);
  // Relativistic beaming: the side moving toward the camera is brighter and whiter.
  vec3 vdir = normalize(vec3(hit.z, 0.0, -hit.x));
  float speed = clamp(sqrt(0.5/(hr-1.0)), 0.0, 0.62);
  float dop = 1.0/(1.0 - dot(vdir, -dir)*speed);
  float beam = min(pow(dop, 2.6), 3.2);
  float temp = pow(3.0/hr, 1.1);
  vec3 deep = vec3(0.0, 0.32, 0.12), signal = vec3(0.0, 1.0, 0.36), mint = vec3(0.49, 1.0, 0.72);
  vec3 c = mix(deep, signal, smoothstep(0.08, 0.55, temp));
  c = mix(c, mint, smoothstep(0.45, 0.9, temp*dop*0.9));
  c = mix(c, vec3(1.0), smoothstep(0.8, 1.35, temp*dop));
  return c * (dens + particles*0.9) * beam * 0.48;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - uCenter*uRes) / (uRes.y*uScale);
  float incl = uIncl + uMouse.y*0.035;
  float yaw = -0.55 + uMouse.x*0.12;
  vec3 ro = vec3(sin(yaw)*cos(incl), sin(incl), -cos(yaw)*cos(incl)) * uDist;
  vec3 fw = normalize(-ro); vec3 rt = normalize(cross(vec3(0.0,1.0,0.0), fw)); vec3 up = cross(fw, rt);
  vec3 rd = normalize(fw*2.6 + uv.x*rt + uv.y*up);
  vec3 pos = ro; vec3 vel = rd;
  vec3 hv = cross(pos, vel); float h2 = dot(hv, hv);
  vec3 col = vec3(0.0); float alpha = 0.0; float minR = 100.0; bool captured = false;
  for (int i = 0; i < 170; i++) {
    float r2 = dot(pos, pos); float r = sqrt(r2);
    minR = min(minR, r);
    float dt = clamp(0.07*r, 0.035, 1.6);
    vec3 acc = -1.5*h2*pos/(r2*r2*r);
    vec3 np = pos + vel*dt; vel += acc*dt;
    if (pos.y*np.y < 0.0) {
      float f = pos.y/(pos.y - np.y); vec3 hit = mix(pos, np, f); float hr = length(hit.xz);
      if (hr > 2.5 && hr < 10.5) {
        vec3 c = diskShade(hit, normalize(vel), hr);
        float a = clamp(length(c)*0.9, 0.0, 1.0);
        col += c*(1.0 - alpha)*1.15; alpha += a*(1.0 - alpha);
      }
    }
    pos = np;
    if (r < 1.0) { captured = true; break; }
    if (r > uDist*1.6 || alpha > 0.985) break;
  }
  // Photon ring: rays that skim the photon sphere (r ≈ 1.5) glow.
  float ring = exp(-pow(max(minR - 1.5, 0.0)*5.5, 1.3)) * (captured ? 0.0 : 1.0);
  col += vec3(0.35, 1.0, 0.62) * ring * 0.55 * (1.0 - alpha*0.6);
  float bg = 0.0;
  if (!captured && alpha < 0.95) {
    // Soft screen-space stars avoid angular hash cells stretching into large
    // jagged polygons around the lens. Disk particles still follow the rays.
    vec2 sp = gl_FragCoord.xy / (uRes.y/900.0*18.0);
    vec2 cell = floor(sp);
    vec2 offset = vec2(hash(cell+2.1),hash(cell+7.3))*0.6+0.2;
    float star = smoothstep(0.065,0.015,length(fract(sp)-offset));
    float s = star*step(0.985,hash(cell))*(0.65+0.15*sin(uTime*0.7+hash(cell+3.1)*40.0));
    bg = s * (1.0 - alpha);
    col += vec3(0.85, 0.95, 0.9) * bg * 0.7;
  }
  // Filmic tone map keeps the beamed side white-hot without clipping the whole disk.
  col = vec3(1.0) - exp(-col*1.5);
  float a = captured ? 1.0 : clamp(alpha + ring*0.6 + bg, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

// Edge-aware filtering smooths the photon ring and lens silhouette without
// blurring the disk texture. Alpha is filtered with the colour at the same taps.
const antialias = `
precision highp float;
uniform sampler2D uScene; uniform vec2 uScreen; uniform vec2 uTexel;
float luma(vec4 c){return dot(c.rgb,vec3(0.299,0.587,0.114));}
void main(){
  vec2 uv=gl_FragCoord.xy/uScreen;
  vec4 c=texture2D(uScene,uv);
  float nw=luma(texture2D(uScene,uv+vec2(-1.0,1.0)*uTexel));
  float ne=luma(texture2D(uScene,uv+vec2(1.0,1.0)*uTexel));
  float sw=luma(texture2D(uScene,uv+vec2(-1.0,-1.0)*uTexel));
  float se=luma(texture2D(uScene,uv+vec2(1.0,-1.0)*uTexel));
  float m=luma(c), lo=min(m,min(min(nw,ne),min(sw,se))), hi=max(m,max(max(nw,ne),max(sw,se)));
  vec2 dir=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
  float reduce=max((nw+ne+sw+se)*0.03125,0.0078125);
  dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.0),vec2(8.0))*uTexel;
  vec4 a=0.5*(texture2D(uScene,uv+dir*(-1.0/6.0))+texture2D(uScene,uv+dir*(1.0/6.0)));
  vec4 b=a*0.5+0.25*(texture2D(uScene,uv-dir*0.5)+texture2D(uScene,uv+dir*0.5));
  gl_FragColor=hi-lo<max(0.025,hi*0.1)?c:(luma(b)<lo||luma(b)>hi?a:b);
}`;

type Variant = "cinematic" | "high";
const settings: Record<Variant, { incl: number; dist: number; center: [number, number]; scale: number; phone: { center: [number, number]; scale: number } }> = {
  cinematic: { incl: 0.16, dist: 24, center: [0.75, 0.5], scale: 0.66, phone: { center: [0.62, 0.16], scale: 0.5 } },
  high: { incl: 0.58, dist: 26, center: [0.78, 0.56], scale: 0.56, phone: { center: [0.6, 0.14], scale: 0.44 } },
};

export function BlackHole({ variant = "cinematic", paused = false, className = "" }: { variant?: Variant; paused?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(20);
  const [ready, setReady] = useState(false);
  const [contextVersion, setContextVersion] = useState(0);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true, powerPreference: "high-performance" });
    if (!gl) return;
    const shaders: WebGLShader[] = [], programs: WebGLProgram[] = [];
    const program = (source: string) => {
      const prog = gl.createProgram()!; programs.push(prog);
      for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, source]] as const) {
        const shader = gl.createShader(type)!; shaders.push(shader); gl.shaderSource(shader, code); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
        gl.attachShader(prog, shader);
      }
      gl.linkProgram(prog); return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
    };
    const clearPrograms = () => { programs.forEach(p => gl.deleteProgram(p)); shaders.forEach(s => gl.deleteShader(s)); };
    const precise = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision;
    const scene = program(precise ? fragment : fragment.replace("precision highp float", "precision mediump float"));
    const smooth = program(precise ? antialias : antialias.replace("precision highp float", "precision mediump float"));
    if (!scene || !smooth) { clearPrograms(); return; }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const bindProgram = (prog: WebGLProgram) => {
      gl.useProgram(prog); const p = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    };
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    const u = (n: string) => { if (!uniforms.has(n)) uniforms.set(n,gl.getUniformLocation(scene,n)); return uniforms.get(n)!; };
    const screen = gl.getUniformLocation(smooth,"uScreen"), texel = gl.getUniformLocation(smooth,"uTexel");
    const cfg = settings[variant];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0, visible = true, running = !document.hidden, count = 0, previous = performance.now(), lastRender = 0;
    let width = 1, height = 1;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const layout = () => {
      const w = Math.max(1,el.clientWidth), h = Math.max(1,el.clientHeight);
      // Never reduce below one scene pixel per CSS pixel. Slower devices render
      // fewer frames instead of turning the disk into visibly enlarged pixels.
      const scale = Math.min(Math.max(window.devicePixelRatio || 1,1),1.5);
      width = Math.max(2,Math.round(w*scale)); height = Math.max(2,Math.round(h*scale));
      el.width = width; el.height = height;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
      bindProgram(scene); gl.uniform2f(u("uRes"),width,height);
      const wide = w/h > 1.05, c = wide ? cfg.center : cfg.phone.center;
      gl.uniform2f(u("uCenter"),c[0],c[1]); gl.uniform1f(u("uScale"),wide ? cfg.scale : cfg.phone.scale);
      gl.uniform1f(u("uIncl"),cfg.incl); gl.uniform1f(u("uDist"),cfg.dist);
      bindProgram(smooth); gl.uniform1i(gl.getUniformLocation(smooth,"uScene"),0);
      gl.uniform2f(screen,width,height); gl.uniform2f(texel,1/width,1/height);
    };
    const draw = (now: number) => {
      const dt = Math.min(0.1,(now-previous)/1000); previous = now;
      if (!paused && !reduce.matches) clock.current += dt;
      const ease = 1-Math.exp(-dt*3);
      mouse.x += (mouse.tx-mouse.x)*ease; mouse.y += (mouse.ty-mouse.y)*ease;
      bindProgram(scene); gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.viewport(0,0,width,height);
      // Unbind the sampled texture while writing into it (no feedback loop).
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,null);
      gl.uniform1f(u("uTime"),clock.current);
      gl.uniform2f(u("uMouse"),mouse.x+Math.sin(clock.current*0.12)*0.25,mouse.y+Math.cos(clock.current*0.09)*0.12);
      gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); bindProgram(smooth);
      gl.bindTexture(gl.TEXTURE_2D,tex); gl.drawArrays(gl.TRIANGLES,0,3);
      el.dataset.frame = String(++count);
    };
    const loop = (now: number) => {
      // Bound continuous GPU work to 30 fps, keeping full spatial quality.
      const interval = 1000/30, elapsed = now-lastRender;
      if (elapsed >= interval) { draw(now); lastRender = now-elapsed%interval; }
      if (running && visible && !paused && !reduce.matches) raf=requestAnimationFrame(loop);
    };
    const resume = () => { cancelAnimationFrame(raf); previous=performance.now(); if (running && visible && !paused && !reduce.matches) raf=requestAnimationFrame(loop); };
    layout(); draw(performance.now()); setReady(true); resume();
    const ro = new ResizeObserver(() => { layout(); draw(performance.now()); }); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible=e.isIntersecting; resume(); }); io.observe(el);
    const visibility = () => { running=!document.hidden; resume(); };
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; mouse.tx=e.clientX/window.innerWidth*2-1; mouse.ty=1-e.clientY/window.innerHeight*2; };
    const lost = (e: Event) => { e.preventDefault(); running=false; cancelAnimationFrame(raf); setReady(false); };
    const restored = () => setContextVersion(n => n+1);
    document.addEventListener("visibilitychange",visibility); window.addEventListener("pointermove",move,{passive:true}); reduce.addEventListener("change",resume);
    el.addEventListener("webglcontextlost",lost); el.addEventListener("webglcontextrestored",restored);
    return () => {
      running=false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange",visibility); window.removeEventListener("pointermove",move); reduce.removeEventListener("change",resume);
      el.removeEventListener("webglcontextlost",lost); el.removeEventListener("webglcontextrestored",restored);
      clearPrograms(); gl.deleteBuffer(buf); gl.deleteTexture(tex); gl.deleteFramebuffer(framebuffer);
    };
  }, [variant,paused,contextVersion]);
  return <div className={`v4-blackhole is-${variant} ${ready ? "is-ready" : ""} ${className}`} data-renderer="light" aria-hidden="true"><canvas ref={canvas}/></div>;
}
