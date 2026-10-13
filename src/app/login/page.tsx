"use client";

import Link from "next/link";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { SignInGate } from "@/lib/auth/gates";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg text-fg grid place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <p className="text-xs tracking-[0.22em] uppercase text-muted">
          Shiftii
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-balance">
          Sign in to your unit.
        </h1>
        <p className="mt-3 text-muted text-pretty leading-relaxed">
          Charge nurses and staff use the same hospital. Coverage, claims, and
          fatigue scores stay inside your organization.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-bg-elevated p-5">
          <SignInGate fallback={<ProviderButtons />}>
            <p className="text-sm text-muted">You are already signed in.</p>
            <Link
              href="/"
              className="mt-4 flex h-11 items-center justify-center rounded-md bg-accent text-accent-fg font-medium"
            >
              Open hospital
            </Link>
          </SignInGate>
        </div>
      </div>
    </main>
  );
}

function ProviderButtons() {
  if (!authEnabled) {
    return <p className="text-sm text-muted">Sign-in is disabled.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          onClick={() => signIn(p.providerId, { callbackURL: "/" })}
          className="h-11 w-full rounded-md border border-border bg-bg-subtle text-sm font-medium text-fg hover:bg-bg-elevated"
        >
          Continue with {p.label}
        </button>
      ))}
    </div>
  );
}
