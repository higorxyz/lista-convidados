import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAdmin = isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ isAdmin });
}
