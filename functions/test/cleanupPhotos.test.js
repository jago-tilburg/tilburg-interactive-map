import { afterAll, beforeEach, describe, expect, it } from "vitest";
// See testFakes.js for why index.js's plain CommonJS require() calls need
// this require.cache-patching approach instead of vi.mock.
import { bucketStore, restoreRealModules, DELETE_FAILURE_MARKER } from "./testFakes.js";

const { cleanupShopPhotos, cleanupBusinessEventPhotos, cleanupUmbrellaEventPhotos } = await import("../index.js");

afterAll(restoreRealModules);

function seed(name) {
  bucketStore.set(name, { buffer: Buffer.from("bytes"), contentType: "image/webp" });
}

beforeEach(() => {
  bucketStore.clear();
});

describe("cleanupShopPhotos", () => {
  it("deletes every object under the deleted shop's photo prefix", async () => {
    seed("shops/9001/abc.webp");
    seed("shops/9001/abc_thumb.webp");
    seed("shops/9001/abc_detail.webp");
    seed("shops/9002/keep-me.webp");

    await cleanupShopPhotos.run({ params: { shopId: "9001" } });

    expect([...bucketStore.keys()]).toEqual(["shops/9002/keep-me.webp"]);
  });

  it("is a no-op (doesn't throw) when the shop never had a photo", async () => {
    await expect(cleanupShopPhotos.run({ params: { shopId: "9003" } })).resolves.toBeUndefined();
  });

  it("swallows a Storage failure instead of propagating it — best-effort cleanup", async () => {
    await expect(
      cleanupShopPhotos.run({ params: { shopId: DELETE_FAILURE_MARKER } }),
    ).resolves.toBeUndefined();
  });
});

describe("cleanupBusinessEventPhotos", () => {
  it("deletes every object under the deleted event's photo prefix, leaving other events untouched", async () => {
    seed("businessEvents/evt1/abc.webp");
    seed("businessEvents/evt1/abc_thumb.webp");
    seed("businessEvents/evt2/keep-me.webp");

    await cleanupBusinessEventPhotos.run({ params: { eventId: "evt1" } });

    expect([...bucketStore.keys()]).toEqual(["businessEvents/evt2/keep-me.webp"]);
  });
});

describe("cleanupUmbrellaEventPhotos", () => {
  it("deletes every object under the deleted umbrella's photo prefix, leaving other umbrellas untouched", async () => {
    seed("umbrellaEvents/u1/abc.webp");
    seed("umbrellaEvents/u2/keep-me.webp");

    await cleanupUmbrellaEventPhotos.run({ params: { umbrellaId: "u1" } });

    expect([...bucketStore.keys()]).toEqual(["umbrellaEvents/u2/keep-me.webp"]);
  });
});
