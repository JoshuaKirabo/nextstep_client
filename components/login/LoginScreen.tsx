"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MovingDotsAtmosphere } from "@/components/atmosphere/MovingDotsAtmosphere";

type FieldErrors = { username?: string; password?: string };
type DemoField = "username" | "password";

/*
 * ⚠️ DEMO ONLY — the login form types this account in by itself so anyone
 * trying the app can sign in without looking it up. Documented in README.md.
 * TODO: remove (with the typing effect in LoginScreen) once real auth lands.
 */
const DEMO_CREDENTIALS = { username: "demouser", password: "NextStepDemoUser001" };

const HEADLINE = [["Your", "next", "step"], ["is", "waiting."]];
const ACCENT_WORDS = new Set(["next", "step"]);

const fieldClass =
  "h-12 w-full rounded-xl border bg-field px-4 text-base text-text outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-accent/60 focus:ring-[3px] focus:ring-accent/12";

// Fields sit borderless on the card, set apart by tone. While the demo types
// into a field, it wears the focus look so the eye follows along.
const fieldTone = (error: string | undefined, typing: boolean) =>
  error ? "border-error/60" : typing ? "border-accent/60 ring-[3px] ring-accent/12" : "border-transparent";

// Floema's uppercase nav treatment: 12px, regular weight, -0.02em, 1.4 line height.
const labelClass = "mb-2 block text-xs font-normal uppercase leading-[1.4] tracking-[-0.02em] text-text-secondary";

