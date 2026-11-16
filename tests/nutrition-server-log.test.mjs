import test from "node:test";
import assert from "node:assert/strict";

// The memory store must be chosen before the handler is imported, so that a test run never
// touches a real bucket or database.
process.env.ASHA_MEMORY_STORE = "1";
process.env.LOCAL_DEV = "1";

const { default: handler } = await import("../src/server/handlers/nutrition.js");
const { default: sessionHandler } = await import("../src/server/handlers/session.js");
const { calculate } = await import("../public/app/nutrition/engine.js");

/**
 * A fake request and response, in the shape the handler expects.
 *
 * @param {{method?:string, body?:object, query?:object, headers?:object}} opts
 */
function makeReq(opts = {}) {
  return {
    method: opts.method ?? "POST",
    headers: { host: "localhost:3000", ...(opts.headers ?? {}) },
    query: opts.query ?? {},
    body: opts.body ?? {},
    socket: { remoteAddress: "127.0.0.1" },
    on() {},
    removeListener() {},
  };
}

/**
 * A fake response that records what was written.
 */
function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    headersSent: false,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    end() {
      this.headersSent = true;
      return this;
    },
  };
  return res;
}

/**
 * A real session, so the credential is a real one.
 *
 * The handler checks the bearer token against a stored profile, so a made-up token would only
 * prove that made-up tokens are refused. A real session exercises the real path.
 */
const CREDENTIALS = await (async () => {
  const req = makeReq({ method: "POST", body: { action: "create", label: "Nutrition test", assessment: {} } });
  const res = makeRes();
  await sessionHandler(req, res);
  if (res.statusCode !== 200) throw new Error(`the test session could not be created: ${JSON.stringify(res.body)}`);
  return { patientId: res.body.patientId, token: res.body.patientToken, caregiverToken: res.body.caregiverToken };
})();

/**
 * Run the handler and return the response.
 *
 * @param {object} opts
 */
async function call(opts) {
  const req = makeReq(opts);
  const res = makeRes();
  await handler(req, res);
  return res;
}

/**
 * A request that carries the patient's credential.
 *
 * @param {object} body
 */
function asPatient(body) {
  return {
    method: "POST",
    body: { ...body, patientId: CREDENTIALS.patientId },
    headers: { authorization: `Bearer ${CREDENTIALS.token}` },
  };
}

test("a meal with no credential is refused", async () => {
  const res = await call({ method: "POST", body: { action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 100 }] } });
  assert.equal(res.statusCode, 401, "a meal cannot be logged without the person's credential");
});

test("a confirmed meal of a known food is stored with its nutrients computed by the server", async () => {
  const res = await call(
    asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 150, method: "weighed" }] }),
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.meal.total.kcal, calculate("rice-cooked", 150).nutrients.kcal);
  assert.equal(res.body.meal.confirmed, true);
  assert.equal(res.body.meal.items.length, 1);
});

test("a client-supplied nutrient value is refused, not ignored", async () => {
  const res = await call(
    asPatient({
      action: "log",
      confirmed: true,
      items: [{ foodId: "rice-cooked", grams: 150, kcal: 9999 }],
    }),
  );
  assert.equal(res.statusCode, 400, "an item with a field that is not allowed must be refused");
  assert.match(res.body.error, /kcal|not accepted/i);
});

test("a client-supplied image is refused", async () => {
  for (const key of ["photo", "image", "dataUrl", "base64", "pixels"]) {
    const res = await call(
      asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 150 }], [key]: "x" }),
    );
    assert.equal(res.statusCode, 400, `a payload carrying ${key} must be refused`);
  }
});

test("a client-supplied total is refused even at the top level of the payload", async () => {
  const res = await call(
    asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 150 }], total: { kcal: 9999 } }),
  );
  assert.equal(res.statusCode, 400);
});

test("an unconfirmed meal is never stored as a confirmed meal", async () => {
  const res = await call(asPatient({ action: "log", confirmed: false, items: [{ foodId: "rice-cooked", grams: 150 }] }));
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /confirm/i);
});

test("a food the catalogue does not know is refused", async () => {
  const res = await call(asPatient({ action: "log", confirmed: true, items: [{ foodId: "not-a-food", grams: 150 }] }));
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /does not know/i);
});

test("a meal with no foods is refused", async () => {
  const res = await call(asPatient({ action: "log", confirmed: true, items: [] }));
  assert.equal(res.statusCode, 400);
});

