import { afterAll, beforeEach, describe, expect, it } from "vitest";
// See testFakes.js for why index.js's plain CommonJS require() calls need
// this require.cache-patching approach instead of vi.mock.
import { bucketStore, INVALID_IMAGE_MARKER, restoreRealModules } from "./testFakes.js";

const { processPhotoUpload } = await import("../index.js");

afterAll(restoreRealModules);

const BUCKET = "test-bucket";
const INVALID_MARKER = INVALID_IMAGE_MARKER;

function seed(name, content, contentType = "image/webp") {
  bucketStore.set(name, { buffer: Buffer.from(content), contentType });
}

function finalize(name, contentType = "image/webp") {
  return processPhotoUpload.run({ data: { bucket: BUCKET, name, contentType } });
}

beforeEach(() => {
  bucketStore.clear();
});

describe("processPhotoUpload — skip conditions", () => {
  it("skips a name already ending in _thumb.webp without downloading anything", async () => {
    await finalize("shops/1/abc_thumb.webp");
    expect(bucketStore.size).toBe(0);
  });

  it("skips a name already ending in _detail.webp", async () => {
    await finalize("shops/1/abc_detail.webp");
    expect(bucketStore.size).toBe(0);
  });

  it("skips a non-image/webp content type", async () => {
    seed("shops/1/abc.webp", "some-bytes", "image/webp");
    await finalize("shops/1/abc.webp", "image/png");
    // Only the seeded original exists — no derivatives were generated.
    expect([...bucketStore.keys()]).toEqual(["shops/1/abc.webp"]);
  });

  it("skips a path outside the three photo kinds", async () => {
    seed("appTexts/abc.webp", "some-bytes");
    await finalize("appTexts/abc.webp");
    expect([...bucketStore.keys()]).toEqual(["appTexts/abc.webp"]);
  });

  it("skips a path missing the {kind}/{id}/{file} shape", async () => {
    seed("shops/abc.webp", "some-bytes");
    await finalize("shops/abc.webp");
    expect([...bucketStore.keys()]).toEqual(["shops/abc.webp"]);
  });
});

describe("processPhotoUpload — valid image", () => {
  it("generates a 480px-wide thumbnail and a 960px-wide detail derivative alongside the original", async () => {
    seed("shops/9001/abc.webp", "real-image-bytes");

    await finalize("shops/9001/abc.webp");

    expect(bucketStore.has("shops/9001/abc.webp")).toBe(true);
    expect(bucketStore.get("shops/9001/abc_thumb.webp")).toMatchObject({ contentType: "image/webp" });
    expect(bucketStore.get("shops/9001/abc_detail.webp")).toMatchObject({ contentType: "image/webp" });
  });

  it("works for businessEvents and umbrellaEvents paths too", async () => {
    seed("businessEvents/evt1/x.webp", "real-image-bytes");
    seed("umbrellaEvents/u1/x.webp", "real-image-bytes");

    await finalize("businessEvents/evt1/x.webp");
    await finalize("umbrellaEvents/u1/x.webp");

    expect(bucketStore.has("businessEvents/evt1/x_thumb.webp")).toBe(true);
    expect(bucketStore.has("businessEvents/evt1/x_detail.webp")).toBe(true);
    expect(bucketStore.has("umbrellaEvents/u1/x_thumb.webp")).toBe(true);
    expect(bucketStore.has("umbrellaEvents/u1/x_detail.webp")).toBe(true);
  });
});

describe("processPhotoUpload — undecodable bytes", () => {
  it("deletes the original and generates no derivatives when the bytes aren't a real image", async () => {
    seed("shops/9001/fake.webp", INVALID_MARKER);

    await finalize("shops/9001/fake.webp");

    expect(bucketStore.has("shops/9001/fake.webp")).toBe(false);
    expect(bucketStore.has("shops/9001/fake_thumb.webp")).toBe(false);
    expect(bucketStore.has("shops/9001/fake_detail.webp")).toBe(false);
  });
});
