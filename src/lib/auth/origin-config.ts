/** Better Auth origin allowlist for local, preview and deployment environments.
 * Only explicit deployment hosts are trusted. Never mirror an arbitrary
 * request Origin or permit the entire *.vercel.app domain.
 */
export type AuthOriginEnvironment = {
  BETTER_AUTH_URL?: string;
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  AUTH_TRUSTED_ORIGINS?: string;
  NODE_ENV?: string;
};

const LOCAL_PORTS = [3000, 3001, 8080, 8081] as const;

function normalizeOrigin(value: string, isProduction: boolean): string {
  const parsed = new URL(value.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local && !isProduction)) {
    throw new Error("Auth origins must use HTTPS outside local development.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new Error("Auth origins must be exact scheme/host/port values.");
  }
  return parsed.origin;
}

function vercelOrigin(value: string | undefined, prod: boolean): string | null {
  if (!value?.trim()) return null;
  return normalizeOrigin(value.includes("://") ? value : `https://${value}`, prod);
}

function hosts(origins: readonly string[]): string[] {
  return [...new Set(origins.map((origin) => new URL(origin).host))];
}

export function authOriginConfig(
  config: AuthOriginEnvironment,
  previewAllowedHosts: readonly string[],
): {
  baseURL: string | { allowedHosts: string[]; protocol: "auto"; fallback?: string };
  trustedOrigins: string[];
} {
  const prod = config.NODE_ENV === "production";
  const configured = [
    config.BETTER_AUTH_URL
      ? normalizeOrigin(config.BETTER_AUTH_URL, prod)
      : null,
    vercelOrigin(config.VERCEL_URL, prod),
    vercelOrigin(config.VERCEL_BRANCH_URL, prod),
    vercelOrigin(config.VERCEL_PROJECT_PRODUCTION_URL, prod),
    ...(config.AUTH_TRUSTED_ORIGINS?.split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => normalizeOrigin(x, prod)) ?? []),
  ].filter((x): x is string => Boolean(x));
  const approved = [...new Set(configured)];
  const localOrigins = prod ? [] :
    LOCAL_PORTS.flatMap((port) => [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
      `http://[::1]:${port}`,
    ]);
  const preview = approved.length === 0 ? [...previewAllowedHosts] : [];
  const trustedOrigins = [...new Set([
    ...approved,
    ...localOrigins,
    ...preview.map((host) => `https://${host}`),
  ])];

  // When a Vercel preview host and the canonical URL differ, Better Auth must
  // resolve the callback URL from the request's approved host. A fixed baseURL
  // would send it to the wrong deployment even if trustedOrigins is correct.
  if (approved.length === 1 && prod) {
    return { baseURL: approved[0], trustedOrigins };
  }

  const allowedHosts = [...new Set([
    ...hosts(approved),
    ...preview,
    ...(prod ? [] : ["localhost", "127.0.0.1", "[::1]"]),
  ])];

  const fallback = approved[0] ?? (!prod ? "http://localhost:3000" : undefined);
  return {
    baseURL: {
      allowedHosts,
      protocol: "auto",
      ...(fallback ? { fallback } : {}),
    },
    trustedOrigins,
  };
}
