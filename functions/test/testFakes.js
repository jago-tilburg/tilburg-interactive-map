import { createRequire } from "module";

// Shared require.cache-patching fakes for index.js's plain CommonJS
// require() calls (Vitest's vi.mock only intercepts the ESM import graph —
// see index.test.js's original top-of-file comment for the full
// explanation). Every test file that imports index.js needs all four of
// these faked, regardless of which export it actually cares about, since
// index.js unconditionally requires and initializes all of them at module
// load. Centralized here once three test files needed the identical ~40
// lines of setup.
const require = createRequire(import.meta.url);

const MODULE_PATHS = {
  app: require.resolve("firebase-admin/app"),
  firestore: require.resolve("firebase-admin/firestore"),
  storage: require.resolve("firebase-admin/storage"),
  sharp: require.resolve("sharp"),
  stripe: require.resolve("stripe"),
  resend: require.resolve("resend"),
  params: require.resolve("firebase-functions/params"),
  database: require.resolve("firebase-admin/database"),
  auth: require.resolve("firebase-admin/auth"),
};

const realCacheEntries = {};
for (const key of Object.keys(MODULE_PATHS)) {
  realCacheEntries[key] = require.cache[MODULE_PATHS[key]];
}

export const firestoreStore = new Map();
export const bucketStore = new Map();

// A sharp(buffer) call is treated as "not a real image" when the buffer's
// content is exactly this marker — lets a test exercise processPhotoUpload's
// undecodable-bytes branch without a real corrupt image file.
export const INVALID_IMAGE_MARKER = "NOT-A-REAL-IMAGE";

// bucket.deleteFiles() rejects for any prefix containing this marker — lets
// a test exercise deleteStorageDir's best-effort catch branch (e.g. by using
// this as the deleted record's id) without needing a real Storage failure.
export const DELETE_FAILURE_MARKER = "FAIL-DELETE";

function makeDocRef(path, id) {
  const key = `${path}/${id}`;
  return {
    id,
    get: async () => ({
      exists: firestoreStore.has(key),
      data: () => firestoreStore.get(key),
    }),
    update: async (patch) => {
      const current = firestoreStore.get(key) || {};
      firestoreStore.set(key, { ...current, ...patch });
    },
    delete: async () => {
      firestoreStore.delete(key);
    },
  };
}

// Only supports "==" filters, chained with AND — the only shape
// notifyAdminsOfNewReport's dedup-count query needs so far.
function makeQuery(path, filters) {
  return {
    where: (field, op, value) => makeQuery(path, [...filters, { field, op, value }]),
    get: async () => {
      const docs = [];
      for (const [key, value] of firestoreStore.entries()) {
        if (!key.startsWith(`${path}/`)) continue;
        const matches = filters.every((f) => {
          if (f.op !== "==") throw new Error(`fakeDb: unsupported operator ${f.op}`);
          return value[f.field] === f.value;
        });
        if (matches) docs.push({ id: key.slice(path.length + 1), data: () => value });
      }
      return { docs, size: docs.length };
    },
  };
}

const fakeDb = {
  collection: (path) => ({
    doc: (id) => makeDocRef(path, id),
    get: () => makeQuery(path, []).get(),
    where: (field, op, value) => makeQuery(path, [{ field, op, value }]),
  }),
};

// Fake RTDB, keyed by full path (e.g. "shops/shop1/name") — only what
// resolveReportedContent's shop-name lookups need: ref(path).once("value").
export const rtdbStore = new Map();

function makeRtdbRef(path) {
  return {
    once: async () => {
      const has = rtdbStore.has(path);
      return {
        exists: () => has,
        val: () => (has ? rtdbStore.get(path) : null),
      };
    },
  };
}

const fakeRtdb = { ref: (path) => makeRtdbRef(path) };

// Fake Admin Auth — just enough of getUser/generateEmailVerificationLink/
// generatePasswordResetLink for sendVerificationEmail/sendPasswordResetEmail.
// Keyed by uid; authUsersByEmail is a reverse index so
// generatePasswordResetLink(email) can find (or fail to find) a user the
// same way the real one does.
export const authUsersByUid = new Map();
export const authUsersByEmail = new Map();
let emailVerificationLinkResult = "https://example.com/verify-fake";
let passwordResetLinkResult = "https://example.com/reset-fake";
let passwordResetLinkError = null;

export function setAuthUser(uid, { email, emailVerified = false } = {}) {
  const record = { uid, email, emailVerified };
  authUsersByUid.set(uid, record);
  if (email) authUsersByEmail.set(email, record);
}

export function setPasswordResetLinkError(error) {
  passwordResetLinkError = error;
}

function notFoundError() {
  return Object.assign(new Error("There is no user record corresponding to the provided identifier."), {
    code: "auth/user-not-found",
  });
}

const fakeAdminAuth = {
  getUser: async (uid) => {
    const record = authUsersByUid.get(uid);
    if (!record) throw notFoundError();
    return record;
  },
  generateEmailVerificationLink: async () => emailVerificationLinkResult,
  generatePasswordResetLink: async (email) => {
    if (passwordResetLinkError) throw passwordResetLinkError;
    if (!authUsersByEmail.has(email)) throw notFoundError();
    return passwordResetLinkResult;
  },
};

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

