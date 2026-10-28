"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export default function SignUpPage() {
  const { user, isPending } = useCurrentUserState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        callbackURL: nextDestination(),
      });
      if (result.error) {
        setError(result.error.message ?? "Could not create your account.");
      } else {
        window.location.assign(nextDestination());
      }
    } catch {
      setError("Could not create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-2 w-full rounded-xl border border-[#D8E5DB] bg-white px-4 py-3 text-[#18241E] outline-none focus:border-[#248357] focus:ring-4 focus:ring-[#248357]/10";
  return (
    <main className="min-h-screen bg-[#F5F9F5] text-[#18241E]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7"><Link href="/" className="text-2xl font-semibold text-[#176343]">shiftii<span className="text-[#58B785]">.</span></Link><Link href="/login" className="text-sm font-medium text-[#176343]">Already have an account? Sign in</Link></header>
      <div className="mx-auto grid max-w-5xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:items-center lg:pt-16">
        <div><span className="rounded-full bg-[#DDF2E4] px-3 py-2 text-xs font-semibold uppercase tracking-widest text-[#176343]">Step 1 of 2</span><h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Make managing shifts <span className="text-[#248357]">feel effortless.</span></h1><p className="mt-6 max-w-md leading-7 text-[#647368]">Create your account, set up your company and bring your team together in one beautiful workspace.</p><p className="mt-10 flex items-center gap-3 text-sm text-[#426B51]"><ShieldCheck size={22}/> Your workspace and staff data stay private to your organization.</p></div>
        <section className="rounded-3xl border border-[#E2EBE3] bg-white p-6 shadow-[0_25px_85px_rgba(20,61,39,0.07)] sm:p-10">
          <h2 className="text-2xl font-semibold">Create an account</h2><p className="mt-2 text-sm text-[#647368]">First, create your personal login.</p>
          {!authEnabled ? <p role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Account registration is not enabled in this environment. Enable authentication to continue.</p>
          : user && !isPending ? <div className="mt-7"><p className="text-sm text-[#647368]">You are already signed in.</p><Link href="/onboarding" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176343] px-5 py-3 text-white">Continue to company setup <ArrowRight size={18}/></Link></div>
          : <form onSubmit={submit} className="mt-7 space-y-5">
            <div><label htmlFor="full-name" className="text-sm font-medium">Full name</label><input id="full-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} className={field} placeholder="Your full name"/></div>
            <div><label htmlFor="email" className="text-sm font-medium">Work email</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="you@company.com"/></div>
            <div><label htmlFor="password" className="text-sm font-medium">Password</label><input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={field} placeholder="At least 8 characters"/></div>
            <div><label htmlFor="confirm" className="text-sm font-medium">Confirm password</label><input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className={field}/></div>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-4 font-semibold text-white hover:bg-[#10492F] disabled:opacity-60">{busy ? <><Loader2 size={18} className="animate-spin"/> Creating account...</> : <>Create account <ArrowRight size={18}/></>}</button>
            <p className="text-center text-xs text-[#849187]">You'll set up your company on the next screen.</p>
          </form>}
        </section>
      </div>
    </main>
  );
}

function nextDestination(): string {
  if (typeof window === "undefined") return "/onboarding";
  const token = new URLSearchParams(window.location.search).get("invite");
  // Only allow server-issued invite token destinations, not arbitrary URLs.
  return token && /^[a-f0-9]{64}$/.test(token) ? `/invite/${token}` : "/onboarding";
}