test("an amount of zero or a negative amount is refused", async () => {
  for (const grams of [0, -10]) {
    const res = await call(asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams }] }));
    assert.equal(res.statusCode, 400, `an amount of ${grams} must be refused`);
  }
});

test("an absurd amount is refused", async () => {
  const res = await call(asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 99999 }] }));
  assert.equal(res.statusCode, 400);
});

test("a portion method ASHA does not know is refused", async () => {
  const res = await call(
    asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 150, method: "guessed_by_eye" }] }),
  );
  assert.equal(res.statusCode, 400);
});

test("a caregiver cannot log a meal on the person's behalf", async () => {
  const res = await call({
    method: "POST",
    body: { action: "log", confirmed: true, patientId: CREDENTIALS.patientId, items: [{ foodId: "rice-cooked", grams: 150 }] },
    headers: { authorization: `Bearer ${CREDENTIALS.caregiverToken}` },
  });
  assert.equal(res.statusCode, 403, "a caregiver may read a shared meal but may not write one");
});

test("the stored meal records where its numbers came from", async () => {
  const res = await call(
    asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 150, method: "weighed" }] }),
  );
  const meal = res.body.meal;
  assert.equal(meal.items[0].databaseRecordId, "fdc:168878", "the meal must name the record its numbers came from");
  assert.ok(meal.dataVersion, "the meal must record the catalogue version it was computed with");
  assert.ok(meal.engineVersion, "the meal must record the calculator version");
  assert.ok(meal.at, "the meal must say when it was logged");
});

test("a recipe's assumptions are kept with the meal, so the person can see what was assumed", async () => {
  const res = await call(
    asPatient({ action: "log", confirmed: true, items: [{ foodId: "chicken-curry", grams: 210, method: "weighed" }] }),
  );
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.meal.items[0].assumptions.length > 0, "a recipe's assumptions must be stored with it");
});

test("a logged meal can be listed back", async () => {
  await call(asPatient({ action: "log", confirmed: true, items: [{ foodId: "rice-cooked", grams: 100, method: "weighed" }] }));
  const res = await call({
    method: "POST",
    body: { action: "list", patientId: CREDENTIALS.patientId },
    headers: { authorization: `Bearer ${CREDENTIALS.token}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.count >= 1, "the logged meal must be in the history");
  assert.ok(res.body.meals.every((m) => m.total && m.total.kcal !== undefined));
});

test("a meal that was not shared is not shown to a caregiver", async () => {
  await call(
    asPatient({
      action: "log",
      confirmed: true,
      shareWithCaregiver: false,
      items: [{ foodId: "rice-cooked", grams: 111, method: "weighed" }],
    }),
  );
  const res = await call({
    method: "POST",
    body: { action: "list", patientId: CREDENTIALS.patientId },
    headers: { authorization: `Bearer ${CREDENTIALS.caregiverToken}` },
  });
  assert.equal(res.statusCode, 200);
  // The meal was not shared, so the caregiver must not see it.
  assert.ok(
    !res.body.meals.some((m) => m.items.some((i) => i.grams === 111)),
    "a meal the person did not share must not be in the caregiver's list",
  );
});

test("a meal the person shared IS in the caregiver's list", async () => {
  await call(
    asPatient({
      action: "log",
      confirmed: true,
      shareWithCaregiver: true,
      items: [{ foodId: "dal", grams: 222, method: "weighed" }],
    }),
  );
  const res = await call({
    method: "POST",
    body: { action: "list", patientId: CREDENTIALS.patientId },
    headers: { authorization: `Bearer ${CREDENTIALS.caregiverToken}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(
    res.body.meals.some((m) => m.items.some((i) => i.grams === 222)),
    "a shared meal must be in the caregiver's list",
  );
});

test("a caregiver cannot delete the person's meal", async () => {
  const res = await call({
    method: "POST",
    body: { action: "delete", mealId: "anything", patientId: CREDENTIALS.patientId },
    headers: { authorization: `Bearer ${CREDENTIALS.caregiverToken}` },
  });
  assert.equal(res.statusCode, 403, "removing a person's record is not a caregiver's job");
});

test("an unknown action is refused", async () => {
  const res = await call(asPatient({ action: "teleport" }));
  assert.equal(res.statusCode, 400);
});
