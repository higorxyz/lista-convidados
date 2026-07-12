// Fixed deadline for any RSVP change: 28 de agosto de 2026, end of day (America/Sao_Paulo, UTC-3).
export const RSVP_DEADLINE = new Date("2026-08-29T02:59:59.000Z"); // 28/08/2026 23:59:59 -03:00
export const RSVP_DEADLINE_LABEL = "28 de agosto de 2026";

export function isDeadlinePassed(now: Date = new Date()): boolean {
  return now.getTime() > RSVP_DEADLINE.getTime();
}
