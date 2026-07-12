import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addInvite, getAllInvites } from "@/lib/invites";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

function requireAdmin(): boolean {
  return isValidSessionToken(cookies().get(ADMIN_COOKIE)?.value);
}

function parsePeopleNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function parsePeople(value: unknown): Array<{ name: string; isChild: boolean }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        name: typeof item?.name === "string" ? item.name.trim() : String(item?.name || "").trim(),
        isChild: item?.isChild === true
      }))
      .filter((item) => item.name);
  }
  return [];
}

export async function GET() {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const invites = await getAllInvites();
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const responsibleName = typeof body?.responsibleName === "string" ? body.responsibleName.trim() : "";
  const whatsapp = typeof body?.whatsapp === "string" ? body.whatsapp.trim() : "";
  const digits = whatsapp.replace(/\D/g, "");
  const peopleNames = parsePeopleNames(body?.peopleNames ?? body?.people);
  const people = parsePeople(body?.people);

  if (!responsibleName) {
    return NextResponse.json({ error: "Nome do responsável é obrigatório." }, { status: 400 });
  }
  if (digits.length < 10) {
    return NextResponse.json({ error: "Informe um WhatsApp válido, com DDD." }, { status: 400 });
  }
  if (people.length === 0 && peopleNames.length === 0) {
    return NextResponse.json({ error: "Adicione ao menos uma pessoa ao convite." }, { status: 400 });
  }

  const invite = people.length > 0 ? await addInvite({ responsibleName, whatsapp: digits, people }) : await addInvite({ responsibleName, whatsapp: digits, peopleNames });
  return NextResponse.json({ invite });
}
