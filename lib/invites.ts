import { Redis } from "@upstash/redis";
import { AttendanceStatus, HistoryEntry, Invite, Person } from "./types";

const kv = Redis.fromEnv();

const INVITES_HASH_KEY = "invites";
const SEED_FLAG_KEY = "invites:seeded";
const HISTORY_LIST_PREFIX = "history:"; // history:{inviteId} -> Redis list of JSON strings

function makeInviteId(): string {
  return "invite_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function makePersonId(): string {
  return "person_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function makeHistoryId(): string {
  return "hist_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function normalizeWhatsappDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

function normalizeStatus(value: unknown): AttendanceStatus {
  return value === "confirmed" || value === "declined" ? value : "pending";
}

function normalizePerson(raw: Partial<Person>): Person {
  return {
    id: String(raw.id || makePersonId()),
    name: String(raw.name || "").trim(),
    status: normalizeStatus(raw.status),
    isChild: raw.isChild === true,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now()
  };
}

function normalizeInvite(raw: Partial<Invite> & { people?: unknown }): Invite {
  const people = Array.isArray(raw.people) ? raw.people.map((p) => normalizePerson(p as Partial<Person>)) : [];
  return {
    id: String(raw.id || makeInviteId()),
    responsibleName: String(raw.responsibleName || "").trim(),
    whatsapp: normalizeWhatsappDigits(String(raw.whatsapp || "")),
    people,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now()
  };
}

function seedInvites(): Invite[] {
  const now = Date.now();
  return [
    {
      id: makeInviteId(),
      responsibleName: "Convite de Exemplo",
      whatsapp: "5511999998888",
      people: [
        { id: makePersonId(), name: "Convite de Exemplo", status: "pending", isChild: false, updatedAt: now },
        { id: makePersonId(), name: "Acompanhante de Exemplo", status: "pending", isChild: false, updatedAt: now }
      ],
      createdAt: now,
      updatedAt: now
    }
  ];
}

export async function getAllInvites(): Promise<Invite[]> {
  const seeded = await kv.get<string>(SEED_FLAG_KEY);
  if (!seeded) {
    const initial = seedInvites();
    const pipeline = kv.pipeline();
    for (const inv of initial) {
      pipeline.hset(INVITES_HASH_KEY, { [inv.id]: JSON.stringify(inv) });
    }
    pipeline.set(SEED_FLAG_KEY, "true");
    await pipeline.exec();
    return initial;
  }
  const raw = await kv.hgetall<Record<string, string>>(INVITES_HASH_KEY);
  if (!raw) return [];
  const invites = Object.values(raw).map((v) =>
    normalizeInvite(typeof v === "string" ? (JSON.parse(v) as Invite) : (v as unknown as Invite))
  );
  return invites.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getInvite(id: string): Promise<Invite | null> {
  const raw = await kv.hget<string>(INVITES_HASH_KEY, id);
  if (!raw) return null;
  return normalizeInvite(typeof raw === "string" ? (JSON.parse(raw) as Invite) : (raw as unknown as Invite));
}

async function saveInvite(invite: Invite): Promise<void> {
  const normalized = normalizeInvite(invite);
  await kv.hset(INVITES_HASH_KEY, { [normalized.id]: JSON.stringify(normalized) });
}

export async function deleteInvite(id: string): Promise<void> {
  await kv.hdel(INVITES_HASH_KEY, id);
  await kv.del(`${HISTORY_LIST_PREFIX}${id}`);
}

export async function addInvite(
  input:
    | { responsibleName: string; whatsapp: string; peopleNames: string[] }
    | { responsibleName: string; whatsapp: string; people: Array<{ name: string; isChild: boolean }> }
): Promise<Invite> {
  const now = Date.now();
  const peopleInput = "people" in input ? input.people : input.peopleNames.map((name) => ({ name, isChild: false }));
  const people: Person[] = peopleInput
    .map((person) => ({
      name: String(person.name || "").trim(),
      isChild: person.isChild === true
    }))
    .filter((person) => person.name)
    .map((person) => ({
      id: makePersonId(),
      name: person.name,
      status: "pending" as AttendanceStatus,
      isChild: person.isChild,
      updatedAt: now
    }));

  const invite: Invite = {
    id: makeInviteId(),
    responsibleName: input.responsibleName.trim(),
    whatsapp: normalizeWhatsappDigits(input.whatsapp),
    people,
    createdAt: now,
    updatedAt: now
  };
  await saveInvite(invite);
  return invite;
}

export async function updateInviteDetails(
  id: string,
  responsibleName: string,
  whatsapp: string
): Promise<Invite | null> {
  const current = await getInvite(id);
  if (!current) return null;
  const updated: Invite = {
    ...current,
    responsibleName: responsibleName.trim(),
    whatsapp: normalizeWhatsappDigits(whatsapp),
    updatedAt: Date.now()
  };
  await saveInvite(updated);
  return updated;
}

export async function addPerson(inviteId: string, name: string, isChild = false): Promise<Invite | null> {
  const current = await getInvite(inviteId);
  if (!current) return null;
  const trimmed = name.trim();
  if (!trimmed) return current;
  const person: Person = { id: makePersonId(), name: trimmed, status: "pending", isChild, updatedAt: Date.now() };
  const updated: Invite = { ...current, people: [...current.people, person], updatedAt: Date.now() };
  await saveInvite(updated);
  return updated;
}

export async function setPersonDetails(
  inviteId: string,
  personId: string,
  input: { name: string; isChild: boolean }
): Promise<{ invite: Invite; person: Person } | null> {
  const current = await getInvite(inviteId);
  if (!current) return null;

  let updatedPerson: Person | null = null;
  const people = current.people.map((person) => {
    if (person.id !== personId) return person;
    updatedPerson = {
      ...person,
      name: input.name.trim(),
      isChild: input.isChild,
      updatedAt: Date.now()
    };
    return updatedPerson;
  });

  if (!updatedPerson) return null;

  const updated: Invite = { ...current, people, updatedAt: Date.now() };
  await saveInvite(updated);
  return { invite: updated, person: updatedPerson };
}

export async function removePerson(inviteId: string, personId: string): Promise<Invite | null> {
  const current = await getInvite(inviteId);
  if (!current) return null;
  const updated: Invite = {
    ...current,
    people: current.people.filter((p) => p.id !== personId),
    updatedAt: Date.now()
  };
  await saveInvite(updated);
  return updated;
}

/**
 * Updates a single person's attendance status. Used both by the guest flow (before the
 * deadline, enforced by the caller) and by the admin override (no deadline restriction).
 */
export async function setPersonStatus(
  inviteId: string,
  personId: string,
  status: AttendanceStatus
): Promise<{ invite: Invite; person: Person } | null> {
  const current = await getInvite(inviteId);
  if (!current) return null;
  let updatedPerson: Person | null = null;
  const people = current.people.map((p) => {
    if (p.id !== personId) return p;
    updatedPerson = { ...p, status, updatedAt: Date.now() };
    return updatedPerson;
  });
  if (!updatedPerson) return null;
  const updated: Invite = { ...current, people, updatedAt: Date.now() };
  await saveInvite(updated);
  return { invite: updated, person: updatedPerson };
}

export async function setPeopleStatuses(
  inviteId: string,
  updates: Array<{ personId: string; status: AttendanceStatus }>
): Promise<{ invite: Invite; updatedPeople: Person[] } | null> {
  const current = await getInvite(inviteId);
  if (!current) return null;

  const updatesMap = new Map<string, AttendanceStatus>();
  for (const update of updates) {
    updatesMap.set(update.personId, update.status);
  }

  const now = Date.now();
  const updatedPeople: Person[] = [];
  const people = current.people.map((person) => {
    const nextStatus = updatesMap.get(person.id);
    if (!nextStatus || nextStatus === person.status) return person;

    const updatedPerson: Person = {
      ...person,
      status: nextStatus,
      updatedAt: now
    };
    updatedPeople.push(updatedPerson);
    return updatedPerson;
  });

  if (updatedPeople.length === 0) {
    return { invite: current, updatedPeople: [] };
  }

  const updatedInvite: Invite = {
    ...current,
    people,
    updatedAt: now
  };

  await saveInvite(updatedInvite);
  return { invite: updatedInvite, updatedPeople };
}

/**
 * Finds the single invite whose WhatsApp number ends with the given 4 digits.
 * Returns "ambiguous" if more than one invite matches (should not normally happen)
 * so callers can fail safely without ever exposing a candidate list.
 */
export async function findInviteByLast4(last4: string): Promise<Invite | "ambiguous" | null> {
  const digits = last4.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  const all = await getAllInvites();
  const matches = all.filter((inv) => inv.whatsapp.endsWith(digits));
  if (matches.length === 0) return null;
  if (matches.length > 1) return "ambiguous";
  return matches[0];
}

export async function addHistoryEntry(inviteId: string, actorName: string, message: string): Promise<void> {
  const entry: HistoryEntry = {
    id: makeHistoryId(),
    inviteId,
    actorName,
    message,
    at: Date.now()
  };
  await kv.rpush(`${HISTORY_LIST_PREFIX}${inviteId}`, JSON.stringify(entry));
}

export async function getHistory(inviteId: string): Promise<HistoryEntry[]> {
  const raw = await kv.lrange<string>(`${HISTORY_LIST_PREFIX}${inviteId}`, 0, -1);
  if (!raw) return [];
  const entries = raw.map((v) => (typeof v === "string" ? (JSON.parse(v) as HistoryEntry) : (v as unknown as HistoryEntry)));
  return entries.sort((a, b) => b.at - a.at);
}
