"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { lookupCompanyCode } from "@/lib/api/company-code";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

function redirectTarget() {
  if (typeof window !== "undefined") {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token && /^[a-f0-9]{64}$/.test(token)) return `/invite/${token}`;
  }
  return "/app";
}

export default function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [step, setStep] = useState<"company" | "credentials">("company");
  const [companyCode, setCompanyCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ownerLogin, setOwnerLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = "mt-2 w-full rounded-xl border border-[#DCE8DE] bg-white px-4 py-3.5 text-[15px] text-[#183622] outline-none transition placeholder:text-[#A0ACA2] focus:border-[#80BD4D] focus:ring-4 focus:ring-[#B6DC8A]/20";

  async function nextCompany(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await lookupCompanyCode(companyCode);
      if (!response.ok) { setError(response.error); return; }
      setCompanyName(response.data.companyName);
      setStep("credentials");
    } catch { setError("Couldn't look up that company. Try again."); }
    finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const target = redirectTarget();
      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(), password, callbackURL: target,
      });
      if (result.error) setError(result.error.message ?? "Incorrect email or password.");
      else window.location.assign(target);
    } catch { setError("We couldn't sign you in. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#F7F9F5] text-[#193824] lg:grid lg:grid-cols-[minmax(360px,0.85fr)_minmax(480px,1.15fr)]">
    <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#143D29] px-12 py-12 text-white lg:flex xl:px-16">
      <div className="pointer-events-none absolute -right-40 top-1/4 h-[520px] w-[520px] rounded-full border-[85px] border-[#A6CD51]/10"/>
      <div className="pointer-events-none absolute -bottom-36 -left-48 h-[420px] w-[420px] rounded-full bg-[#2D6442]/60 blur-3xl"/>
      <Link href="/" className="relative text-3xl font-bold tracking-tight">shiftii<span className="text-[#B8E069]">.</span></Link>
      <div className="relative max-w-md">
        <span className="rounded-full border border-[#A9D77D]/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#C4E99E]">Built for better shifts</span>
        <h1 className="mt-9 text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">Your workplace.<br/><span className="text-[#B8E069]">One simple space.</span></h1>
        <p className="mt-7 max-w-sm text-lg leading-8 text-[#C9DCCF]">Easy scheduling, smoother teamwork, and more time for the work that matters.</p>
        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><span className="rounded-xl bg-[#B8E069]/20 p-3"><ShieldCheck className="text-[#C9EF8C]" size={24}/></span><div><p className="font-semibold">A workspace that belongs to your team</p><p className="mt-1 text-sm text-[#D5E3D7]">Secure access for each company.</p></div></div>
      </div>
      <p className="relative text-xs text-[#A6C1AA]">© Shiftii · Staff scheduling made simpler</p>
    </aside>
    <section className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-7 sm:px-8">
        <Link href="/" className="text-2xl font-bold text-[#1C5B39] lg:hidden">shiftii<span className="text-[#9BCB4F]">.</span></Link>
        <span className="hidden text-sm text-[#7D8E80] lg:block">Welcome to Shiftii</span>
        <Link href="/signup" className="text-sm font-semibold text-[#256842] hover:underline">Create an account</Link>
      </header>
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-6 pb-16 sm:px-8">
        {isPending ? <p className="flex items-center gap-2 text-[#718474]"><Loader2 size={18} className="animate-spin"/> Checking account...</p> :
        user ? <div className="rounded-3xl border border-[#E3EAE2] bg-white p-8 shadow-sm"><CheckCircle2 className="text-[#6C9D38]" size={34}/><h2 className="mt-5 text-3xl font-semibold">You're signed in.</h2><p className="mt-3 text-[#748476]">Continue to your company workspace.</p><Link href="/app" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#1C5B39] px-5 py-3.5 font-semibold text-white">Open workspace <ArrowRight size={18}/></Link></div>
        : <>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.17em] text-[#699B3C]">{step === "company" && !ownerLogin ? "01 · Find your company" : "02 · Your account"}</p>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">{step === "company" && !ownerLogin ? "Where do you work?" : "Welcome back."}</h2>
          <p className="mt-4 text-base leading-7 text-[#7A8A7B]">{step === "company" && !ownerLogin ? "Enter your organization's access code to continue." : companyName ? `Sign in to ${companyName} with your account.` : "Enter your email and password to continue."}</p>
          {step === "company" && !ownerLogin ? <form onSubmit={nextCompany} className="mt-9 space-y-6">
            <label htmlFor="company-code" className="block text-sm font-semibold">Company access code<input id="company-code" required minLength={4} maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="e.g. NORTH-TEAM" className={field+" uppercase tracking-[0.08em]"} value={companyCode} onChange={e=>setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,""))}/></label>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={busy || !authEnabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C5B39] py-4 font-semibold text-white transition hover:bg-[#153F29] disabled:opacity-50">{busy ? <Loader2 size={18} className="animate-spin"/> : <Building2 size={18}/>} Continue <ArrowRight size={18}/></button>
            <button type="button" onClick={()=>{setOwnerLogin(true);setStep("credentials");setError("");}} className="w-full text-sm font-semibold text-[#256842] hover:underline">I'm a company owner · Sign in without a code</button>
          </form> : <form className="mt-9 space-y-5" onSubmit={submit}>
            {companyName && <div className="flex items-center gap-3 rounded-xl border border-[#D7E8D6] bg-[#F0F7ED] p-3"><Building2 size={19} className="text-[#39774B]"/><div><p className="text-xs text-[#719275]">Company</p><p className="text-sm font-semibold">{companyName}</p></div></div>}
            <label htmlFor="email" className="block text-sm font-semibold">Email address<input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} className={field} placeholder="you@company.com"/></label>
            <label htmlFor="password" className="block text-sm font-semibold">Password<div className="relative"><input id="password" type={showPassword?"text":"password"} required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className={field+" pr-12"} placeholder="Enter your password"/><button type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(x=>!x)} className="absolute inset-y-0 right-3 top-2 flex items-center px-2 text-[#728B74]">{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>
            <div className="flex justify-between gap-3"><button type="button" onClick={()=>{setStep("company");setOwnerLogin(false);setError("");}} className="inline-flex items-center gap-2 text-sm text-[#6D806F]"><ArrowLeft size={16}/> Back</button><Link href="/forgot-password" className="text-sm font-semibold text-[#256842]">Forgot password?</Link></div>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={!authEnabled||busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C5B39] py-4 font-semibold text-white transition hover:bg-[#153F29] disabled:opacity-50">{busy?<Loader2 size={18} className="animate-spin"/>:<LockKeyhole size={18}/>} Sign in <ArrowRight size={18}/></button>
            {GROK_PROVIDERS.length > 0 && <div className="space-y-2 border-t border-[#EDF0EB] pt-5">{GROK_PROVIDERS.map(p=><button key={p.providerId} type="button" onClick={()=>{void signIn(p.providerId,{callbackURL:redirectTarget()}).catch(()=>setError("Provider sign-in failed."));}} className="w-full rounded-xl border border-[#DCE8DE] px-4 py-3 text-sm font-medium hover:bg-[#F7FAF5]">Continue with {p.label}</button>)}</div>}
          </form>}
          {!authEnabled && <p className="mt-5 text-sm text-amber-800">Authentication must be enabled in this environment.</p>}
          <p className="mt-8 text-center text-sm text-[#7C8D7D]"><KeyRound className="mr-2 inline" size={15}/>Access codes identify a company. Your own login keeps it secure.</p>
        </>}
      </div>
    </section>
  </main>;
}
