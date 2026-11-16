// The reply guard is the only thing between a model that omits the claims
// structure and the patient, so it has to cover every grammar in which a
// model can assert a completed action. These tests pin both directions:
// the contact claims it must refuse, and the legitimate sentences it must
// not refuse.

import test from "node:test";
import assert from "node:assert/strict";

import {
  replyIsSafe,
  replyIsAllowed,
  claimsAreSafe,
  UNSAFE_REPLY_PATTERN,
} from "../src/server/lib/reply-guard.js";
import { guides } from "../src/server/lib/knowledge.js";

test("a reply may not claim a caregiver was contacted, in any grammar", () => {
  const claims = [
    "I have contacted your caregiver.",
    "Your caregiver has been contacted.",
    "The caregiver was notified.",
    "I have asked your caregiver to come.",
    "I informed your caregiver.",
    "Your request has been sent.",
    "Someone has let your caregiver know.",
    "We have messaged your caregiver.",
    "Your caregiver is on the way.",
    "The emergency service has been alerted.",
    "A caregiver was contacted for you.",
    "Your caregiver has been alerted.",
    "I have escalated this to your caregiver.",
    "The request went through to your caregiver.",
    "Your doctor has been informed.",
    "The nurse was called.",
    "I have told the caregiver about your request.",
    "We have sent your request to your caregiver.",
    "Your message reached the nurse.",
    "The request was delivered to your caregiver.",
  ];
  for (const reply of claims)
    assert.equal(replyIsSafe(reply), false, `must refuse: ${reply}`);
});

test("the Bangla contact claims are refused too", () => {
  const claims = [
    "আপনার কেয়ারগিভারকে জানানো হয়েছে।",
    "আমি আপনার কেয়ারগিভারকে ডেকেছি।",
    "আপনার অনুরোধ পাঠানো হয়েছে।",
  ];
  for (const reply of claims)
    assert.equal(replyIsSafe(reply), false, `must refuse: ${reply}`);
});

test("a negated contact claim is not a contact claim", () => {
  const allowed = [
    "I have not contacted your caregiver.",
    "Your caregiver has not been contacted.",
    "Nothing has been sent yet.",
    "I did not tell the caregiver about that.",
    "The request has not been sent.",
  ];
  for (const reply of allowed)
    assert.equal(replyIsSafe(reply), true, `must allow: ${reply}`);
});

test("a description of how the app works is not a contact claim", () => {
  const allowed = [
    "Your caregiver is contacted when you confirm a request.",
    "The request goes to your caregiver after you confirm.",
    "Please ask your caregiver for help.",
    "The nurse will be called during the visit.",
    "A calibrated rapid triple blink proposes the currently offered need.",
    "It never sends by itself.",
    "Looking alone never sends anything.",
    "Ordinary blinks never initiate or confirm requests.",
    "Do not announce delivery without a verified receipt.",
    "The app does not place telephone calls.",
  ];
  for (const reply of allowed)
    assert.equal(replyIsSafe(reply), true, `must allow: ${reply}`);
});

test("the knowledge base survives the guard", () => {
  // The retrieval corpus is quoted back to the model and can be echoed in a
  // reply. A guard that refuses the app's own guidance is over-refusing.
  for (const [name, guide] of Object.entries(guides))
    assert.equal(replyIsSafe(guide), true, `must allow guide: ${name}`);
});

test("the original unsafe patterns still hold", () => {
  const unsafe = [
    "We ruled out an emergency.",
    "You are safe.",
    "Take 500 mg aspirin.",
    "Raise your arms.",
    "I have diagnosed a stroke.",
    "আপনি নিরাপদ",
    "হাত তুলুন",
  ];
  for (const reply of unsafe)
    assert.equal(replyIsSafe(reply), false, `must refuse: ${reply}`);
  assert.equal(UNSAFE_REPLY_PATTERN.test("I have called your caregiver."), true);
});

test("the named claims are checked as well as the text", () => {
  assert.equal(claimsAreSafe(undefined), true);
  assert.equal(claimsAreSafe([]), true);
  assert.equal(claimsAreSafe([{ type: "completed_action" }]), false);
  assert.equal(claimsAreSafe([{ type: "vital_value" }]), false);
  assert.equal(claimsAreSafe([{ type: "diagnosis" }]), false);
  assert.equal(claimsAreSafe([{ type: "medication" }]), false);
  assert.equal(claimsAreSafe([{ type: "education" }]), true);
  assert.equal(claimsAreSafe("not an array"), false);
  // A claim the model named blocks the reply even when the wording is clean.
  assert.equal(
    replyIsAllowed("Your caregiver will know shortly.", [
      { type: "completed_action" },
    ]),
    false,
  );
  // A clean reply with no claims passes both checks.
  assert.equal(replyIsAllowed("Here is some practice wording.", undefined), true);
  // An empty reply is never safe.
  assert.equal(replyIsSafe(""), false);
  assert.equal(replyIsSafe("   "), false);
  assert.equal(replyIsSafe(null), false);
});
