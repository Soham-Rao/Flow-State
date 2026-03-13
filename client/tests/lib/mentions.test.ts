import { describe, expect, it } from "vitest";

import { extractMentionIds, filterMentionCandidates, findMentionQuery, insertMention } from "@/lib/mentions";
import type { BoardMember } from "@/types/board";

const members: BoardMember[] = [
  { id: "user-1", name: "John Doe", displayName: "John Doe", username: "johnd", email: "john@example.com", role: "member", createdAt: "" },
  { id: "user-2", name: "Jane Smith", displayName: "Jane Smith", username: "jane", email: "jane@example.com", role: "admin", createdAt: "" }
];

describe("mentions helpers", () => {
  it("finds the active mention query", () => {
    const value = "Hello @jo";
    const info = findMentionQuery(value, value.length);
    expect(info).not.toBeNull();
    expect(info?.query).toBe("jo");
  });

  it("ignores @ inside emails", () => {
    const value = "test@domain.com";
    const info = findMentionQuery(value, value.length);
    expect(info).toBeNull();
  });

  it("inserts a mention and keeps spacing", () => {
    const value = "Hello @jo";
    const info = findMentionQuery(value, value.length);
    if (!info) throw new Error("query not found");
    const result = insertMention(value, info, "johnd");
    expect(result.nextValue).toBe("Hello @johnd ");
  });

  it("extracts mention ids from body", () => {
    const body = "Please review @jane and @johnd.";
    const ids = extractMentionIds(body, members);
    expect(ids.sort()).toEqual(["user-1", "user-2"]);
  });

  it("filters mention candidates by query", () => {
    const filtered = filterMentionCandidates("jane", members);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("user-2");
  });
});
