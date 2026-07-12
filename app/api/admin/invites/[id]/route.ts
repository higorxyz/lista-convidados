import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteInvite, updateInviteDetails } from "@/lib/invites";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function requireAdmin(): boolean {
  return isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const responsibleName = typeof body.responsibleName === "string" ? body.responsibleName.trim() : "";
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  const digits = whatsapp.replace(/\D/g, "");

  if (!responsibleName) {
    return NextResponse.json({ error: "Nome do responsável é obrigatório." }, { status: 400 });
  }
  if (digits.length < 10) {
    return NextResponse.json({ error: "Informe um WhatsApp válido, com DDD." }, { status: 400 });
  }

  const updated = await updateInviteDetails(params.id, responsibleName, digits);
  if (!updated) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  return NextResponse.json({ invite: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  await deleteInvite(params.id);
  return NextResponse.json({ ok: true });
}
