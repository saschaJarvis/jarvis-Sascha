'use client';
import { useEffect, useRef } from 'react';

/**
 * 3D-Kugel (WebGL, Fragment-Shader): Mond mit Kratern/Meeren als Relief (Bump-Mapping), beleuchtet aus der echten Sonnenrichtung,
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
// Krater als Höhenfeld: x = Höhe, yzw = Gradient (analytisch, für die Relief-Beleuchtung)
vec4 craters(vec3 p){
  vec3 i = floor(p), f = fract(p); vec4 res = vec4(0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 b = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash(i + b), hash(i + b + 7.1), hash(i + b + 13.7));
    float r = 0.12 + 0.22 * hash(i + b + 3.3);
    vec3 q = b + o - f;
    float lq = max(length(q), 1e-4);
    float d = lq / r;
    if (hash(i + b + 9.9) > 0.55 && d < 1.3) {
      float e = exp(-pow((d - 1.0) * 7.0, 2.0));
      float h = (d < 1.0 ? -0.35 * (1.0 - d * d) : 0.0) + 0.28 * e;
      float dh = (d < 1.0 ? 0.7 * d : 0.0) - 27.44 * (d - 1.0) * e;   // dh/dd
      res += vec4(h, dh * (-q / (lq * r)));                            // dd/dp = -q/(|q|·r)
    }
  }
  return res;
}

void main(){
  float r2 = dot(v, v);
  if (r2 > 1.0) { gl_FragColor = vec4(0.0); return; }
  float rr = sqrt(r2);
  float edge = 1.0 - smoothstep(0.988, 1.0, rr);
  vec3 n = vec3(v.x, v.y, sqrt(1.0 - r2));
  // leichte Achsneigung, dann Drehung um die Hochachse
  float tilt = 0.35; float ct = cos(tilt), st = sin(tilt);
  mat3 T = mat3(1.0, 0.0, 0.0,  0.0, ct, st,  0.0, -st, ct);   // spaltenweise
  float c = cos(spin), s = sin(spin);
  mat3 S = mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c);
  mat3 R = S * T;
  vec3 tp = R * n;

  if (mode < 0.5) {
    // --- Mond ---
    float m = fbm(tp * 1.5 + 3.0);
    float maria = smoothstep(0.40, 0.62, m + 0.08 * (fbm(tp * 5.0) - 0.5)) * 0.85 + smoothstep(0.52, 0.74, fbm(tp * 0.9 + 21.0)) * 0.45;
    float detail = fbm(tp * 9.0);
    vec4 c1 = craters(tp * 4.0), c2 = craters(tp * 9.0), c3 = craters(tp * 17.0);
    float cr = c1.x * 0.35 + c2.x * 0.22 + c3.x * 0.12;
    float albedo = clamp(0.84 - 0.46 * min(maria, 1.0) + 0.20 * (detail - 0.5) + cr * 0.40, 0.10, 1.0);
    vec3 col = vec3(albedo) * vec3(0.93, 0.96, 1.0);

    // Relief: Höhengradient (Texturraum) → Blickraum, Normale kippen
    vec3 g = c1.yzw * (0.35 * 4.0) + c2.yzw * (0.22 * 9.0) + c3.yzw * (0.06 * 17.0);
    g = g * R;                                   // = transpose(R) * g
    vec3 bn = normalize(n - 0.028 * (g - dot(g, n) * n));

    vec3 L = normalize(sunDir);
    // Bei (fast) Vollmond kommt das Licht von vorn → Relief wäre flach. Für die Schattierung
    // daher leicht schräg (oben links) beleuchten; die Phasengrenze bleibt exakt.
    float frontal = smoothstep(0.55, 1.0, L.z);
    vec3 Lr = normalize(L + frontal * vec3(-0.55, 0.45, 0.0));
    float lit = smoothstep(-0.015, 0.05, dot(n, L));                       // scharfe Tag-Nacht-Grenze
    float ball = 0.30 + 0.70 * pow(max(dot(n, Lr), 0.0), 0.85);           // Kugelschattierung
    float bump = clamp(max(dot(bn, Lr), 0.0) / max(dot(n, Lr), 0.15), 0.35, 1.6);
    float ao = clamp(1.0 + cr * 0.9, 0.55, 1.15);                          // Kraterböden etwas dunkler
    vec3 outc = col * lit * ball * bump * ao * 1.18;
    outc += col * vec3(0.55, 0.70, 0.95) * 0.05 * (1.0 - lit);              // Erdschein
    float fres = pow(1.0 - n.z, 3.0);
    outc += vec3(0.45, 0.80, 1.0) * fres * (0.06 + 0.26 * lit);            // kühler Randlichtsaum (HUD)
    outc = pow(max(outc, 0.0), vec3(0.92));                                // etwas mehr Brillanz
    gl_FragColor = vec4(min(outc, vec3(1.0)) * edge, edge);
  } else {
    // --- Sonne ---
    float mu = n.z;
    float limb = 1.0 - 0.70 * (1.0 - pow(mu, 0.5));                       // Randverdunkelung
    float gran = fbm(tp * 30.0 + vec3(0.0, t * 0.08, t * 0.05));
    gran = smoothstep(0.25, 0.75, gran);                                   // feine, klare Granulen
    float swirl = fbm(tp * 3.0 + vec3(t * 0.02));
    float sp = fbm(tp * 2.2 + 11.0);
    float umbra = smoothstep(0.755, 0.775, sp), penumbra = smoothstep(0.700, 0.735, sp);
    float fac = smoothstep(0.58, 0.72, fbm(tp * 7.0 + 5.0)) * pow(1.0 - mu, 1.5); // helle Fackeln am Rand
    vec3 hot = vec3(1.0, 0.86, 0.40), warm = vec3(1.0, 0.48, 0.05), deep = vec3(0.62, 0.14, 0.02);
    vec3 col = mix(deep, mix(warm, hot, pow(limb, 1.4)), smoothstep(0.15, 0.85, limb));
    col *= (0.88 + 0.24 * gran + 0.10 * swirl);
    col *= (1.0 - 0.45 * penumbra) * (1.0 - 0.75 * umbra);
    col += vec3(1.0, 0.80, 0.40) * fac * 0.30;
    col *= 0.20 + 0.88 * limb;
    // Glanzpunkt oben links → wirkt als Kugel
    float hl = pow(max(dot(n, normalize(vec3(-0.40, 0.45, 0.80))), 0.0), 10.0);
    col += vec3(1.0, 0.95, 0.75) * hl * 0.16;
    col += vec3(1.0, 0.45, 0.10) * pow(1.0 - mu, 4.0) * 0.35;             // glühender Rand
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
      const dpr = Math.min(3, window.devicePixelRatio || 1); // scharf auf iPhone (3x)
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
