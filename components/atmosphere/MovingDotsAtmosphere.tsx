"use client";

import { motion, type MotionValue, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

const BG_BASE = "#0e0c14";
const BG_VIGNETTE_EDGE = "rgba(8,6,14,0.88)";
/* Tuned so damping / (2·√(stiffness·mass)) comes out around 1.0 and 2π/√(stiffness/mass) around 0.8s. */
const SPOTLIGHT_SPRING = { stiffness: 34, damping: 8.6, mass: 0.55 };

const SPACING = 30;
const INFLUENCE = 168;
const GLOW_RANGE = INFLUENCE * 1.5;
const PUSH_MAX = 16;
const BASE_ALPHA = 0.125;
const GLOW_ALPHA = 0.34;
const BASE_RADIUS = 1.38;
const GLOW_RADIUS = 0.62;
const MAX_RADIUS = BASE_RADIUS + GLOW_RADIUS;

/* Full speed while the pointer (or its spring) is moving. The fades after are slow so half speed is plenty. */
const ACTIVE_FRAME_MS = 1000 / 60;
const IDLE_FRAME_MS = 1000 / 30;
const ACTIVE_WINDOW_MS = 1200;

/*
 * The dots wobble during the entrance and then go still. After that only the dots near the
 * pointer stir, and only while it's moving. Once everything's at rest the loop stops completely,
 * so nothing is moving around while someone's reading or typing.
 */
const INTRO_HOLD_S = 1.4;
const INTRO_FADE_S = 1.6;
const SHORT_INTRO_HOLD_S = 0.3;
const SHORT_INTRO_FADE_S = 1.2;
/* How long the pointer still counts as moving after its last event. */
const POINTER_MOVING_MS = 120;
/* The stir kicks in fast (~150ms) and fades out over ~1.2s. These are time constants in seconds. */
const STIR_RISE_S = 0.06;
const STIR_FADE_S = 0.4;
/* The spotlight spring creeps by tiny fractions of a pixel for seconds, so anything slower than this counts as stopped. */
const SPRING_SETTLED_PX_S = 3;

/* Full wobble during the hold, then it eases down to nothing. */
function introEnergy(elapsed: number, hold: number, fade: number): number
  {
    if(elapsed <= hold) return 1;
    const progress = (elapsed - hold) / fade;
    return progress >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * progress));
  }

/*
 * Each dot wobbles by adding up six sine waves, A·sin(ωt + φ). Every dot uses the same speeds and
 * only the starting offsets are different, so splitting it up like
 *   A·sin(ωt + φ) = sin(ωt)·A·cos(φ) + cos(ωt)·A·sin(φ)
 * means each frame only works out six sin/cos pairs total, and every dot is just multiplying and adding.
 * The first three waves move x and the last three move y.
 */
const FREQS = [1.65, 1.98, 3.05, 1.452, 2.2, 3.2];
const AMPS = [2.75, 1.95, 1.05, 2.55, 1.75, 0.95];
const TERMS = FREQS.length;

function wobblePhases(seed: number, ax: number, ay: number): number[]
  {
    const quarter = Math.PI / 2; // cos(x) = sin(x + π/2)
    return [seed + ax, 0.567 * seed - ay + quarter, 1.65 * seed + 0.4 * ay, 0.88 * seed + ay + quarter, 0.63 * seed + 0.8 * ax, 1.4 * seed - 0.35 * ax + quarter];
  }

function hashSeed(a: number, b: number): number
  {
    let h = (a * 374761393 + b * 668265263) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return (h ^ (h >>> 16)) * 2.3283064365386963e-10;
  }

type DotField = { count: number; base: Float32Array; coef: Float32Array };

