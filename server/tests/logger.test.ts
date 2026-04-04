import { describe, expect, it } from "vitest";

import { redactForLogs } from "../src/utils/logger.js";

describe("logger redaction", () => {
  it("redacts sensitive keys recursively", () => {
    const redacted = redactForLogs({
      password: "super-secret",
      nested: {
        authorization: "Bearer abc",
        keep: "safe"
      },
      tokenValue: "xyz"
    });

    expect(redacted).toEqual({
      password: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        keep: "safe"
      },
      tokenValue: "[REDACTED]"
    });
  });
});
