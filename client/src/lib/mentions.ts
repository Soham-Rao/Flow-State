import type { BoardMember } from "@/types/board";

export interface MentionQuery {
  start: number;
  end: number;
  query: string;
}

const MENTION_QUERY_ALLOWED = /^[\p{L}\p{N}._'-]*$/u;
const MENTION_TOKEN = /@[\p{L}\p{N}._'-]+/gu;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


export function findMentionQuery(value: string, caret: number): MentionQuery | null {
  if (caret < 0 || caret > value.length) return null;
  const beforeCaret = value.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf("@");
  if (atIndex < 0) return null;
  if (atIndex > 0 && !/\s/.test(beforeCaret[atIndex - 1] ?? "")) return null;

  const query = beforeCaret.slice(atIndex + 1);
  if (!MENTION_QUERY_ALLOWED.test(query)) return null;

  return { start: atIndex, end: caret, query };
}

export function insertMention(value: string, range: MentionQuery, username: string): { nextValue: string; nextCaret: number } {
  const before = value.slice(0, range.start);
  const after = value.slice(range.end);
  const insertion = `@${username}`;
  const needsSpace = after.length === 0 || !after.startsWith(" ");
  const spacer = needsSpace ? " " : "";
  const nextValue = `${before}${insertion}${spacer}${after}`;
  const nextCaret = before.length + insertion.length + spacer.length;
  return { nextValue, nextCaret };
}

export function filterMentionCandidates(query: string, members: BoardMember[]): BoardMember[] {
  if (members.length === 0) return [];
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return members;
  return members.filter((member) => {
    const username = member.username?.toLowerCase();
    if (!username) return false;
    const displayName = member.displayName?.toLowerCase() ?? "";
    const email = member.email.toLowerCase();
    return username.includes(normalized) || displayName.includes(normalized) || email.includes(normalized);
  });
}

export function extractMentionIds(body: string, members: BoardMember[]): string[] {
  if (!body || members.length === 0) return [];
  const mentioned = new Set<string>();

  for (const member of members) {
    const username = member.username?.trim();
    if (!username) continue;
    const escaped = escapeRegex(username);
    const matcher = new RegExp(`(^|\\s)@${escaped}(?=$|\\s|[.,!?])`, "i");
    if (matcher.test(body)) {
      mentioned.add(member.id);
    }
  }

  return Array.from(mentioned);
}