function buildField(w: number, h: number): DotField
  {
    const xs: number[] = [];
    const ys: number[] = [];
    let row = 0;
    for(let y = SPACING * 0.5; y < h + SPACING; y += SPACING, row++)
      {
        const shift = (row % 2) * (SPACING * 0.5);
        for(let x = SPACING * 0.5 + shift; x < w + SPACING; x += SPACING)
          {
            xs.push(x);
            ys.push(y);
          }
      }

    const count = xs.length;
    const base = new Float32Array(count * 2);
    const coef = new Float32Array(count * TERMS * 2);
    for(let i = 0; i < count; i++)
      {
        const bx = xs[i]!;
        const by = ys[i]!;
        base[i * 2] = bx;
        base[i * 2 + 1] = by;
        const seed = hashSeed(Math.floor(bx), Math.floor(by)) * Math.PI * 2;
        const phases = wobblePhases(seed, bx * 0.019, by * 0.021);

        for(let k = 0; k < TERMS; k++)
          {
            coef[(i * TERMS + k) * 2] = AMPS[k]! * Math.cos(phases[k]!);
            coef[(i * TERMS + k) * 2 + 1] = AMPS[k]! * Math.sin(phases[k]!);
          }
      }
    return { count, base, coef };
  }

/* Drawing one dot ahead of time and stamping it everywhere, which is way cheaper than drawing each dot from scratch. */
function buildSprite(dpr: number): HTMLCanvasElement
  {
    const sprite = document.createElement("canvas");
    const size = Math.ceil(MAX_RADIUS * 2 * dpr) + 2;
    sprite.width = size;
    sprite.height = size;
    const sctx = sprite.getContext("2d")!;
    sctx.fillStyle = "#ffffff";
    sctx.beginPath();
    sctx.arc(size / 2, size / 2, MAX_RADIUS * dpr, 0, Math.PI * 2);
    sctx.fill();
    return sprite;
  }