const fakeBucket = {
  file: (name) => makeFile(name),
  deleteFiles: async ({ prefix } = {}) => {
    if (prefix.includes(DELETE_FAILURE_MARKER)) throw new Error("simulated deleteFiles failure");
    for (const key of [...bucketStore.keys()]) {
      if (key.startsWith(prefix)) bucketStore.delete(key);
    }
  },
};

// Configurable per-test fake Stripe client — see setStripeSessionResult/
// setStripeWebhookEvent/setStripeWebhookSignatureInvalid below.
export const stripeSessionsCreateCalls = [];
let stripeSessionResult = { id: "cs_test_fake", url: "https://checkout.stripe.com/session/cs_test_fake" };
let stripeWebhookEvent = null;
let stripeWebhookSignatureInvalid = false;

export function setStripeSessionResult(result) {
  stripeSessionResult = result;
}

export function setStripeWebhookEvent(event) {
  stripeWebhookEvent = event;
  stripeWebhookSignatureInvalid = false;
}

export function setStripeWebhookSignatureInvalid() {
  stripeWebhookSignatureInvalid = true;
}

function FakeStripe() {
  return {
    checkout: {
      sessions: {
        create: async (params) => {
          stripeSessionsCreateCalls.push(params);
          return stripeSessionResult;
        },
      },
    },
    webhooks: {
      constructEvent: (rawBody, signature, secret) => {
        if (stripeWebhookSignatureInvalid) {
          throw new Error("No signatures found matching the expected signature for payload");
        }
        return stripeWebhookEvent;
      },
    },
  };
}

// Configurable per-test fake Resend client — mirrors the Stripe fake above.
// resendSendCalls records every send attempt (to/subject/html) so a test can
// assert on email content without a real network call.
export const resendSendCalls = [];
let resendSendError = null;

export function setResendSendError(error) {
  resendSendError = error;
}

class FakeResend {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  get emails() {
    return {
      send: async (params) => {
        resendSendCalls.push(params);
        if (resendSendError) return { data: null, error: resendSendError };
        return { data: { id: "email_fake_id" }, error: null };
      },
    };
  }
}

// defineSecret/defineString outside a deployed function just print a
// warning and return "" (secrets) or ignore the `default` option
// (strings) — noisy and not test-controllable, so faked the same way the
// admin SDK is: a plain object with the real shape (.value()), nothing more.
function fakeDefineSecret(name) {
  return { name, value: () => `fake-${name}` };
}
function fakeDefineString(name, options) {
  return { name, value: () => (options && options.default) || "" };
}

function fakeSharp(buffer) {
  const isValid = buffer.toString() !== INVALID_IMAGE_MARKER;
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

require.cache[MODULE_PATHS.app] = {
  id: MODULE_PATHS.app,
  filename: MODULE_PATHS.app,
  loaded: true,
  exports: { initializeApp: () => {} },
};
require.cache[MODULE_PATHS.firestore] = {
  id: MODULE_PATHS.firestore,
  filename: MODULE_PATHS.firestore,
  loaded: true,
  exports: {
    getFirestore: () => fakeDb,
    FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
  },
};
require.cache[MODULE_PATHS.storage] = {
  id: MODULE_PATHS.storage,
  filename: MODULE_PATHS.storage,
  loaded: true,
  exports: { getStorage: () => ({ bucket: () => fakeBucket }) },
};
require.cache[MODULE_PATHS.sharp] = {
  id: MODULE_PATHS.sharp,
  filename: MODULE_PATHS.sharp,
  loaded: true,
  exports: fakeSharp,
};
require.cache[MODULE_PATHS.stripe] = {
  id: MODULE_PATHS.stripe,
  filename: MODULE_PATHS.stripe,
  loaded: true,
  exports: FakeStripe,
};
require.cache[MODULE_PATHS.resend] = {
  id: MODULE_PATHS.resend,
  filename: MODULE_PATHS.resend,
  loaded: true,
  exports: { Resend: FakeResend },
};
require.cache[MODULE_PATHS.params] = {
  id: MODULE_PATHS.params,
  filename: MODULE_PATHS.params,
  loaded: true,
  exports: { defineSecret: fakeDefineSecret, defineString: fakeDefineString },
};
require.cache[MODULE_PATHS.database] = {
  id: MODULE_PATHS.database,
  filename: MODULE_PATHS.database,
  loaded: true,
  exports: { getDatabase: () => fakeRtdb },
};
require.cache[MODULE_PATHS.auth] = {
  id: MODULE_PATHS.auth,
  filename: MODULE_PATHS.auth,
  loaded: true,
  exports: { getAuth: () => fakeAdminAuth },
};

export function restoreRealModules() {
  for (const key of Object.keys(MODULE_PATHS)) {
    const real = realCacheEntries[key];
    if (real) {
      require.cache[MODULE_PATHS[key]] = real;
    } else {
      delete require.cache[MODULE_PATHS[key]];
    }
  }
}
