import { NextRequest, NextResponse } from "next/server";
import { findInviteByLast4 } from "@/lib/invites";
import { createInviteToken } from "@/lib/guestToken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`rsvp-search:${ip}`, 20, 60 * 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um pouco antes de tentar novamente." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const last4 = typeof body?.last4 === "string" ? body.last4.replace(/\D/g, "") : "";

  if (last4.length !== 4) {
    return NextResponse.json({ error: "Digite os 4 últimos números do WhatsApp." }, { status: 400 });
  }

  const result = await findInviteByLast4(last4);

  if (result === null) {
    return NextResponse.json({ found: false });
  }

  if (result === "ambiguous") {
    // Never disambiguate on the client. Ask the guest to contact the couple instead.
    return NextResponse.json({
      found: false,
      ambiguous: true
    });
  }

  const token = createInviteToken(result.id);
  return NextResponse.json({
    found: true,
    token,
    responsibleName: result.responsibleName
  });
}
