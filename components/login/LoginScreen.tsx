"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
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
  "h-12 w-full rounded-xl border bg-transparent px-4 text-base text-text outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-text-tertiary";

// Fields are drawn by their outline alone, strong enough to read even when empty. An error
// keeps its colour through focus, so the field you're sent to fix looks wrong.
// While the demo types into a field, it wears the focus look so the eye follows along.
const fieldTone = (error: string | undefined, typing: boolean) =>
  error
    ? "border-error/60 focus:border-error/70 focus:ring-[3px] focus:ring-error/15"
    : typing
      ? "border-accent/60 ring-[3px] ring-accent/12"
      : "border-line-strong focus:border-accent/60 focus:ring-[3px] focus:ring-accent/12";

const labelClass = "block text-[0.8125rem] font-medium leading-5 text-text-secondary";

// Links are the logo's lavender at rest, so they never pass for a label; white on hover.
const linkClass =
  "rounded-sm font-medium text-accent transition-[color,opacity] duration-150 hover:text-text active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// UI only: these links have no destinations until the account flows exist.
const placeholderLink = (event: MouseEvent<HTMLAnchorElement>) => event.preventDefault();

// Chrome fills saved logins before any script sees an input event, so ask the field itself.
const isAutofilled = (input: HTMLInputElement | null) => {
  if (!input) return false;
  if (input.value) return true;
  try {
    return input.matches(":autofill");
  } catch {
    try {
      return input.matches(":-webkit-autofill");
    } catch {
      return false;
    }
  }
};

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
  const demoFilled = useRef(false);

  // The full intro is for the first visit; the layout's head script reads this flag.
  useEffect(() => {
    try {
      localStorage.setItem("nextstep:intro-seen", "1");
    } catch {}
  }, []);

  // ⚠️ DEMO ONLY — fills the demo account in once the card has arrived. First
  // visits watch it type; returning visits (and reduced motion) get it at once.
  useEffect(() => {
    let timer = 0;
    const fill = () => {
      setUsername(DEMO_CREDENTIALS.username);
      setPassword(DEMO_CREDENTIALS.password);
      demoFilled.current = true;
    };
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

    const shortIntro = document.documentElement.dataset.intro === "short";
    const instant = shortIntro || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Wait for the card's entrance: ~0.9s on a first visit, 0.3s after that.
    const startDelay = shortIntro ? 400 : 1000;

    timer = window.setTimeout(() => {
      if (demoStopped.current) return;
      // The browser already filled a saved login: leave it alone.
      if (isAutofilled(usernameRef.current) || isAutofilled(passwordRef.current)) {
        demoStopped.current = true;
        return;
      }
      if (instant) {
        fill();
        return;
      }
      type("username", 70, () => {
        timer = window.setTimeout(() => type("password", 50, () => (demoFilled.current = true)), 300);
      });
    }, startDelay);
    return () => window.clearTimeout(timer);
  }, []);

  // Any focus, edit or submit hands the form back to the person. A demo cut short
  // finishes at once rather than leaving half an account behind. Returns true if
  // it filled the fields just now (state won't show them until the next render).
  const takeOver = () => {
    if (demoStopped.current) return false;
    demoStopped.current = true;
    setDemoField(null);
    if (demoFilled.current) return false;
    setUsername(DEMO_CREDENTIALS.username);
    setPassword(DEMO_CREDENTIALS.password);
    demoFilled.current = true;
    return true;
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
    const justFilled = takeOver();
    const submittedUsername = justFilled ? DEMO_CREDENTIALS.username : username;
    const submittedPassword = justFilled ? DEMO_CREDENTIALS.password : password;

    const errors: FieldErrors = {};
    if (!submittedUsername.trim()) errors.username = "Enter your username.";
    if (!submittedPassword) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (errors.username || errors.password) {
      (errors.username ? usernameRef : passwordRef).current?.focus();
      shake();
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
      <MovingDotsAtmosphere />

      <div className="relative grid w-full max-w-5xl items-center gap-9 sm:gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="rise mb-7 flex items-center gap-3 sm:mb-10 lg:mb-14">
            <Image src="/logos/next_step_favicon.png" alt="" width={32} height={36} className="h-9 w-auto" priority />
            {/* The wordmark file has ~39% empty space above the letters; the window crops it to the glyphs. */}
            <span className="block h-7 overflow-hidden">
              <Image
                src="/logos/next_step_logo_words_1.png"
                alt="NextStep"
                width={151}
                height={46}
                className="-mt-[1.125rem] h-[2.875rem] w-auto max-w-none"
                priority
              />
            </span>
          </div>

          <h1 className="font-display text-[clamp(2.75rem,7vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] lg:tracking-[-0.035em]">
            {HEADLINE.map((line, lineIndex) => (
              <span key={lineIndex} className="block">
                {line.map((word, wordIndex) => (
                  <span key={word}>
                    {/* Real spaces between words, so copied, crawled and read-aloud text stays intact. */}
                    {(lineIndex > 0 || wordIndex > 0) && " "}
                    {/* The mask is padded so glyph overhangs (the P's stem, descenders) aren't clipped. */}
                    <span className="-ml-[0.06em] inline-block overflow-hidden pb-[0.1em] pl-[0.06em] pr-[0.04em] align-bottom">
                      {/* "next step" carries the accent from the start, laid over the plain text (via ::after). */}
                      <span
                        className={`word-rise relative inline-block ${ACCENT_WORDS.has(word) ? "headline-accent" : ""}`}
                        data-accent={ACCENT_WORDS.has(word) ? word : undefined}
                        style={{ animationDelay: `${0.12 + (lineIndex * 3 + wordIndex) * 0.06}s` }}
                      >
                        {word}
                      </span>
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p
            style={{ animationDelay: "0.5s" }}
            className="rise mt-6 max-w-[28rem] text-[clamp(1.25rem,1.8vw,1.5rem)] font-medium leading-[1.3] tracking-[-0.015em] text-text-tertiary"
          >
            {/* Apple's two-tone sentence: the lead in full white, the rest recedes. Two lines at every width. */}
            <span className="block text-text">Turn the pile in your head</span>{" "}
            <span className="subhead-tail block">into one clear step at a time.</span>
          </p>
        </section>

        <form
          style={{ animationDelay: "0.3s" }}
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="rise login-card mx-auto w-full max-w-[400px] rounded-3xl p-7 sm:p-8"
        >
          <h2 className="font-display text-[1.625rem] font-semibold leading-none tracking-[-0.02em]">Sign in</h2>

          <div className="mt-7 space-y-4">
            <div>
              <label htmlFor="username" className={`${labelClass} mb-2`}>
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
                onFocus={takeOver}
                onChange={(event) => {
                  takeOver();
                  setUsername(event.target.value);
                  setFieldErrors((errors) => ({ ...errors, username: undefined }));
                }}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? "username-error" : undefined}
                className={`${fieldClass} ${fieldTone(fieldErrors.username, demoField === "username")}`}
              />
              <p id="username-error" className="mt-1 h-5 text-[0.8125rem] leading-5 text-error">
                {fieldErrors.username && <span className="field-error block">{fieldErrors.username}</span>}
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <a href="#" onClick={placeholderLink} className={`${linkClass} text-[0.8125rem]`}>
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onFocus={takeOver}
                  onChange={(event) => {
                    takeOver();
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
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-text-tertiary transition-colors hover:text-text-secondary active:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
              <p id="password-error" className="mt-1 h-5 text-[0.8125rem] leading-5 text-error">
                {fieldErrors.password && <span className="field-error block">{fieldErrors.password}</span>}
              </p>
            </div>
          </div>

          <button type="submit" className="primary-button mt-3">
            Sign in
          </button>

          <p className="mt-5 text-center text-[0.8125rem] text-text-secondary">
            New here?{" "}
            <a href="#" onClick={placeholderLink} className={linkClass}>
              Create an account
            </a>
          </p>
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
