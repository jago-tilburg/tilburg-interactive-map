import { afterAll, beforeEach, describe, expect, it } from "vitest";
// See testFakes.js for why index.js's plain CommonJS require() calls need
// this require.cache-patching approach instead of vi.mock.
import { bucketStore, rtdbStore, firestoreStore as store, restoreRealModules } from "./testFakes.js";

const { backupRealtimeDatabase, triggerRtdbBackup } = await import("../index.js");

afterAll(restoreRealModules);

const ADMIN_UID = "admin-uid";
const OTHER_UID = "other-uid";

const SAMPLE_TREE = {
  shops: { shop1: { id: 1, name: "Test Shop" } },
  rateLimits: {},
};

beforeEach(() => {
  bucketStore.clear();
  rtdbStore.clear();
  store.clear();
  store.set(`admins/${ADMIN_UID}`, { email: "admin@example.com" });
});

function backupFiles() {
  return [...bucketStore.keys()].filter((name) => name.startsWith("rtdb-backups/"));
}

describe("backupRealtimeDatabase (scheduled)", () => {
  it("writes the full RTDB tree as one JSON object to rtdb-backups/", async () => {
    rtdbStore.set("/", SAMPLE_TREE);

    await backupRealtimeDatabase.run({});

    const files = backupFiles();
    expect(files).toHaveLength(1);
    const written = bucketStore.get(files[0]);
    expect(written.contentType).toBe("application/json");
    expect(JSON.parse(written.buffer.toString())).toEqual(SAMPLE_TREE);
  });
});

describe("triggerRtdbBackup (manual, admin-only)", () => {
  it("throws unauthenticated when there is no auth context", async () => {
    await expect(triggerRtdbBackup.run({ data: {}, auth: undefined })).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("throws permission-denied for a non-admin caller", async () => {
    await expect(triggerRtdbBackup.run({ data: {}, auth: { uid: OTHER_UID } })).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("writes a backup and returns its file name and size for an admin caller", async () => {
    rtdbStore.set("/", SAMPLE_TREE);

    const result = await triggerRtdbBackup.run({ data: {}, auth: { uid: ADMIN_UID } });

    expect(result.fileName).toMatch(/^rtdb-backups\/.+\.json$/);
    expect(result.bytes).toBeGreaterThan(0);
    expect(backupFiles()).toHaveLength(1);
  });
});
