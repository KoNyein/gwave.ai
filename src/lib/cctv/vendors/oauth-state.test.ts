/**
 * OAuth state validation — the CSRF spine of account linking. Every failure
 * mode must be a hard stop; these tests enumerate them.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  OAUTH_STATE_MAX_AGE_MS,
  createOauthState,
  parseOauthState,
  pkceChallenge,
  validateOauthState,
} from "./oauth-state.ts";

const USER = "11111111-1111-1111-1111-111111111111";

test("round-trip: created state parses back identically", () => {
  const { state, cookieValue } = createOauthState({ provider: "fake", userId: USER });
  const parsed = parseOauthState(cookieValue);
  assert.deepEqual(parsed, state);
});

test("a matching callback validates", () => {
  const { state, cookieValue } = createOauthState({ provider: "fake", userId: USER });
  const parsed = parseOauthState(cookieValue);
  assert.equal(
    validateOauthState(parsed, { state: state.state, provider: "fake", userId: USER }),
    null,
  );
});

test("two flows never share state or verifier", () => {
  const a = createOauthState({ provider: "fake", userId: USER });
  const b = createOauthState({ provider: "fake", userId: USER });
  assert.notEqual(a.state.state, b.state.state);
  assert.notEqual(a.state.verifier, b.state.verifier);
});

test("a missing cookie fails as missing", () => {
  assert.equal(
    validateOauthState(null, { state: "x", provider: "fake", userId: USER }),
    "missing",
  );
});

test("a forged state value fails", () => {
  const { cookieValue } = createOauthState({ provider: "fake", userId: USER });
  const parsed = parseOauthState(cookieValue);
  assert.equal(
    validateOauthState(parsed, { state: "attacker", provider: "fake", userId: USER }),
    "state_mismatch",
  );
});

test("a state started for another provider fails", () => {
  const { state, cookieValue } = createOauthState({ provider: "fake", userId: USER });
  const parsed = parseOauthState(cookieValue);
  assert.equal(
    validateOauthState(parsed, {
      state: state.state,
      provider: "hikvision",
      userId: USER,
    }),
    "provider_mismatch",
  );
});

test("a state started by another user fails (login-CSRF)", () => {
  // ★ The classic: attacker starts a flow, victim finishes it — the vendor
  //   account would link to the VICTIM's session with the ATTACKER's state.
  //   Binding the user id into the stored state kills it.
  const { state, cookieValue } = createOauthState({ provider: "fake", userId: USER });
  const parsed = parseOauthState(cookieValue);
  assert.equal(
    validateOauthState(parsed, {
      state: state.state,
      provider: "fake",
      userId: "22222222-2222-2222-2222-222222222222",
    }),
    "user_mismatch",
  );
});

test("an aged-out state fails even if the cookie survived", () => {
  const { state, cookieValue } = createOauthState({
    provider: "fake",
    userId: USER,
    now: Date.now() - OAUTH_STATE_MAX_AGE_MS - 1000,
  });
  const parsed = parseOauthState(cookieValue);
  assert.equal(
    validateOauthState(parsed, { state: state.state, provider: "fake", userId: USER }),
    "expired",
  );
});

test("garbage cookie values parse to null, never throw", () => {
  for (const bad of ["", "not-base64!", Buffer.from("{}").toString("base64url"),
    Buffer.from('{"state":"short"}').toString("base64url"), undefined, null]) {
    assert.equal(parseOauthState(bad), null, String(bad));
  }
});

test("the PKCE challenge is the S256 of the verifier", () => {
  const { state, codeChallenge } = createOauthState({ provider: "fake", userId: USER });
  const expected = createHash("sha256").update(state.verifier).digest("base64url");
  assert.equal(codeChallenge, expected);
  assert.equal(pkceChallenge(state.verifier), expected);
});