function MovingBackdropDots({ mouseX, mouseY }: { mouseX: MotionValue<number>; mouseY: MotionValue<number> })
  {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() =>
      {
        const canvas = canvasRef.current;
        if(!canvas) return;
        const ctx = canvas.getContext("2d");
        if(!ctx) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sin = new Float32Array(TERMS);
        const cos = new Float32Array(TERMS);

        let dpr = 1;
        let w = 0;
        let h = 0;
        let field: DotField = { count: 0, base: new Float32Array(), coef: new Float32Array() };
        let sprite = buildSprite(dpr);
        let spriteHalf = 0;
        let raf = 0;
        let t0: number | null = null;
        let lastFrame = 0;
        let lastPointerMove = -Infinity;
        let stir = 0;
        const shortIntro = document.documentElement.dataset.intro === "short";
        const introHold = shortIntro ? SHORT_INTRO_HOLD_S : INTRO_HOLD_S;
        const introFade = shortIntro ? SHORT_INTRO_FADE_S : INTRO_FADE_S;

        const resize = () =>
          {
            w = window.innerWidth;
            h = window.innerHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            field = buildField(w, h);
            sprite = buildSprite(dpr);
            spriteHalf = sprite.width / (2 * dpr);
          };

        /* `intro` controls how much every dot wobbles, `stirEnergy` only does the ones near the pointer. */
        const render = (t: number, intro: number, stirEnergy: number) =>
          {
            let mx = mouseX.get();
            let my = mouseY.get();
            if(!Number.isFinite(mx)) mx = w * 0.5;
            if(!Number.isFinite(my)) my = h * 0.4;

            const moving = intro > 0 || stirEnergy > 0;
            if(moving)
              {
                for(let k = 0; k < TERMS; k++)
                  {
                    sin[k] = Math.sin(FREQS[k]! * t);
                    cos[k] = Math.cos(FREQS[k]! * t);
                  }
              }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalAlpha = BASE_ALPHA;
            let alpha = BASE_ALPHA;

            const { count, base, coef } = field;
            const glowRange2 = GLOW_RANGE * GLOW_RANGE;
            const influence2 = INFLUENCE * INFLUENCE;

            for(let i = 0; i < count; i++)
              {
                const bx = base[i * 2]!;
                const by = base[i * 2 + 1]!;

                const ax = bx - mx;
                const ay = by - my;
                const anchor2 = ax * ax + ay * ay;
                
                let radius = BASE_RADIUS;
                let dotAlpha = BASE_ALPHA;
                let amp = intro;

                // Most dots are nowhere near the pointer so they skip the square roots completely.
                if(anchor2 < glowRange2)
                  {
                    const distAnchor = Math.sqrt(anchor2);
                    const glow = 1 - distAnchor / GLOW_RANGE;
                    amp = Math.max(amp, stirEnergy * glow);
                    if(distAnchor < INFLUENCE) amp *= 1 + (1 - distAnchor / INFLUENCE) * 0.95;
                    dotAlpha = BASE_ALPHA + glow * GLOW_ALPHA;
                    radius = BASE_RADIUS + glow * GLOW_RADIUS;
                  }

                let ox = 0;
                let oy = 0;
                if(moving && amp > 0.001)
                  {
                    const c = i * TERMS * 2;
                    ox = amp * (sin[0]! * coef[c]! + cos[0]! * coef[c + 1]! + sin[1]! * coef[c + 2]! + cos[1]! * coef[c + 3]! + sin[2]! * coef[c + 4]! + cos[2]! * coef[c + 5]!);
                    oy = amp * (sin[3]! * coef[c + 6]! + cos[3]! * coef[c + 7]! + sin[4]! * coef[c + 8]! + cos[4]! * coef[c + 9]! + sin[5]! * coef[c + 10]! + cos[5]! * coef[c + 11]!);
                  }

                let px = bx + ox;
                let py = by + oy;

                if(anchor2 < glowRange2)
                  {
                    const dx = px - mx;
                    const dy = py - my;
                    const d2 = dx * dx + dy * dy;
                    if(d2 < influence2 && d2 > 0.25)
                      {
                        const d = Math.sqrt(d2);
                        const pf = 1 - d / INFLUENCE;
                        const push = pf * PUSH_MAX * (1 + pf * 0.25);
                        px += (dx / d) * push;
                        py += (dy / d) * push;
                      }
                  }

                if(dotAlpha !== alpha)
                  {
                    ctx.globalAlpha = dotAlpha;
                    alpha = dotAlpha;
                  }
                const half = spriteHalf * (radius / MAX_RADIUS);
                ctx.drawImage(sprite, px - half, py - half, half * 2, half * 2);
              }
          };

        const frame = (ts: number) =>
          {
            raf = requestAnimationFrame(frame);
            const budget = ts - lastPointerMove < ACTIVE_WINDOW_MS ? ACTIVE_FRAME_MS : IDLE_FRAME_MS;
            // Giving it 1ms of slack so a 60Hz screen doesn't get knocked down to 30fps by wobbly timestamps.
            if(ts - lastFrame < budget - 1) return;
            const dt = lastFrame ? Math.min(ts - lastFrame, 100) / 1000 : 0;
            lastFrame = ts;

            // Zooming in Safari can change the pixel ratio without firing a resize.
            if(Math.abs(Math.min(window.devicePixelRatio || 1, 2) - dpr) > 0.001) resize();
            if(t0 === null) t0 = ts;
            const elapsed = (ts - t0) / 1000;

            const target = ts - lastPointerMove < POINTER_MOVING_MS ? 1 : 0;
            const tau = target > stir ? STIR_RISE_S : STIR_FADE_S;
            stir += (target - stir) * (1 - Math.exp(-dt / tau));
            if(target === 0 && stir < 0.005) stir = 0;

            const intro = introEnergy(elapsed, introHold, introFade);
            render(elapsed, intro, stir);

            // Everything's still, so stopping the loop until the pointer, its spring or the window changes.
            if(intro === 0 && stir === 0 && !springMoving())
              {
                cancelAnimationFrame(raf);
                raf = 0;
              }
          };

        const springMoving = () => Math.abs(mouseX.getVelocity()) > SPRING_SETTLED_PX_S || Math.abs(mouseY.getVelocity()) > SPRING_SETTLED_PX_S;

        const wake = () =>
          {
            if(raf || reducedMotion.matches) return;
            lastFrame = 0;
            raf = requestAnimationFrame(frame);
          };

        const start = () =>
          {
            cancelAnimationFrame(raf);
            raf = 0;
            if(reducedMotion.matches)
              {
                // No movement here, just drawing it once and again only when the window changes.
                render(0, 0, 0);
              }
            else
              {
                wake();
              }
          };

        const onResize = () =>
          {
            resize();
            if(reducedMotion.matches) render(0, 0, 0);
            else wake();
          };
        const onPointerMove = () =>
          {
            lastPointerMove = performance.now();
            wake();
          };

        resize();
        start();
        window.addEventListener("resize", onResize);
        window.visualViewport?.addEventListener("resize", onResize);
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        reducedMotion.addEventListener("change", start);
        // The spotlight keeps gliding after the pointer stops (or leaves), so keep following it.
        const onSpringChange = () =>
          {
            if(springMoving()) wake();
          };
        const unsubscribeX = mouseX.on("change", onSpringChange);
        const unsubscribeY = mouseY.on("change", onSpringChange);

        return () =>
          {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            window.visualViewport?.removeEventListener("resize", onResize);
            window.removeEventListener("pointermove", onPointerMove);
            reducedMotion.removeEventListener("change", start);
            unsubscribeX();
            unsubscribeY();
          };
      }, [mouseX, mouseY]);

    return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[2] h-full w-full" aria-hidden />;
  }

