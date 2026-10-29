/**
 * Auth email delivery. Keys stay server-side. Do not log verification/reset URLs,
 * tokens, credentials, or provider response bodies.
 *
 * Setup: RESEND_API_KEY and AUTH_EMAIL_FROM (a verified sending domain).
 */
export type AuthEmailEnvironment = {
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
};

export function isAuthEmailConfigured(
  env: AuthEmailEnvironment = { RESEND_API_KEY: process.env.RESEND_API_KEY, AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM },
): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.AUTH_EMAIL_FROM?.trim());
}

export type AuthMail = {
  to: string;
  subject: string;
  action: string;
  url: string;
  expiresIn: string;
};

export async function sendAuthEmail(
  mail: AuthMail,
  options: {
    env?: AuthEmailEnvironment;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<void> {
  const env = options.env ?? { RESEND_API_KEY: process.env.RESEND_API_KEY, AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM };
  const key = env.RESEND_API_KEY?.trim();
  const from = env.AUTH_EMAIL_FROM?.trim();
  if (!key || !from) {
    throw new Error("Transactional email delivery is not configured.");
  }
  const link = new URL(mail.url);
  // Do not email dangerous schemes, even if an upstream callback changes.
  if (link.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && link.protocol === "http:" && ["localhost", "127.0.0.1"].includes(link.hostname))) {
    throw new Error("Invalid authentication link protocol.");
  }
  // Better Auth constructs the token links. Require the configured app host
  // in deployments to prevent accidentally mailing links to other origins.
  if (process.env.BETTER_AUTH_URL) {
    const trusted = new URL(process.env.BETTER_AUTH_URL);
    if (link.origin !== trusted.origin) {
      throw new Error("Authentication link origin does not match this application.");
    }
  }
  const sender = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await sender("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "shiftii/1.0",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: `Shiftii\n\n${mail.action}\n\n${mail.url}\n\nThis link expires in ${mail.expiresIn}. If you didn't request it, you can ignore this email.\n\nShiftii Team`,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error("Unable to deliver authentication email.");
  }
  if (!response.ok) {
    // Never include provider responses; they might include recipient details.
    throw new Error("Unable to deliver authentication email.");
  }
}

/** Six-digit verification messages do not contain login links or passwords.
 * The OTP is transient, should never be logged, and is never sent to a browser
 * except through the user's private email inbox. Better Auth stores only its hash.
 */
export async function sendRegistrationOtp(
  mail: { to: string; otp: string },
  options: { env?: AuthEmailEnvironment; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  if (!/^\\d{6}$/.test(mail.otp)) {
    throw new Error("Invalid email verification code.");
  }
  const env = options.env ?? {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  };
  const key = env.RESEND_API_KEY?.trim();
  const from = env.AUTH_EMAIL_FROM?.trim();
  if (!key || !from) {
    throw new Error("Transactional email delivery is not configured.");
  }

  const send = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "shiftii/1.0",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: "Your Shiftii verification code",
        text: `Welcome to Shiftii!\\n\\nYour six-digit verification code is ${mail.otp}.\\n\\nThis code expires after 10 minutes. If you didn't create a Shiftii account, please ignore this email.\\n\\nNever share this code with anyone.\\n\\nShiftii Team`,
      }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error("Unable to deliver authentication email.");
  }
  if (!response.ok) {
    throw new Error("Unable to deliver authentication email.");
  }
}
