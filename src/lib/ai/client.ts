/**
 * Hybrid chat client: Groq → OpenRouter → xAI.
 * All three are OpenAI-compatible. First configured provider that succeeds wins.
 * Leave every key unset and AI features degrade to local-only copy.
 *
 * NEVER pass unsanitized objects here — call assertSafePayload first.
 */

import { assertSafePayload, SanitizeError } from "./sanitize";

export type AiChatResult = {
  ok: boolean;
  text: string;
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  errorCode: string | null;
};

type Provider = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
};

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
}

function providers(): Provider[] {
  const priority = (env("AI_PROVIDER_PRIORITY") ?? "groq,openrouter,xai")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const all: Record<string, Provider | null> = {
    groq: env("GROQ_API_KEY")
      ? {
          name: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKey: env("GROQ_API_KEY")!,
          model: env("GROQ_MODEL") ?? "llama-3.1-8b-instant",
        }
      : null,
    openrouter: env("OPENROUTER_API_KEY")
      ? {
          name: "openrouter",
          baseUrl: "https://openrouter.ai/api/v1",
          apiKey: env("OPENROUTER_API_KEY")!,
          model: env("OPENROUTER_MODEL") ?? "meta-llama/llama-3.1-8b-instruct:free",
          headers: {
            "HTTP-Referer": env("OPENROUTER_SITE_URL") ?? "https://shiftii.app",
            "X-Title": env("OPENROUTER_APP_NAME") ?? "Shiftii",
          },
        }
      : null,
    xai: env("XAI_API_KEY")
      ? {
          name: "xai",
          baseUrl: "https://api.x.ai/v1",
          apiKey: env("XAI_API_KEY")!,
          model: env("XAI_MODEL") ?? "grok-4.5",
        }
      : null,
  };

  const ordered: Provider[] = [];
  for (const name of priority) {
    const p = all[name];
    if (p) ordered.push(p);
  }
  for (const p of Object.values(all)) {
    if (p && !ordered.some((o) => o.name === p.name)) ordered.push(p);
  }
  return ordered;
}

export function aiConfigured(): boolean {
  return providers().length > 0;
}

const SYSTEM =
  "You write short, plain operational explanations for hospital unit managers. " +
  "You receive ONLY aggregate staffing stats and anonymous candidate indices (0,1,2…). " +
  "Never invent names, patients, diagnoses, rooms, or license numbers. " +
  "Never ask for more data. 2–5 sentences. No markdown headings.";

export async function completeJsonPrompt(opts: {
  agentName: string;
  userPrompt: string;
  payload: unknown;
}): Promise<AiChatResult> {
  const started = Date.now();
  try {
    assertSafePayload(opts.payload);
  } catch (err) {
    return {
      ok: false,
      text: "",
      provider: null,
      model: null,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
      errorCode: err instanceof SanitizeError ? "SANITIZE_BLOCKED" : "SANITIZE_ERROR",
    };
  }

  const list = providers();
  if (!list.length) {
    return {
      ok: false,
      text: "",
      provider: null,
      model: null,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
      errorCode: "NO_PROVIDER",
    };
  }

  const timeoutMs = Number(env("AI_REQUEST_TIMEOUT_MS") ?? "15000");
  const bodyPayload = JSON.stringify(opts.payload);
  const user = `${opts.userPrompt}\n\nDATA:\n${bodyPayload}`;

  let lastError = "NO_PROVIDER";
  for (const p of list) {
    const result = await callProvider(p, user, timeoutMs, started);
    if (result.ok) return result;
    lastError = result.errorCode ?? "PROVIDER_FAIL";
  }
  return {
    ok: false,
    text: "",
    provider: list[0]?.name ?? null,
    model: list[0]?.model ?? null,
    promptTokens: null,
    completionTokens: null,
    latencyMs: Date.now() - started,
    errorCode: lastError,
  };
}

async function callProvider(
  p: Provider,
  user: string,
  timeoutMs: number,
  started: number,
): Promise<AiChatResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
        ...(p.headers ?? {}),
      },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.2,
        max_tokens: 280,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        text: "",
        provider: p.name,
        model: p.model,
        promptTokens: null,
        completionTokens: null,
        latencyMs: Date.now() - started,
        errorCode: `HTTP_${res.status}`,
      };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    return {
      ok: Boolean(text),
      text,
      provider: p.name,
      model: p.model,
      promptTokens: body.usage?.prompt_tokens ?? null,
      completionTokens: body.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - started,
      errorCode: text ? null : "EMPTY",
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      text: "",
      provider: p.name,
      model: p.model,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - started,
      errorCode: aborted ? "TIMEOUT" : "NETWORK",
    };
  } finally {
    clearTimeout(t);
  }
}
