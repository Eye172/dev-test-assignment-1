"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Landing background: a ray-traced dark planet inside a luminous orbit ring, drawn by one fragment shader.
 * One full-screen triangle, no dependencies. DPR capped, paused off-screen and in hidden tabs,
 * a single still frame under reduced motion, and a CSS fallback when WebGL is unavailable.
 */
const vertex = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const fragment = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec3 uAccent; uniform vec2 uCenter; uniform float uScale;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+17.1; a*=0.5; } return v; }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,s, 0,1,0, -s,0,c); }

void main(){
  vec2 uv = (gl_FragCoord.xy - uCenter*uRes) / (uRes.y*uScale);
  vec3 ro = vec3(0.0, 0.0, -4.2);
  vec3 rd = normalize(vec3(uv, 1.65));
  mat3 cam = rotY(uMouse.x*0.12) * rotX(-uMouse.y*0.08);
  ro = cam*ro; rd = cam*rd;

  vec3 col = vec3(0.0); float alpha = 0.0;

  // Planet
  float b = dot(ro, rd); float c = dot(ro, ro) - 1.0; float h = b*b - c;
  float tS = h > 0.0 ? -b - sqrt(h) : 1e9;

  // Orbit ring on a tilted plane
  vec3 n = normalize(vec3(0.0, 1.0, 0.32));
  n = rotX(-0.18) * n;
  float tR = -dot(ro, n) / dot(rd, n);
  vec3 pr = ro + rd*tR;
  float r = length(pr);
  float ringMask = 0.0; vec3 ringCol = vec3(0.0);
  if (tR > 0.0 && r > 1.32 && r < 2.65) {
    vec3 ax = normalize(cross(n, vec3(0.0,0.0,1.0))); vec3 ay = cross(n, ax);
    float ang = atan(dot(pr, ay), dot(pr, ax));
    float speed = 0.22 / pow(r, 1.5);
    float a2 = ang + uTime*speed;
    float bands = fbm(vec2(r*9.0, 0.0)) * 0.9 + 0.1;
    float grains = fbm(vec2(a2*18.0, r*26.0));
    float streak = pow(fbm(vec2(a2*3.0, r*40.0)), 2.2);
    float edge = smoothstep(1.32, 1.42, r) * (1.0 - smoothstep(2.25, 2.65, r));
    // Fine particulate lanes rather than smeared streaks; fades out toward the plane's horizon (no seam).
    float lanes = pow(fbm(vec2(r*55.0, 3.0)), 3.0);
    float dust = pow(grains, 3.0);
    float grazing = smoothstep(0.03, 0.22, abs(dot(rd, n)));
    float innerEdge = exp(-pow((r - 1.4)*22.0, 2.0));
    float d = edge * grazing * (0.3*bands + 1.0*dust + 0.9*streak*lanes*2.2 + 0.55*innerEdge);
    float hot = smoothstep(1.62, 1.33, r);
    ringCol = mix(uAccent*0.75, vec3(0.78,0.95,0.86), hot*0.5 + lanes*0.3) * d;
    ringMask = clamp(d*1.4, 0.0, 1.0);
  }

  // Composite: ring behind planet is hidden; in front, it covers it
  bool ringFront = ringMask > 0.0 && tR < tS;
  if (tS < 1e8) {
    vec3 p = ro + rd*tS; vec3 N = normalize(p);
    vec3 L = normalize(vec3(-0.6, 0.55, -0.55));
    float diff = max(dot(N, L), 0.0);
    vec3 q = rotY(uTime*0.03) * N;
    float lat = asin(q.y); float lon = atan(q.z, q.x);
    float surface = fbm(vec2(lon*2.2, lat*6.0)) ;
    float rim = pow(1.0 - max(dot(N, -rd), 0.0), 5.0);
    float lit = smoothstep(-0.2, 0.6, dot(N, L));
    vec3 base = vec3(0.012, 0.016, 0.014) + vec3(0.03, 0.04, 0.035)*surface*diff;
    // ring light falling on the planet
    float ringLight = smoothstep(0.35, -0.2, abs(dot(N, n))) * 0.18;
    col = base + uAccent*rim*(0.25 + 0.6*lit) + uAccent*ringLight*diff + vec3(0.9)*pow(diff, 18.0)*0.05;
    alpha = 1.0;
  }
  if (ringMask > 0.0 && (ringFront || tS > 1e8)) { col = col*(1.0 - ringMask*0.85) + ringCol; alpha = max(alpha, ringMask); }

  // Halo and dust
  float dc = length(cross(rd, -ro));
  float halo = exp(-max(dc - 1.0, 0.0)*5.0) * (tS > 1e8 ? 1.0 : 0.0);
  col += uAccent * halo * 0.14; alpha = max(alpha, halo*0.4);
  vec2 g = floor(gl_FragCoord.xy / 3.0);
  float star = step(0.9988, hash(g)) * (0.5 + 0.5*sin(uTime*1.5 + hash(g+3.1)*40.0)) * (tS > 1e8 ? 1.0 : 0.0) * (1.0 - ringMask);
  col += vec3(star*0.55); alpha = max(alpha, star*0.6);

  gl_FragColor = vec4(col, alpha);
}`;

export function OrbitScene({ className = "" }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true, powerPreference: "low-power" });
    if (!gl) return;
    const compile = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const precise = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision;
    const fs = compile(gl.FRAGMENT_SHADER, precise ? fragment : fragment.replace("precision highp float", "precision mediump float"));
    if (!vs || !fs) return;
    const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(prog, name);
    const uRes = u("uRes"), uTime = u("uTime"), uMouse = u("uMouse"), uAccent = u("uAccent"), uCenter = u("uCenter"), uScale = u("uScale");
    gl.uniform3f(uAccent, 0.09, 0.98, 0.48);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, visible = true, running = true, start = performance.now();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = el.clientWidth, hgt = el.clientHeight;
      el.width = Math.round(w * dpr); el.height = Math.round(hgt * dpr);
      gl.viewport(0, 0, el.width, el.height);
      gl.uniform2f(uRes, el.width, el.height);
      const wide = w / hgt > 1.1;
      // The planet sits to the right on wide screens (text stays legible on the left), lower-centre on phones.
      gl.uniform2f(uCenter, wide ? 0.7 : 0.6, wide ? 0.46 : 0.8);
      gl.uniform1f(uScale, wide ? 0.62 : 0.34);
    };
    const draw = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform1f(uTime, reduce ? 12 : (now - start) / 1000 + 12);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => { draw(now); if (running && visible && !reduce) raf = requestAnimationFrame(loop); };
    const resume = () => { cancelAnimationFrame(raf); if (running && visible && !reduce) raf = requestAnimationFrame(loop); };
    layout(); draw(performance.now()); setReady(true); resume();

    const ro = new ResizeObserver(() => { layout(); draw(performance.now()); }); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; resume(); }); io.observe(el);
    // Hidden tabs stop drawing; time resumes where it stopped, so the ring never jumps.
    let pausedAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "visible") { running = true; start += performance.now() - pausedAt; }
      else { running = false; pausedAt = performance.now(); }
      resume();
    };
    const move = (e: PointerEvent) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = (e.clientY / window.innerHeight) * 2 - 1; };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", move, { passive: true });
    const lost = (e: Event) => { e.preventDefault(); running = false; cancelAnimationFrame(raf); setReady(false); };
    el.addEventListener("webglcontextlost", lost);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", onVisibility); el.removeEventListener("webglcontextlost", lost); gl.deleteProgram(prog); gl.deleteBuffer(buf); };
  }, []);
  return <div className={`orbit-scene ${ready ? "is-ready" : ""} ${className}`} aria-hidden="true">
    <canvas ref={canvas}/>
  </div>;
}
