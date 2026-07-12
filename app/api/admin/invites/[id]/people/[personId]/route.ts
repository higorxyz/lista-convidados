import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addHistoryEntry, getInvite, removePerson, setPersonDetails, setPersonStatus } from "@/lib/invites";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";
import { AttendanceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function requireAdmin(): boolean {
  return isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  confirmed: "confirmado",
  declined: "não vai comparecer",
  pending: "pendente"
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string; personId: string } }) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const status = body.status as AttendanceStatus;
  if (status !== "confirmed" && status !== "declined" && status !== "pending") {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  const current = await getInvite(params.id);
  const person = current?.people.find((p) => p.id === params.personId);
  const result = await setPersonStatus(params.id, params.personId, status);
  if (!result) return NextResponse.json({ error: "Convidado não encontrado." }, { status: 404 });
  await addHistoryEntry(
    params.id,
    "Administração",
    `Alterou ${person?.name || "convidado"} para ${STATUS_LABEL[status]} (ajuste administrativo).`
  );
  return NextResponse.json({ invite: result.invite });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; personId: string } }) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const isChild = body.isChild === true;

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }

  const current = await getInvite(params.id);
  const person = current?.people.find((p) => p.id === params.personId);
  const result = await setPersonDetails(params.id, params.personId, { name, isChild });
  if (!result) return NextResponse.json({ error: "Convidado não encontrado." }, { status: 404 });

  const changes: string[] = [];
  if ((person?.name || "") !== name) changes.push(`nome para ${name}`);
  if ((person?.isChild || false) !== isChild) changes.push(isChild ? "marcado como criança" : "marcado como adulto");

  await addHistoryEntry(
    params.id,
    "Administração",
    changes.length > 0
      ? `Atualizou ${person?.name || "convidado"}: ${changes.join(" e ")}.`
      : `Atualizou os dados de ${name}.`
  );

  return NextResponse.json({ invite: result.invite });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; personId: string } }) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const current = await getInvite(params.id);
  const person = current?.people.find((p) => p.id === params.personId);
  const updated = await removePerson(params.id, params.personId);
  if (!updated) return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  await addHistoryEntry(params.id, "Administração", `Removeu ${person?.name || "convidado"} do convite.`);
  return NextResponse.json({ invite: updated });
}
