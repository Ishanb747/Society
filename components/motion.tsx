"use client";
import { useEffect, useRef, useState } from "react";

/** Marks every [data-reveal] element below the fold as hidden, then fades it in as it scrolls into view. Content stays visible without JS. */
export function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px", threshold: 0.05 },
    );
    for (const el of els) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      el.classList.add("rv-pre");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return null;
}

/** Counts up to a number when scrolled into view. Shows the final value for SSR and reduced motion. */
export function CountUp({ to, suffix = "", className }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1400);
        setV(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref} className={className}>{v.toLocaleString("en-IN")}{suffix}</span>;
}
