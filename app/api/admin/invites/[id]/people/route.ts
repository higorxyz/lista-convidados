import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addPerson, addHistoryEntry } from "@/lib/invites";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function requireAdmin(): boolean {
  return isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const isChild = body.isChild === true;
  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }
  const updated = await addPerson(params.id, name, isChild);
  if (!updated) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  await addHistoryEntry(
    params.id,
    "Administração",
    `Adicionou ${name}${isChild ? " como criança" : ""} ao convite.`
  );
  return NextResponse.json({ invite: updated });
}
