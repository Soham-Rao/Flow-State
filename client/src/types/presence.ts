export type PresenceStatus = "online" | "afk";
export type PresenceState = PresenceStatus | "offline";

export interface PresenceUser {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  role: string;
  status?: PresenceStatus;
}
