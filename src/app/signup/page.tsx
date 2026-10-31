"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, MailCheck, ShieldCheck, UsersRound } from "lucide-react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { emailDeliveryStatus } from "@/lib/api/auth-status";
import { authEmailsEnabled } from "@/lib/auth/email-password";

export default function SignUpPage() {
  const { user, isPending } = useCurrentUserState();
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [emailReady,setEmailReady]=useState<boolean | null>(authEmailsEnabled ? null : true);
  const [verificationSent,setVerificationSent]=useState(false);
  const [verified,setVerified]=useState(false);
  const [otp,setOtp]=useState("");
  const [resendCooldown,setResendCooldown]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if (!authEmailsEnabled) return;
    void emailDeliveryStatus().then(s=>setEmailReady(s.configured)).catch(()=>setEmailReady(false));
  },[]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeout = setTimeout(() => setResendCooldown(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [resendCooldown]);

  async function verifyRegistrationCode(event: React.FormEvent) {
    event.preventDefault();setError("");
    if (!/^\d{6}$/.test(otp)) { setError("Enter the six-digit code from your email."); return; }
    setBusy(true);
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: email.trim().toLowerCase(), otp,
      });
      if (result.error) setError(result.error.message ?? "Invalid or expired code. Try again.");
      else { setVerified(true); setOtp(""); }
    } catch { setError("We could not verify your code. Please try again."); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    if (busy || resendCooldown > 0) return;
    setBusy(true);setError("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(), type: "email-verification",
      });
      if (result.error) setError(result.error.message ?? "Unable to resend the code.");
      else { setOtp("");setResendCooldown(60); }
    } catch {setError("Unable to resend the code. Try again.");}
    finally {setBusy(false);}
  }

  function destination() {
    if (typeof window !== "undefined") {
      const token=new URLSearchParams(window.location.search).get("invite");
      if (token && /^[a-f0-9]{64}$/.test(token)) return `/invite/${token}`;
    }
    return "/onboarding";
  }

  async function submit(e:React.FormEvent) {
    e.preventDefault();setError("");
    if(!emailReady)return;
    if(password.length<8||password.length>128){setError("Password must be 8–128 characters.");return;}
    if(password!==confirmation){setError("Passwords do not match.");return;}
    setBusy(true);
    try {
      const response=await authClient.signUp.email({name:name.trim(),email:email.trim().toLowerCase(),password,callbackURL:destination()});
      if(response.error)setError(response.error.message??"Unable to create your account.");
      else if (authEmailsEnabled) {setVerificationSent(true);setPassword("");setConfirmation("");setResendCooldown(60);}
      else {setPassword("");setConfirmation("");window.location.assign(destination());}
    }catch{setError("Unable to create your account. Please try again.");}
    finally{setBusy(false);}
  }

  const field="mt-2 w-full rounded-xl border border-[#DCE8DE] bg-white px-4 py-3.5 text-[15px] text-[#1A3824] outline-none transition placeholder:text-[#A1ADA2] focus:border-[#80BD4D] focus:ring-4 focus:ring-[#B6DC8A]/20";
  return <main className="min-h-screen bg-[#F7F9F5] text-[#193824] lg:grid lg:grid-cols-[minmax(360px,0.85fr)_minmax(480px,1.15fr)]">
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#143D29] px-12 py-12 text-white lg:flex xl:px-16">
      <div className="pointer-events-none absolute -right-48 top-1/3 h-[560px] w-[560px] rounded-full border-[95px] border-[#A6CD51]/10"/>
      <Link href="/" className="relative text-3xl font-bold tracking-tight">shiftii<span className="text-[#B8E069]">.</span></Link>
      <div className="relative max-w-md py-24"><span className="rounded-full border border-[#A9D77D]/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#C4E99E]">Welcome to Shiftii</span><h1 className="mt-9 text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">Better shifts.<br/><span className="text-[#B8E069]">Happier teams.</span></h1><p className="mt-7 max-w-sm text-lg leading-8 text-[#CDDDD0]">Create your account, register your company, then manage every shift in one beautiful workspace.</p>
        <div className="mt-12 space-y-5">{[["01","Create your account"],["02","Set up your company"],["03","Invite your team"]].map(([step,label])=><div key={step} className="flex items-center gap-4"><span className="grid h-10 w-10 place-items-center rounded-full border border-[#B8E069]/40 bg-[#B8E069]/10 text-sm font-bold text-[#C5E995]">{step}</span><span className="font-medium text-[#E3EEE3]">{label}</span></div>)}</div>
      </div>
      <p className="relative text-xs text-[#A6C1AA]">© Shiftii · Built for teams of every size</p>
    </aside>
    <section className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-7 sm:px-8"><Link href="/" className="text-2xl font-bold text-[#1C5B39] lg:hidden">shiftii<span className="text-[#9BCB4F]">.</span></Link><span className="hidden text-sm text-[#809081] lg:inline">Company registration</span><Link href="/login" className="text-sm font-semibold text-[#256842] hover:underline">Already registered? Sign in</Link></header>
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-6 pb-16 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#699B3C]">Step 1 of 2 · Account details</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Create your account.</h2>
        <p className="mt-4 text-base leading-7 text-[#7A8A7B]">Your own secure sign-in for Shiftii. You'll register your company next.</p>
        {verified ? <div className="mt-8 rounded-2xl border border-[#CBE5C9] bg-[#F0F8EC] p-6">
            <CheckCircle2 className="text-[#2D7B44]" size={34}/>
            <h3 className="mt-4 text-xl font-semibold">Email verified!</h3>
            <p role="status" className="mt-3 text-sm leading-6 text-[#617765]">Your Shiftii account is verified. Sign in using your email and password, then continue setting up your company.</p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1C5B39] px-5 py-3 font-semibold text-white">Sign in <ArrowRight size={17}/></Link>
          </div>
          : verificationSent ? <div className="mt-8 rounded-2xl border border-[#CBE5C9] bg-white p-6 shadow-sm">
            <MailCheck className="text-[#2D7B44]" size={34}/>
            <h3 className="mt-4 text-2xl font-semibold">Verify your email</h3>
            <p className="mt-3 text-sm leading-6 text-[#617765]">We sent a six-digit verification code to <strong>{email}</strong>. It expires in 10 minutes.</p>
            <form onSubmit={verifyRegistrationCode} className="mt-6 space-y-4">
              <label htmlFor="verification-otp" className="block text-sm font-semibold">Verification code
                <input id="verification-otp" autoFocus required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6}
                  value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                  placeholder="000000" className={field+" text-center text-2xl font-bold tracking-[0.35em]"} />
              </label>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
              <button type="submit" disabled={busy||otp.length!==6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C5B39] px-5 py-4 font-semibold text-white disabled:opacity-50">
                {busy ? <Loader2 size={18} className="animate-spin"/> : <ShieldCheck size={18}/>} Verify email <ArrowRight size={18}/>
              </button>
            </form>
            <button type="button" disabled={busy||resendCooldown>0} onClick={()=>{void resendCode();}} className="mt-5 w-full text-center text-sm font-semibold text-[#256842] disabled:opacity-50">
              {resendCooldown>0 ? `Resend code in ${resendCooldown}s` : "Resend verification code"}
            </button>
            <p className="mt-3 text-center text-xs text-[#7B8F7B]">Check your spam folder if the code hasn't arrived.</p>
          </div>
          : !authEnabled ? <p className="mt-7 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Authentication is disabled for this environment.</p>
          : user && !isPending ? <div className="mt-7"><CheckCircle2 className="text-[#2D7B44]" size={30}/><p className="mt-3 text-sm text-[#6E806F]">You're signed in already.</p><Link href="/onboarding" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1C5B39] px-5 py-3 text-white">Continue company registration <ArrowRight size={17}/></Link></div>
          : <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-sm font-semibold" htmlFor="full-name">Full name<input id="full-name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Your full name" className={field} value={name} onChange={e=>setName(e.target.value)}/></label>
            <label className="block text-sm font-semibold" htmlFor="signup-email">Email address<input id="signup-email" required type="email" autoComplete="email" placeholder="you@company.com" className={field} value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <label className="block text-sm font-semibold" htmlFor="signup-password">Create password<div className="relative"><input id="signup-password" required type={showPassword?"text":"password"} minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" className={field+" pr-12"} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShowPassword(s=>!s)} aria-label={showPassword?"Hide password":"Show password"} className="absolute inset-y-0 right-3 top-2 px-2 text-[#728B74]">{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>
            <label className="block text-sm font-semibold" htmlFor="signup-confirm">Confirm password<input id="signup-confirm" required type="password" minLength={8} maxLength={128} autoComplete="new-password" className={field} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
            {emailReady===false && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Registration is awaiting our email verification configuration. No account can be created from this form yet.</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={busy||!emailReady} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C5B39] px-5 py-4 font-semibold text-white hover:bg-[#153F29] disabled:opacity-50">{busy?<Loader2 size={18} className="animate-spin"/>:<ShieldCheck size={18}/>} Create account <ArrowRight size={18}/></button>
            <div className="flex items-center justify-center gap-2 text-xs text-[#758877]"><UsersRound size={15}/> One account, your own company workspace</div>
          </form>}
      </div>
    </section>
  </main>;
}
