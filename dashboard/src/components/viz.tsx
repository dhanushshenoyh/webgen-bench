"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up to a value the first time it scrolls into view. */
export function CountUp({ value, decimals = 0, duration = 1100, className = "" }: { value: number | null; decimals?: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (value === null) return;
    const el = ref.current;
    if (!el || reduced() || !("IntersectionObserver" in window)) { setShown(value); return; }
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(value * (1 - Math.pow(1 - t, 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [value, duration]);
  return <span ref={ref} className={className}>{value === null ? "—" : (shown ?? 0).toFixed(decimals)}</span>;
}

/** Card that tilts toward the pointer with a soft light following it. */
export function TiltCard({ children, className = "", glow = "rgb(255 255 255 / 0.5)" }: { children: ReactNode; className?: string; glow?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (event: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reduced() || event.pointerType !== "mouse") return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 6}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 8}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`wb-tilt relative ${className}`} style={{ ["--glow" as string]: glow }}>
      {children}
      <span aria-hidden className="wb-tilt-light pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  );
}

/** Segmented control with a sliding indicator. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-grid rounded-full border border-[var(--wb-line)] bg-white p-1 text-sm" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span aria-hidden className="absolute inset-y-1 left-1 rounded-full bg-[var(--wb-ink)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`relative z-10 rounded-full px-4 py-1.5 transition-colors duration-200 ${o.value === value ? "text-white" : "text-[var(--wb-muted)] hover:text-[var(--wb-ink)]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Thin progress bar showing how far down the page you are. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => { const h = document.documentElement; setP(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)); };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-[var(--wb-signal)]" style={{ transform: `scaleX(${p})` }} />;
}

/** A metric on a good / needs work / poor track, with the value's marker sliding in. */
export function Bullet({ label, value, unit, good, poor, max, format }: { label: string; value: number; unit: string; good: number; poor: number; max: number; format: (v: number) => string }) {
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const tone = value <= good ? "#10a37f" : value <= poor ? "#e8a200" : "#e5484d";
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-[var(--wb-muted)]">{label}</span>
        <span className="wb-num text-sm font-semibold" style={{ color: tone }}>{format(value)}{unit}</span>
      </div>
      <div className="relative h-2.5 overflow-visible rounded-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          <span className="h-full bg-emerald-200" style={{ width: pos(good) }} />
          <span className="h-full bg-amber-200" style={{ width: `calc(${pos(poor)} - ${pos(good)})` }} />
          <span className="h-full flex-1 bg-rose-200" />
        </div>
        <span className="wb-bullet absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: pos(value), background: tone }} />
      </div>
    </div>
  );
}

/** Each judge as a dot on a 1–5 line per builder, so disagreement is visible at a glance. */
export function JudgeDots({ rows, judges }: { rows: { name: string; color: string; scores: (number | null)[] }[]; judges: string[] }) {
  const x = (v: number) => `${((v - 1) / 4) * 100}%`;
  const shapes = ["circle", "square", "diamond"];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-4 text-xs text-[var(--wb-muted)]">
        {judges.map((j, i) => <span key={j} className="flex items-center gap-1.5"><Shape kind={shapes[i % 3]} color="#12153d" />{j}</span>)}
      </div>
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 text-sm">
          <span className="truncate font-medium">{row.name}</span>
          <div className="relative h-8">
            <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--wb-line)]" />
            {[1, 2, 3, 4, 5].map((t) => <span key={t} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--wb-line)]" style={{ left: x(t) }} />)}
            {row.scores.map((s, i) => s === null ? null : (
              <span key={i} title={`${judges[i]}: ${s.toFixed(1)}`} className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125" style={{ left: x(s) }}>
                <Shape kind={shapes[i % 3]} color={row.color} size={14} />
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[6.5rem_1fr] gap-3 text-[11px] text-[var(--wb-muted)]">
        <span />
        <div className="relative h-4">{[1, 2, 3, 4, 5].map((t) => <span key={t} className="wb-num absolute -translate-x-1/2" style={{ left: x(t) }}>{t}</span>)}</div>
      </div>
    </div>
  );
}

function Shape({ kind, color, size = 10 }: { kind: string; color: string; size?: number }) {
  if (kind === "square") return <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden><rect x="1" y="1" width="8" height="8" rx="1.5" fill={color} stroke="white" strokeWidth="1" /></svg>;
  if (kind === "diamond") return <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden><path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill={color} stroke="white" strokeWidth="1" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4.2" fill={color} stroke="white" strokeWidth="1" /></svg>;
}

/** Inline check / cross used for brief coverage. */
export function Mark({ ok }: { ok: boolean }) {
  return ok
    ? <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-label="present"><circle cx="8" cy="8" r="8" fill="#10a37f" /><path d="M4.5 8.2 7 10.5 11.5 5.8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-label="missing"><circle cx="8" cy="8" r="8" fill="#e5484d" /><path d="M5.5 5.5 10.5 10.5M10.5 5.5 5.5 10.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/** Semicircle gauge whose arc sweeps to the value once in view. */
export function ArcGauge({ value, max, color, label }: { value: number | null; max: number; color: string; label: string }) {
  const r = 80, c = Math.PI * r;
  const ref = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative w-full max-w-[220px]">
      <svg ref={ref} viewBox="0 0 200 116" className="w-full" aria-label={`${label}: ${value === null ? "no score" : value.toFixed(1)} out of ${max}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#eef0f7" strokeWidth="16" strokeLinecap="round" />
        {[0.25, 0.5, 0.75].map((t) => { const a = Math.PI * (1 - t); return <line key={t} x1={100 + 62 * Math.cos(a)} y1={100 - 62 * Math.sin(a)} x2={100 + 68 * Math.cos(a)} y2={100 - 68 * Math.sin(a)} stroke="#cfd4e6" strokeWidth="2" strokeLinecap="round" />; })}
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={on ? c * (1 - pct) : c} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-x-0 bottom-1 grid justify-items-center">
        <CountUp value={value} decimals={1} duration={1400} className="wb-num text-4xl font-bold leading-none text-[var(--wb-ink)]" />
        <span className="text-xs text-[var(--wb-muted)]">out of {max}</span>
      </div>
    </div>
  );
}
