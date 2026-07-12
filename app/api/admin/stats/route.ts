import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAllInvites } from "@/lib/invites";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";
import { DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const isAdmin = isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
  if (!isAdmin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const invites = await getAllInvites();
  const stats: DashboardStats = {
    totalPeople: 0,
    totalInvites: invites.length,
    confirmed: 0,
    pending: 0,
    declined: 0
  };

  for (const invite of invites) {
    for (const person of invite.people) {
      stats.totalPeople += 1;
      if (person.status === "confirmed") stats.confirmed += 1;
      else if (person.status === "declined") stats.declined += 1;
      else stats.pending += 1;
    }
  }

  return NextResponse.json({ stats });
}