export function LoginScreen() {
  const reduceMotion = useReducedMotion();
  const formRef = useRef<HTMLFormElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [demoField, setDemoField] = useState<DemoField | null>(null);
  const demoStopped = useRef(false);

  // The full intro is for the first visit; the layout's head script reads this flag.
  useEffect(() => {
    try {
      localStorage.setItem("nextstep:intro-seen", "1");
    } catch {}
  }, []);

  // ⚠️ DEMO ONLY — types the demo account in once the card has arrived. Any
  // focus, edit or submit hands the form back to the person.
  useEffect(() => {
    let timer = 0;
    const type = (field: DemoField, speedMs: number, then?: () => void) => {
      const text = DEMO_CREDENTIALS[field];
      const set = field === "username" ? setUsername : setPassword;
      let index = 0;
      const tick = () => {
        if (demoStopped.current) return;
        index += 1;
        set(text.slice(0, index));
        if (index < text.length) {
          timer = window.setTimeout(tick, speedMs);
        } else {
          setDemoField(null);
          then?.();
        }
      };
      setDemoField(field);
      timer = window.setTimeout(tick, speedMs);
    };

    // Wait for the card's entrance: ~0.9s on a first visit, 0.3s after that.
    const startDelay = document.documentElement.dataset.intro === "short" ? 400 : 1000;

    // Reduced motion: the account arrives filled in, without the typing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setTimeout(() => {
        if (demoStopped.current) return;
        setUsername(DEMO_CREDENTIALS.username);
        setPassword(DEMO_CREDENTIALS.password);
      }, startDelay);
      return () => window.clearTimeout(timer);
    }

    timer = window.setTimeout(
      () => type("username", 70, () => (timer = window.setTimeout(() => type("password", 50), 300))),
      startDelay,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const stopDemo = () => {
    demoStopped.current = true;
    setDemoField(null);
  };

  // The macOS "wrong password" shake: a decaying horizontal wobble.
  const shake = () => {
    if (reduceMotion) return;
    formRef.current?.animate(
      [0, -10, 9, -7, 5, -3, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    stopDemo();

    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = "Enter your username.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (errors.username || errors.password) {
      (errors.username ? usernameRef : passwordRef).current?.focus();
      shake();
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-12 sm:px-8">
      <MovingDotsAtmosphere />

      <div className="relative grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="rise mb-10 flex items-center gap-3 lg:mb-14">
            <Image src="/logos/next_step_favicon.png" alt="" width={32} height={36} className="h-9 w-auto" priority />
            <Image
              src="/logos/next_step_logo_words_1.png"
              alt="NextStep"
              width={131}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </div>

          <h1 className="font-display text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            {HEADLINE.map((line, lineIndex) => (
              <span key={lineIndex} className="block">
                {line.map((word, wordIndex) => (
                  <span key={word}>
                    {/* Real spaces between words, so copied, crawled and read-aloud text stays intact. */}
                    {(lineIndex > 0 || wordIndex > 0) && " "}
                    {/* The mask is padded so glyph overhangs (the P's stem, descenders) aren't clipped. */}
                    <span className="-ml-[0.06em] inline-block overflow-hidden pb-[0.1em] pl-[0.06em] pr-[0.04em] align-bottom">
                      {/* "next step" rises in plain text, then the accent fades in over it (via ::after). */}
                      <span
                        className={`word-rise relative inline-block ${ACCENT_WORDS.has(word) ? "headline-accent" : ""}`}
                        data-accent={ACCENT_WORDS.has(word) ? word : undefined}
                        style={{ animationDelay: `${0.12 + (lineIndex * 3 + wordIndex) * 0.06}s` }}
                      >
                        {word.endsWith(".") ? (
                          <>
                            {word.slice(0, -1)}
                            {/* The period lands a beat after its word. */}
                            <span className="headline-period">.</span>
                          </>
                        ) : (
                          word
                        )}
                      </span>
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p
            style={{ animationDelay: "0.5s" }}
            className="rise mt-6 max-w-[28rem] font-system text-[clamp(1.25rem,1.8vw,1.5rem)] font-medium leading-[1.3] tracking-[-0.022em] text-text-tertiary"
          >
            {/* Apple's two-tone sentence: the lead in full white, the rest recedes. */}
            <span className="text-text">Turn the pile in your head</span>
            <br className="hidden sm:block" /> <span className="subhead-tail">into one clear step at a time.</span>
          </p>
        </section>

        <form
          style={{ animationDelay: "0.3s" }}
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="rise login-card mx-auto w-full max-w-[400px] rounded-3xl p-7 sm:p-8"
        >
          <div className="flex items-end justify-between">
            <h2 className="font-display text-[1.625rem] font-semibold leading-none tracking-[-0.02em]">Sign in</h2>
            <Image src="/logos/next_step_favicon.png" alt="" width={22} height={25} className="h-6 w-auto" />
          </div>

          <div className="mt-7 space-y-3">
            <div>
              <label htmlFor="username" className={labelClass}>
                Username
              </label>
              <input
                ref={usernameRef}
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onFocus={stopDemo}
                onChange={(event) => {
                  stopDemo();
                  setUsername(event.target.value);
                  setFieldErrors((errors) => ({ ...errors, username: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? "username-error" : undefined}
                className={`${fieldClass} ${fieldTone(fieldErrors.username, demoField === "username")}`}
              />
              <p id="username-error" className="mt-1.5 h-5 text-[0.8125rem] leading-5 text-error">
                {fieldErrors.username}
              </p>
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onFocus={stopDemo}
                  onChange={(event) => {
                    stopDemo();
                    setPassword(event.target.value);
                    setFieldErrors((errors) => ({ ...errors, password: undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  className={`${fieldClass} pr-12 ${fieldTone(fieldErrors.password, demoField === "password")}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-text-tertiary transition-colors hover:text-text-secondary focus-visible:text-text focus-visible:outline-none"
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
              <p id="password-error" className="mt-1.5 h-5 text-[0.8125rem] leading-5 text-error">
                {fieldErrors.password}
              </p>
            </div>
          </div>

          <button type="submit" className="primary-button mt-5">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden>
      <path
        d="M1.75 10S4.75 4.25 10 4.25 18.25 10 18.25 10 15.25 15.75 10 15.75 1.75 10 1.75 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      {crossed && <path d="M3 17 17 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}
