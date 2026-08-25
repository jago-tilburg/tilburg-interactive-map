import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";

// Same require.cache-patching technique as index.test.js (see its top-of-
// file comment) — necessary again here because this is a separate module
// registry/file, and index.js unconditionally calls initializeApp() at
// module load regardless of which export a given test file cares about.
// Additionally fakes firebase-admin/storage (an in-memory bucket) and sharp
// (a minimal chainable fake) so processPhotoUpload can be exercised without
// a real Storage bucket or real image decoding.
const require = createRequire(import.meta.url);
const appPath = require.resolve("firebase-admin/app");
const firestorePath = require.resolve("firebase-admin/firestore");
const storagePath = require.resolve("firebase-admin/storage");
const sharpPath = require.resolve("sharp");
const realAppCacheEntry = require.cache[appPath];
const realFirestoreCacheEntry = require.cache[firestorePath];
const realStorageCacheEntry = require.cache[storagePath];
const realSharpCacheEntry = require.cache[sharpPath];

const bucketStore = new Map(); // object name -> { buffer, contentType }
const INVALID_MARKER = "NOT-A-REAL-IMAGE";

function makeFile(name) {
  return {
    download: async () => {
      const entry = bucketStore.get(name);
      if (!entry) throw new Error(`no such object: ${name}`);
      return [entry.buffer];
    },
    save: async (buffer, options) => {
      bucketStore.set(name, { buffer, contentType: options && options.contentType });
    },
    delete: async () => {
      bucketStore.delete(name);
    },
  };
}

const fakeBucket = { file: (name) => makeFile(name) };

function fakeSharp(buffer) {
  const isValid = buffer.toString() !== INVALID_MARKER;
  return {
    metadata: async () => {
      if (!isValid) throw new Error("unsupported image format");
      return { width: 1200, height: 800 };
    },
    clone() {
      return this;
    },
    resize() {
      return this;
    },
    webp() {
      return this;
    },
    toBuffer: async () => Buffer.from(`derivative-of:${buffer.toString()}`),
  };
}

require.cache[appPath] = {
  id: appPath,
  filename: appPath,
  loaded: true,
  exports: { initializeApp: () => {} },
};
require.cache[firestorePath] = {
  id: firestorePath,
  filename: firestorePath,
  loaded: true,
  exports: {
    getFirestore: () => ({ collection: () => ({ doc: () => ({}) }) }),
    FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  },
};
require.cache[storagePath] = {
  id: storagePath,
  filename: storagePath,
  loaded: true,
  exports: { getStorage: () => ({ bucket: () => fakeBucket }) },
};
require.cache[sharpPath] = {
  id: sharpPath,
  filename: sharpPath,
  loaded: true,
  exports: fakeSharp,
};

const { processPhotoUpload } = await import("../index.js");

afterAll(() => {
  for (const [path, real] of [
    [appPath, realAppCacheEntry],
    [firestorePath, realFirestoreCacheEntry],
    [storagePath, realStorageCacheEntry],
    [sharpPath, realSharpCacheEntry],
  ]) {
    if (real) {
      require.cache[path] = real;
    } else {
      delete require.cache[path];
    }
  }
});

const BUCKET = "test-bucket";

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
