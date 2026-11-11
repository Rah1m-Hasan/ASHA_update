import test from "node:test";
import assert from "node:assert/strict";
import { toRouteHandler } from "../src/server/node-adapter.ts";

// Production must ignore the preview flag. Replace the selected private adapter
// methods before exercising the handler, so this test never uses a live store.
process.env.NODE_ENV = "production";
process.env.ASHA_MEMORY_STORE = "1";
delete process.env.SUPABASE_URL;
const { store } = await import("../src/server/lib/common.js");
const { memoryStore } = await import("../src/server/lib/memory-store.js");
const { blobStore } = await import("../src/server/lib/store.js");
const rows = new Map();
Object.assign(blobStore, {
  read: async (key) => rows.get(key) ?? null,
  write: async (key, value) => rows.set(key, structuredClone(value)),
  list: async (prefix) => [...rows.keys()].filter((key) => key.startsWith(prefix)),
  remove: async (keys) => keys.forEach((key) => rows.delete(key)),
});
const { default: handler } = await import("../src/server/handlers/clinic.js");

test("Production Clinic results do not claim local preview storage even when its flag is set", async () => {
  assert.equal(store, blobStore);
  assert.notEqual(store, memoryStore);
  const route = toRouteHandler(handler, { maxBodyLength: 660000 });
  const post = async (input, token) => {
    const response = await route(
      new Request("http://127.0.0.1/api/clinic", {
        method: "POST",
        headers: token ? { authorization: "Bearer " + token } : {},
        body: JSON.stringify(input),
      }),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.storageMode, undefined);
    return result;
  };
  const admin = await post({ action: "create", confirmed: true, name: "Isolated test" });
  await post({ tenant: admin.tenant, action: "read" }, admin.token);
  await post({ tenant: admin.tenant, action: "delete", confirm: "DELETE" }, admin.token);
});
