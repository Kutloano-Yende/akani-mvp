"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, type ActionResult } from "./actions";
import { LoginSocialButton } from "@/components/login-social-button";

// Social sign-in is shown only for providers that are actually enabled in
// Supabase Auth, e.g. NEXT_PUBLIC_OAUTH_PROVIDERS="google,azure".
const enabledProviders = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, formData) => signIn(formData),
    undefined,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3" noValidate={false}>
        <input type="hidden" name="next" value={next} />

        {state?.error && (
          <div
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="login-label block text-sm font-medium text-akani-navy">
            Email address
          </label>
          <div className="login-fieldwrap mt-1.5 flex items-center gap-2 rounded-lg border border-akani-border bg-white px-3 focus-within:border-akani-gold focus-within:ring-1 focus-within:ring-akani-gold">
            <EnvelopeIcon />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              className="h-11 w-full border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="login-label block text-sm font-medium text-akani-navy">
            Password
          </label>
          <div className="login-fieldwrap mt-1.5 flex items-center gap-2 rounded-lg border border-akani-border bg-white px-3 focus-within:border-akani-gold focus-within:ring-1 focus-within:ring-akani-gold">
            <LockIcon />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              className="h-11 w-full border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="login-icon shrink-0 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="login-label flex items-center gap-2 text-akani-navy">
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              className="h-4 w-4 rounded border-akani-border accent-akani-gold"
            />
            Remember me
          </label>
          <Link
            href="/login/forgot-password"
            className="font-medium text-akani-gold hover:text-akani-gold-bright"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-akani-gold text-sm font-semibold text-white shadow-sm transition-colors hover:bg-akani-gold-bright disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ButtonLockIcon />
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {enabledProviders.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="login-divider-line h-px flex-1 bg-akani-border" />
            <span className="login-divider-text text-xs text-akani-muted">or continue with</span>
            <span className="login-divider-line h-px flex-1 bg-akani-border" />
          </div>

          <div className="space-y-2">
            {enabledProviders.includes("google") && (
              <LoginSocialButton provider="google" label="Continue with Google" icon={<GoogleIcon />} />
            )}
            {enabledProviders.includes("azure") && (
              <LoginSocialButton provider="azure" label="Continue with Microsoft" icon={<MicrosoftIcon />} />
            )}
          </div>
        </>
      )}

      <div className="login-mfa-row flex items-center gap-3 text-sm text-akani-navy">
        <span className="login-divider-line h-px flex-1 bg-akani-border" />
        <span className="flex items-center gap-1.5 whitespace-nowrap font-medium">
          <ShieldIcon />
          Use Authenticator App (MFA)
        </span>
        <span className="login-divider-line h-px flex-1 bg-akani-border" />
      </div>
    </div>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="login-icon shrink-0 text-slate-400">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="login-icon shrink-0 text-slate-400">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ButtonLockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="white" strokeWidth="1.8" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.5 6.8C4.3 8.2 2.9 10 2 12c0 0 3.5 7 10 7 1.8 0 3.4-.4 4.8-1.1M9.4 4.9A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7-.5 1-1.4 2.4-2.7 3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
        stroke="#d6a000"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.5-6.5C35.3 2.6 30 0.5 24 0.5 14.6 0.5 6.5 5.9 2.6 13.8l7.6 5.9C12.1 13.6 17.5 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4Z"
      />
      <path
        fill="#FBBC05"
        d="M10.2 19.7a14.5 14.5 0 0 0 0 8.6l-7.6 5.9a24 24 0 0 1 0-20.4l7.6 5.9Z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c6 0 11.3-2 15-5.4l-7.3-5.7c-2 1.4-4.6 2.2-7.7 2.2-6.5 0-11.9-4.1-13.8-9.8l-7.6 5.9C6.5 42.1 14.6 47.5 24 47.5Z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="9.2" height="9.2" fill="#F35325" />
      <rect x="12.8" y="2" width="9.2" height="9.2" fill="#81BC06" />
      <rect x="2" y="12.8" width="9.2" height="9.2" fill="#05A6F0" />
      <rect x="12.8" y="12.8" width="9.2" height="9.2" fill="#FFBA08" />
    </svg>
  );
}

