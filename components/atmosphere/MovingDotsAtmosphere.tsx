"use client";

import { motion, type MotionValue, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useLayoutEffect, useRef } from "react";

const BG_BASE = "#0e0c14";
const BG_VIGNETTE_EDGE = "rgba(8,6,14,0.88)";

type BackdropDot = { bx: number; by: number; seed: number };

function hashSeed(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) * 2.3283064365386963e-10;
}

function MovingBackdropDots({
  mouseX,
  mouseY,
}: {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const dotsRef = useRef<BackdropDot[]>([]);
  const mouseXRef = useRef(mouseX);
  const mouseYRef = useRef(mouseY);

  useLayoutEffect(() => {
    mouseXRef.current = mouseX;
    mouseYRef.current = mouseY;
  }, [mouseX, mouseY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let viewportResize: (() => void) | null = null;
    let stopped = false;
    let rafT0: number | null = null;

    const rebuildDots = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const spacing = 30;
      const list: BackdropDot[] = [];
      let row = 0;
      for (let y = spacing * 0.5; y < h + spacing; y += spacing, row++) {
        const shift = (row % 2) * (spacing * 0.5);
        for (let x = spacing * 0.5 + shift; x < w + spacing; x += spacing) {
          list.push({
            bx: x,
            by: y,
            seed: hashSeed(Math.floor(x), Math.floor(y)) * Math.PI * 2,
          });
        }
      }
      dotsRef.current = list;
    };

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      rebuildDots();
    };

    resize();
    window.addEventListener("resize", resize);
    /**
     * Safari zoom can alter viewport metrics / pixel ratio without firing a classic window resize.
     * VisualViewport events keep the canvas backing store aligned with CSS pixels.
     */
    if (window.visualViewport) {
      viewportResize = () => resize();
      window.visualViewport.addEventListener("resize", viewportResize);
      window.visualViewport.addEventListener("scroll", viewportResize);
    }

    const draw = (ts: number) => {
      if (stopped) return;

      if (rafT0 === null) rafT0 = ts;
      const t = (ts - rafT0) / 1000;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (Math.abs(nextDpr - dpr) > 0.001) resize();
      let mx = mouseXRef.current.get();
      let my = mouseYRef.current.get();
      if (!Number.isFinite(mx)) mx = w * 0.5;
      if (!Number.isFinite(my)) my = h * 0.4;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const influence = 168;
      const pushMax = 16;
      const dots = dotsRef.current;

      for (let i = 0; i < dots.length; i++) {
        const { bx, by, seed } = dots[i]!;
        const ax = bx * 0.019;
        const ay = by * 0.021;
        const u = t * 1.65 + seed;
        const v = t * 2.2 + seed * 0.63;

        let ox =
          2.75 * Math.sin(u + ax) +
          1.95 * Math.cos(v * 0.9 - ay) +
          1.05 * Math.sin(t * 3.05 + seed * 1.65 + ay * 0.4);
        let oy =
          2.55 * Math.cos(u * 0.88 + ay) +
          1.75 * Math.sin(v + ax * 0.8) +
          0.95 * Math.cos(t * 3.2 + seed * 1.4 - ax * 0.35);

        const distAnchor = Math.hypot(bx - mx, by - my);
        const falloff = distAnchor < influence ? 1 - distAnchor / influence : 0;
        const stir = 1 + falloff * 0.95;
        ox *= stir;
        oy *= stir;

        let px = bx + ox;
        let py = by + oy;

        const dx = px - mx;
        const dy = py - my;
        const d = Math.hypot(dx, dy);
        const pf = d < influence ? 1 - d / influence : 0;
        const push = pf * pushMax * (1 + pf * 0.25);
        if (d > 0.5) {
          px += (dx / d) * push;
          py += (dy / d) * push;
        }

        const glow =
          distAnchor < influence * 1.5 ? Math.max(0, 1 - distAnchor / (influence * 1.5)) : 0;
        const alpha = 0.125 + glow * 0.34;
        const radius = 1.38 + glow * 0.62;

        /* Slightly cooler / whiter than before so dots read a bit brighter on #0e0c14 */
        ctx.fillStyle = `rgba(248, 246, 253, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      stopped = true;
      window.removeEventListener("resize", resize);
      if (window.visualViewport && viewportResize) {
        window.visualViewport.removeEventListener("resize", viewportResize);
        window.visualViewport.removeEventListener("scroll", viewportResize);
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
      aria-hidden
    />
  );
}

/**
 * Full-viewport animated dot field + soft cursor spotlight (matches Brain Dump).
 * Render once inside a `relative` page root; keep page chrome backgrounds translucent where dots should show.
 */
export function MovingDotsAtmosphere({ disabled = false }: { disabled?: boolean }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const spotlightX = useSpring(mouseX, { stiffness: 42, damping: 24, mass: 0.55 });
  const spotlightY = useSpring(mouseY, { stiffness: 42, damping: 24, mass: 0.55 });

  useEffect(() => {
    const centerPointer = () => {
      mouseX.set(window.innerWidth / 2);
      mouseY.set(window.innerHeight * 0.38);
    };
    centerPointer();

    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", centerPointer);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", centerPointer);
    };
  }, [mouseX, mouseY]);

  if (disabled) return null;

  const cursorGlow = useMotionTemplate`radial-gradient(52vmin circle at ${spotlightX}px ${spotlightY}px, rgba(118,108,148,0.26) 0%, rgba(82,76,102,0.14) 34%, rgba(48,46,58,0.09) 54%, transparent 72%)`;
  const cursorCore = useMotionTemplate`radial-gradient(18vmin circle at ${spotlightX}px ${spotlightY}px, rgba(100,94,125,0.14) 0%, transparent 58%)`;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 z-0" style={{ backgroundColor: BG_BASE }} />
      <div className="onboarding-grid-bg absolute inset-0 z-0 opacity-50" />

      <motion.div className="absolute inset-0 z-[1] opacity-[0.95]" style={{ backgroundImage: cursorGlow }} />
      <motion.div
        className="absolute inset-0 z-[1] mix-blend-soft-light opacity-80"
        style={{ backgroundImage: cursorCore }}
      />

      <MovingBackdropDots mouseX={spotlightX} mouseY={spotlightY} />

      <div
        className="absolute inset-0 z-[3]"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 50% 0%, transparent 40%, ${BG_VIGNETTE_EDGE} 100%)`,
        }}
      />
    </div>
  );
}
