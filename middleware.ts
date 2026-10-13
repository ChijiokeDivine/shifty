import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.css$).*)",
  ],
};

function isDocumentPath(path: string): boolean {
  if (path === "/" || path === "") return true;
  if (path.startsWith("/api/")) return false;
  if (path.startsWith("/__grok/")) return false;
  const lastSegment = path.split("/").pop() ?? "";
  if (lastSegment.includes(".")) return false;
  return true;
}

function isInstallQuery(url: string): boolean {
  const query = String(url ?? "").split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  const install = params.get("install");
  const platform = (params.get("platform") ?? "").toLowerCase();
  return (install === "1" || install === "true") && platform === "ios";
}

function acceptsHtml(accept: string | null): boolean {
  if (!accept) return false;
  return accept.includes("text/html") || accept.includes("*/*");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const urlWithQuery = pathname + search;
  const method = request.method.toUpperCase();

  if (method !== "GET") {
    return NextResponse.next();
  }

  if (
    isInstallQuery(urlWithQuery) &&
    isDocumentPath(pathname) &&
    acceptsHtml(request.headers.get("accept"))
  ) {
    const installUrl = new URL(
      `/__grok/install${search}`,
      request.url
    );
    return NextResponse.rewrite(installUrl);
  }

  return NextResponse.next();
}
