import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

export async function GET(req: NextRequest) {
  return auth.handler(req as unknown as Request);
}

export async function POST(req: NextRequest) {
  return auth.handler(req as unknown as Request);
}

export async function PUT(req: NextRequest) {
  return auth.handler(req as unknown as Request);
}

export async function DELETE(req: NextRequest) {
  return auth.handler(req as unknown as Request);
}

export async function PATCH(req: NextRequest) {
  return auth.handler(req as unknown as Request);
}
