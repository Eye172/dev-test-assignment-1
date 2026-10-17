"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A lensed black hole in one fragment shader (no dependencies).
 * Rays are integrated through a Schwarzschild approximation (a = -1.5·h²·r / |r|⁵, r_s = 1), so the far side of the
 * accretion disk bends over and under the shadow (the "Gargantua hat"), with a photon ring and Doppler beaming
 * on the approaching side. Internal resolution is scaled down and adapts to frame time; the loop pauses off-screen
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
  float omega = 1.0/pow(hr, 1.5);
  float phase = ang - uTime*omega*1.6;
  // Spiral lanes that shear with the Keplerian rotation; seamless around the circle via cos/sin coordinates.
  vec2 q = vec2(cos(phase), sin(phase))*hr*0.9;
  float lanes = fbm(q*1.15 + vec2(hr*0.7, 0.0));
  float fine = fbm(vec2(hr*7.0, phase*4.0));
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
  return c * dens * beam * 0.42;
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
    vec3 acc = -1.5*h2*pos/pow(r2, 2.5);
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
    vec3 d = normalize(vel);
    vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 160.0;
    float s = step(0.9965, hash(floor(sp))) * (0.55 + 0.45*sin(uTime*1.3 + hash(floor(sp)+3.1)*40.0));
    bg = s * (1.0 - alpha);
    col += vec3(0.85, 0.95, 0.9) * bg * 0.7;
  }
  // Filmic tone map keeps the beamed side white-hot without clipping the whole disk.
  col = vec3(1.0) - exp(-col*1.35);
  float a = captured ? 1.0 : clamp(alpha + ring*0.6 + bg, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

type Variant = "cinematic" | "high";
const settings: Record<Variant, { incl: number; dist: number; center: [number, number]; scale: number; phone: { center: [number, number]; scale: number } }> = {
  cinematic: { incl: 0.16, dist: 24, center: [0.75, 0.5], scale: 0.66, phone: { center: [0.5, 0.78], scale: 0.48 } },
  high: { incl: 0.58, dist: 26, center: [0.78, 0.56], scale: 0.56, phone: { center: [0.5, 0.82], scale: 0.42 } },
};

export function BlackHole({ variant = "cinematic", className = "" }: { variant?: Variant; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext("webgl", { premultipliedAlpha: false, antialias: false, alpha: true, powerPreference: "high-performance" });
    if (!gl) return;
    const compile = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const precise = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision;
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, precise ? fragment : fragment.replace("precision highp float", "precision mediump float"));
    if (!vs || !fs) return;
    const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"), uTime = u("uTime"), uCenter = u("uCenter"), uScale = u("uScale"), uIncl = u("uIncl"), uMouse = u("uMouse"), uDist = u("uDist");
    const cfg = settings[variant];
    gl.uniform1f(uIncl, cfg.incl); gl.uniform1f(uDist, cfg.dist);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let quality = 0.62, raf = 0, visible = true, running = true, frames = 0, sampleStart = performance.now();
    const start = performance.now();
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const layout = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const scale = Math.min(quality * Math.min(window.devicePixelRatio || 1, 1.5), 1600 / Math.max(1, w));
      el.width = Math.max(2, Math.round(w * scale)); el.height = Math.max(2, Math.round(h * scale));
      gl.viewport(0, 0, el.width, el.height); gl.uniform2f(uRes, el.width, el.height);
      const wide = w / Math.max(1, h) > 1.05;
      const c = wide ? cfg.center : cfg.phone.center;
      gl.uniform2f(uCenter, c[0], c[1]); gl.uniform1f(uScale, wide ? cfg.scale : cfg.phone.scale);
    };
    const draw = (now: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.035; mouse.y += (mouse.ty - mouse.y) * 0.035;
      gl.uniform1f(uTime, reduce ? 20 : (now - start) / 1000 + 20);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Adaptive resolution: keep the hero smooth on weaker GPUs.
    const adapt = (now: number) => {
      frames++;
      if (now - sampleStart > 1200) {
        const fps = frames * 1000 / (now - sampleStart);
        const next = fps < 40 ? Math.max(0.34, quality * 0.8) : fps > 57 && quality < 0.8 ? quality * 1.1 : quality;
        if (Math.abs(next - quality) > 0.02) { quality = next; layout(); }
        frames = 0; sampleStart = now;
      }
    };
    const loop = (now: number) => { draw(now); adapt(now); if (running && visible && !reduce) raf = requestAnimationFrame(loop); };
    const resume = () => { cancelAnimationFrame(raf); if (running && visible && !reduce) raf = requestAnimationFrame(loop); };
    layout(); draw(performance.now()); setReady(true); resume();
    const ro = new ResizeObserver(() => { layout(); draw(performance.now()); }); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; resume(); }); io.observe(el);
    const onVisibility = () => { running = document.visibilityState === "visible"; resume(); };
    const move = (e: PointerEvent) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", move, { passive: true });
    const lost = (e: Event) => { e.preventDefault(); running = false; cancelAnimationFrame(raf); setReady(false); };
    el.addEventListener("webglcontextlost", lost);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", onVisibility); el.removeEventListener("webglcontextlost", lost); gl.deleteProgram(prog); gl.deleteBuffer(buf); };
  }, [variant]);
  return <div className={`v4-blackhole is-${variant} ${ready ? "is-ready" : ""} ${className}`} aria-hidden="true"><canvas ref={canvas}/></div>;
}
