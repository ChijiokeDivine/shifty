import { NextRequest } from "next/server";
import { handleAuthPopupRequest } from "@/lib/auth/popup.server";

export async function GET(req: NextRequest) {
  return handleAuthPopupRequest(req as unknown as Request);
}
