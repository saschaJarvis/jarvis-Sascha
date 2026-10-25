'use client';
import { useEffect, useRef } from 'react';

/**
 * 3D-Kugel (WebGL, Fragment-Shader): Mond mit Kratern/Meeren, beleuchtet aus der echten Sonnenrichtung,
 * oder Sonne mit Granulation, Flecken und Randverdunkelung. Dreht sich langsam.
 * Liefert onReady(false), wenn WebGL fehlt – dann zeigt der Aufrufer das SVG-Bild.
 */

export const VERT = `attribute vec2 p; varying vec2 v; void main(){ v = p; gl_Position = vec4(p, 0.0, 1.0); }`;

export const FRAG = `precision highp float;
varying vec2 v;
uniform float t;
uniform float mode;      // 0 = Mond, 1 = Sonne
uniform vec3 sunDir;     // Blickraum: x rechts, y oben, z zum Betrachter
uniform float low;       // 0..1: Sonne nahe Horizont → rötlich
uniform float spin;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
float craters(vec3 p){
  vec3 i = floor(p), f = fract(p); float res = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 b = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash(i + b), hash(i + b + 7.1), hash(i + b + 13.7));
    float r = 0.12 + 0.22 * hash(i + b + 3.3);
    float d = length(b + o - f) / r;
    if (hash(i + b + 9.9) > 0.55 && d < 1.3) res += (d < 1.0 ? -0.35 * (1.0 - d * d) : 0.0) + 0.28 * exp(-pow((d - 1.0) * 7.0, 2.0));
  }
  return res;
}

void main(){
  float r2 = dot(v, v);
  if (r2 > 1.0) { gl_FragColor = vec4(0.0); return; }
  float rr = sqrt(r2);
  float edge = 1.0 - smoothstep(0.985, 1.0, rr);
  vec3 n = vec3(v.x, v.y, sqrt(1.0 - r2));
  // leichte Achsneigung, dann Drehung um die Hochachse
  float tilt = 0.35; float ct = cos(tilt), st = sin(tilt);
  vec3 a = vec3(n.x, ct * n.y - st * n.z, st * n.y + ct * n.z);
  float c = cos(spin), s = sin(spin);
  vec3 tp = vec3(c * a.x + s * a.z, a.y, -s * a.x + c * a.z);

  if (mode < 0.5) {
    float m = fbm(tp * 1.5 + 3.0);
    float maria = smoothstep(0.40, 0.62, m + 0.08 * (fbm(tp * 5.0) - 0.5)) * 0.85 + smoothstep(0.52, 0.74, fbm(tp * 0.9 + 21.0)) * 0.45;
    float detail = fbm(tp * 8.0);
    float cr = craters(tp * 4.0) * 0.35 + craters(tp * 9.0) * 0.22 + craters(tp * 17.0) * 0.12;
    float albedo = clamp(0.80 - 0.38 * min(maria, 1.0) + 0.16 * (detail - 0.5) + cr * 0.45, 0.15, 1.0);
    vec3 col = vec3(albedo) * vec3(0.94, 0.97, 1.0);
    float lam = dot(n, normalize(sunDir));
    float lit = smoothstep(-0.03, 0.12, lam);
    float shade = lit * (0.42 + 0.58 * max(lam, 0.0));
    vec3 outc = col * shade * 1.12 + col * 0.045;          // + Erdschein
    gl_FragColor = vec4(outc * edge, edge);
  } else {
    float mu = n.z;
    float limb = 1.0 - 0.62 * (1.0 - pow(mu, 0.55));
    float gran = fbm(tp * 14.0 + vec3(0.0, t * 0.08, t * 0.05));
    float swirl = fbm(tp * 3.0 + vec3(t * 0.02));
    float spots = smoothstep(0.70, 0.76, fbm(tp * 2.2 + 11.0));
    vec3 hot = vec3(1.0, 0.92, 0.55), warm = vec3(1.0, 0.55, 0.08);
    vec3 col = mix(warm, hot, pow(limb, 1.6)) * (0.8 + 0.38 * gran + 0.12 * swirl) * (1.0 - 0.7 * spots) * (0.35 + 0.75 * limb);
    col = mix(col, col * vec3(1.0, 0.52, 0.32), low);
    gl_FragColor = vec4(min(col, vec3(1.0)) * edge, edge);
  }
}`;

export function SkySphere({ mode, sunDir, low = 0, className = '', style, onReady }: {
  mode: 'moon' | 'sun'; sunDir: [number, number, number]; low?: number; className?: string; style?: React.CSSProperties;
  onReady: (ok: boolean) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ mode, sunDir, low });
  live.current = { mode, sunDir, low };

  useEffect(() => {
    const canvas = ref.current!;
    const gl = (canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true }) as WebGLRenderingContext | null);
    if (!gl) { onReady(false); return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.error(gl.getShaderInfoLog(s)), null); };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { onReady(false); return; }
    const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { onReady(false); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uT = u('t'), uMode = u('mode'), uSun = u('sunDir'), uLow = u('low'), uSpin = u('spin');
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    let raf = 0, last = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== w) { canvas.width = w; canvas.height = w; gl.viewport(0, 0, w, w); }
    };
    const draw = (now: number) => {
      // ~30 Bilder/s reichen und schonen den Akku
      if (now - last >= 33 || last === 0) {
        last = now;
        resize();
        const t = (now - t0) / 1000;
        const { mode: m, sunDir: d, low: l } = live.current;
        gl.uniform1f(uT, t);
        gl.uniform1f(uMode, m === 'sun' ? 1 : 0);
        gl.uniform3f(uSun, d[0], -d[1], d[2]); // Bild-y (unten) → GL-y (oben)
        gl.uniform1f(uLow, l);
        gl.uniform1f(uSpin, reduce ? 0.6 : (t * 2 * Math.PI) / (m === 'sun' ? 45 : 80));
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    onReady(true);
    raf = requestAnimationFrame(draw);
    const onVis = () => { if (reduce) requestAnimationFrame(draw); };
    const iv = reduce ? setInterval(() => requestAnimationFrame(draw), 60_000) : undefined;
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); if (iv) clearInterval(iv); document.removeEventListener('visibilitychange', onVis); gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, [onReady]);

  return <canvas ref={ref} className={className} style={style} aria-hidden="true" />;
}
