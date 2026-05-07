import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { hashNewPassword, verifyPassword, generateSessionId } from "./dashboardAuth";

describe("dashboardAuth helpers", () => {
  it("hashNewPassword produces a bcrypt hash string", () => {
    const stored = hashNewPassword("testPassword123");
    expect(stored).toMatch(/^\$2[ab]\$\d{2}\$.{53}$/);
  });

  it("verifyPassword returns true for correct password (bcrypt)", () => {
    const stored = hashNewPassword("correctPassword");
    expect(verifyPassword("correctPassword", stored)).toBe(true);
  });

  it("verifyPassword returns false for wrong password (bcrypt)", () => {
    const stored = hashNewPassword("correctPassword");
    expect(verifyPassword("wrongPassword", stored)).toBe(false);
  });

  it("verifyPassword supports legacy SHA-256 format", () => {
    const salt = "a".repeat(32);
    const hash = createHash("sha256").update(salt + "legacyPass").digest("hex");
    const legacyStored = `${salt}:${hash}`;
    expect(verifyPassword("legacyPass", legacyStored)).toBe(true);
    expect(verifyPassword("wrongPass", legacyStored)).toBe(false);
  });

  it("generateSessionId returns 64-char hex string", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("two calls produce different session IDs", () => {
    const id1 = generateSessionId();
    const id2 = generateSessionId();
    expect(id1).not.toBe(id2);
  });
});
