"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { SignInGate } from "@/lib/auth/gates";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F5F9F5] px-6 py-12 text-[#18241E]">
      <div className="w-full max-w-md">
        <Link href="/" className="text-2xl font-semibold text-[#176343]">shiftii<span className="text-[#58B785]">.</span></Link>
        <div className="mt-9 rounded-3xl border border-[#E2EBE3] bg-white p-7 shadow-[0_25px_85px_rgba(20,61,39,0.07)] sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
          <p className="mt-3 text-sm leading-6 text-[#647368]">Sign in to your company workspace and get back to your team.</p>
          <div className="mt-7">
            <SignInGate fallback={<LoginFields/>}>
              <p className="text-sm text-[#647368]">You are already signed in.</p>
              <Link href="/app" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white">Open workspace <ArrowRight size={18}/></Link>
            </SignInGate>
          </div>
        </div>
        <p className="mt-7 text-center text-sm text-[#647368]">New to Shiftii? <Link href="/signup" className="font-semibold text-[#176343] hover:underline">Create an account</Link></p>
      </div>
    </main>
  );
}

function LoginFields() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
        callbackURL: nextDestination(),
      });
      if (result.error) setError(result.error.message ?? "Could not sign in.");
      else window.location.assign(nextDestination());
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const field = "mt-2 w-full rounded-xl border border-[#D8E5DB] px-4 py-3 text-[#18241E] outline-none focus:border-[#248357] focus:ring-4 focus:ring-[#248357]/10";
  if (!authEnabled) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Authentication is disabled in this environment.</p>;
  return <div>
    <form onSubmit={submit} className="space-y-5">
      <div><label className="text-sm font-medium" htmlFor="login-email">Email address</label><input id="login-email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className={field}/></div>
      <div><label className="text-sm font-medium" htmlFor="login-password">Password</label><input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className={field}/></div>
      <div className="text-right"><Link href="/forgot-password" className="text-sm font-medium text-[#176343] hover:underline">Forgot password?</Link></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176343] px-5 py-3.5 font-semibold text-white hover:bg-[#10492F] disabled:opacity-60">{busy ? <><Loader2 size={18} className="animate-spin"/> Signing in...</> : <>Sign in <ArrowRight size={18}/></>}</button>
    </form>
    {GROK_PROVIDERS.length > 0 && <div className="mt-6">
      <div className="relative mb-5 text-center text-xs text-[#8A9B8E]"><span className="bg-white px-3">or continue with</span></div>
      <div className="grid gap-2">{GROK_PROVIDERS.map(provider=><button key={provider.providerId} type="button" onClick={()=>{void signIn(provider.providerId,{callbackURL:"/app"}).catch(()=>setError("Provider sign-in failed."));}} className="rounded-xl border border-[#D8E5DB] px-4 py-3 text-sm font-medium hover:bg-[#F5F9F5]">Continue with {provider.label}</button>)}</div>
    </div>}
  </div>;
}

function nextDestination(): string {
  if (typeof window === "undefined") return "/app";
  const token = new URLSearchParams(window.location.search).get("invite");
  // Only allow server-issued invite token destinations, not arbitrary URLs.
  return token && /^[a-f0-9]{64}$/.test(token) ? `/invite/${token}` : "/app";
}