/**
 * The full screen dot background with a soft glow that follows the cursor (same as Brain Dump). The dots
 * move during the entrance and near a moving pointer, and sit still the rest of the time.
 * Only put it once inside a `relative` page root, and keep backgrounds see-through anywhere the dots should show.
 */
export function MovingDotsAtmosphere({ disabled = false }: { disabled?: boolean })
  {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    // A soft follow that catches up in about 0.8s and settles without bouncing or dragging.
    const spotlightX = useSpring(mouseX, SPOTLIGHT_SPRING);
    const spotlightY = useSpring(mouseY, SPOTLIGHT_SPRING);

    useEffect(() =>
      {
        const centerPointer = () =>
          {
            mouseX.set(window.innerWidth / 2);
            mouseY.set(window.innerHeight * 0.38);
          };
        centerPointer();
        // Starting the glow where it rests instead of gliding in from the bottom left corner.
        spotlightX.jump(mouseX.get());
        spotlightY.jump(mouseY.get());

        const onMove = (e: PointerEvent) =>
          {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
          };
        // When the pointer leaves the window, the glow drifts home instead of waiting in a corner.
        const root = document.documentElement;
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("resize", centerPointer);
        root.addEventListener("mouseleave", centerPointer);
        return () =>
          {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("resize", centerPointer);
            root.removeEventListener("mouseleave", centerPointer);
          };
      }, [mouseX, mouseY, spotlightX, spotlightY]);

    if(disabled) return null;

    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 z-0" style={{ backgroundColor: BG_BASE }} />

        {/*
          The spotlight is one gradient that slides around with the pointer. Moving it with a transform
          keeps it on the GPU, rebuilding a full screen gradient was repainting it every frame.
        */}
        <motion.div className="absolute -left-[52vmin] -top-[52vmin] z-[1] size-[104vmin] opacity-[0.95] will-change-transform" style={{ x: spotlightX, y: spotlightY, backgroundImage: "radial-gradient(circle closest-side, rgba(214,213,255,0.13) 0%, rgba(214,213,255,0.06) 34%, rgba(214,213,255,0.03) 54%, transparent 72%)" }} />
        <motion.div className="absolute -left-[18vmin] -top-[18vmin] z-[1] size-[36vmin] mix-blend-soft-light opacity-80 will-change-transform" style={{ x: spotlightX, y: spotlightY, backgroundImage: "radial-gradient(circle closest-side, rgba(214,213,255,0.1) 0%, transparent 58%)" }} />

        <MovingBackdropDots mouseX={spotlightX} mouseY={spotlightY} />

        <div className="absolute inset-0 z-[3]" style={{ background: `radial-gradient(ellipse 90% 70% at 50% 0%, transparent 40%, ${BG_VIGNETTE_EDGE} 100%)` }} />
      </div>
    );
  }
