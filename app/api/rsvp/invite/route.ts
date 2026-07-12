import { NextRequest, NextResponse } from "next/server";
import { addHistoryEntry, getInvite, setPersonStatus } from "@/lib/invites";
import { verifyInviteToken } from "@/lib/guestToken";
import { isDeadlinePassed, RSVP_DEADLINE_LABEL } from "@/lib/deadline";
import { AttendanceStatus, GuestInviteView } from "@/lib/types";

export const dynamic = "force-dynamic";

function extractToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header && header.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return null;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  confirmed: "confirmou presença",
  declined: "marcou como não vai comparecer",
  pending: "marcou como pendente"
};

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  const inviteId = verifyInviteToken(token);
  if (!inviteId) {
    return NextResponse.json({ error: "Sessão expirada. Faça a busca novamente." }, { status: 401 });
  }

  const invite = await getInvite(inviteId);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  const view: GuestInviteView = {
    responsibleName: invite.responsibleName,
    people: invite.people,
    deadline: RSVP_DEADLINE_LABEL,
    deadlinePassed: isDeadlinePassed()
  };

  return NextResponse.json({ invite: view });
}

export async function PATCH(req: NextRequest) {
  const token = extractToken(req);
  const inviteId = verifyInviteToken(token);
  if (!inviteId) {
    return NextResponse.json({ error: "Sessão expirada. Faça a busca novamente." }, { status: 401 });
  }

  if (isDeadlinePassed()) {
    return NextResponse.json(
      {
        error: `O prazo para confirmação de presença foi encerrado em ${RSVP_DEADLINE_LABEL}. Caso precise realizar alguma alteração, entre em contato com os noivos.`
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const personId = typeof body.personId === "string" ? body.personId : "";
  const status = body.status as AttendanceStatus;

  if (!personId || (status !== "confirmed" && status !== "declined" && status !== "pending")) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const invite = await getInvite(inviteId);
  if (!invite) {
    return NextResponse.json({ error: "Convite não encontrado." }, { status: 404 });
  }

  // Guard: the person being updated must actually belong to this invite.
  const belongsToInvite = invite.people.some((p) => p.id === personId);
  if (!belongsToInvite) {
    return NextResponse.json({ error: "Convidado não encontrado neste convite." }, { status: 404 });
  }

  const result = await setPersonStatus(inviteId, personId, status);
  if (!result) {
    return NextResponse.json({ error: "Convidado não encontrado." }, { status: 404 });
  }

  await addHistoryEntry(inviteId, invite.responsibleName, `${invite.responsibleName} ${STATUS_LABEL[status]} de ${result.person.name}.`);

  const view: GuestInviteView = {
    responsibleName: result.invite.responsibleName,
    people: result.invite.people,
    deadline: RSVP_DEADLINE_LABEL,
    deadlinePassed: isDeadlinePassed()
  };

  return NextResponse.json({ invite: view });
}
