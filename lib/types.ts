export type AttendanceStatus = "pending" | "confirmed" | "declined";

export interface Person {
  id: string;
  name: string;
  status: AttendanceStatus;
  updatedAt: number;
}

export interface Invite {
  id: string;
  responsibleName: string;
  whatsapp: string; // digits only, with country code, e.g. 5511999998888
  people: Person[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  inviteId: string;
  actorName: string;
  message: string;
  at: number;
}

// Shape returned to a guest who has verified an invite.
// Never includes the WhatsApp number or anything about other invites.
export interface GuestInviteView {
  responsibleName: string;
  people: Person[];
  deadline: string;
  deadlinePassed: boolean;
}

export interface DashboardStats {
  totalPeople: number;
  totalInvites: number;
  confirmed: number;
  pending: number;
  declined: number;
}
