/**
 * Vendor token encryption at rest — the property that matters is that a
 * database leak alone never yields a usable token, and that any tampering
 * fails LOUDLY instead of decrypting to something wrong.
 *
 * Run: node --experimental-strip-types --test src/lib/cctv/vendors/*.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { openVendorTokens, sealVendorTokens } from "./crypto.ts";
import { getCameraVendorTokenKey } from "./config.ts";

const KEY = randomBytes(32).toString("base64");

function withKey<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.CAMERA_VENDOR_TOKEN_KEY_V1;
  if (value === undefined) delete process.env.CAMERA_VENDOR_TOKEN_KEY_V1;
  else process.env.CAMERA_VENDOR_TOKEN_KEY_V1 = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CAMERA_VENDOR_TOKEN_KEY_V1;
    else process.env.CAMERA_VENDOR_TOKEN_KEY_V1 = prev;
  }
}

test("seal → open round-trips both tokens", () => {
  withKey(KEY, () => {
    const sealed = sealVendorTokens({
      accessToken: "acc-123",
      refreshToken: "ref-456",
    });
    const plain = openVendorTokens(sealed);
    assert.equal(plain.accessToken, "acc-123");
    assert.equal(plain.refreshToken, "ref-456");
  });
});

test("a missing refresh token stays missing (marker column is null)", () => {
  withKey(KEY, () => {
    const sealed = sealVendorTokens({ accessToken: "acc-only" });
    assert.equal(sealed.refreshTokenCiphertext, null);
    const plain = openVendorTokens(sealed);
    assert.equal(plain.accessToken, "acc-only");
    assert.equal(plain.refreshToken, undefined);
  });
});

test("ciphertext does not contain the plaintext token", () => {
  withKey(KEY, () => {
    const sealed = sealVendorTokens({ accessToken: "super-secret-token" });
    const stored = Buffer.from(sealed.accessTokenCiphertext, "base64").toString(
      "latin1",
    );
    assert.ok(!stored.includes("super-secret-token"));
  });
});

test("each seal uses a fresh nonce", () => {
  withKey(KEY, () => {
    const a = sealVendorTokens({ accessToken: "same" });
    const b = sealVendorTokens({ accessToken: "same" });
    assert.notEqual(a.nonce, b.nonce);
    assert.notEqual(a.accessTokenCiphertext, b.accessTokenCiphertext);
  });
});

test("tampered ciphertext fails to open", () => {
  withKey(KEY, () => {
    const sealed = sealVendorTokens({ accessToken: "acc" });
    const bytes = Buffer.from(sealed.accessTokenCiphertext, "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    sealed.accessTokenCiphertext = bytes.toString("base64");
    assert.throws(() => openVendorTokens(sealed));
  });
});

test("tampered auth tag fails to open", () => {
  withKey(KEY, () => {
    const sealed = sealVendorTokens({ accessToken: "acc" });
    const tag = Buffer.from(sealed.authTag, "base64");
    tag[0] = (tag[0] ?? 0) ^ 0xff;
    sealed.authTag = tag.toString("base64");
    assert.throws(() => openVendorTokens(sealed));
  });
});

test("the wrong key fails to open", () => {
  const sealed = withKey(KEY, () =>
    sealVendorTokens({ accessToken: "acc" }),
  );
  withKey(randomBytes(32).toString("base64"), () => {
    assert.throws(() => openVendorTokens(sealed));
  });
});

test("an unknown key version is rejected", () => {
  withKey(KEY, () => {
    const sealed = sealVendorTokens({ accessToken: "acc" });
    assert.throws(
      () => openVendorTokens({ ...sealed, keyVersion: 99 }),
      /key version/,
    );
  });
});

test("sealing without the env key throws instead of storing garbage", () => {
  withKey(undefined, () => {
    assert.throws(() => sealVendorTokens({ accessToken: "acc" }), /KEY_V1/);
  });
});

test("a key of the wrong length is rejected at read time", () => {
  withKey(Buffer.from("short").toString("base64"), () => {
    assert.throws(() => getCameraVendorTokenKey(), /32 bytes/);
  });
});

test("an empty access token cannot be sealed", () => {
  withKey(KEY, () => {
    assert.throws(() => sealVendorTokens({ accessToken: "" }));
  });
});
