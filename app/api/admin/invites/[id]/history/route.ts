import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getHistory } from "@/lib/invites";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const isAdmin = isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
  if (!isAdmin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const history = await getHistory(params.id);
  return NextResponse.json({ history });
}
