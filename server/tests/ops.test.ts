import { describe, expect, it } from "vitest";

import {
  buildArchiveFileName,
  buildBackupId,
  buildManifestFileName,
  selectEntriesToPrune,
  shouldRestoreDatabase
} from "../src/ops/backup-manifest.js";

describe("backup manifest helpers", () => {
  it("builds stable backup file names", () => {
    const createdAt = new Date("2026-04-04T12:34:56.000Z");
    const backupId = buildBackupId("predeploy", "abcdef123456", createdAt);

    expect(backupId).toBe("20260404T123456Z-predeploy-abcdef1");
    expect(buildArchiveFileName(backupId)).toBe("20260404T123456Z-predeploy-abcdef1.sql.zst");
    expect(buildManifestFileName(backupId)).toBe("20260404T123456Z-predeploy-abcdef1.json");
  });

  it("prunes the oldest entries after the keep count", () => {
    const result = selectEntriesToPrune([
      "20260404T120000Z-predeploy-bbbbbbb.sql.zst",
      "20260403T120000Z-predeploy-aaaaaaa.sql.zst",
      "20260402T120000Z-predeploy-9999999.sql.zst"
    ], 2);

    expect(result).toEqual(["20260402T120000Z-predeploy-9999999.sql.zst"]);
  });

  it("decides whether a rollback should restore the database", () => {
    expect(shouldRestoreDatabase("always", false)).toBe(true);
    expect(shouldRestoreDatabase("never", true)).toBe(false);
    expect(shouldRestoreDatabase("auto", true)).toBe(true);
    expect(shouldRestoreDatabase("auto", false)).toBe(false);
  });
});
