import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hashNewPassword, verifyPassword, generateSessionId } from "./dashboardAuth";

describe("dashboardAuth helpers", () => {
  it("hashNewPassword produces a salt:hash string", () => {
    const stored = hashNewPassword("testPassword123");
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it("verifyPassword returns true for correct password", () => {
    const stored = hashNewPassword("correctPassword");
    expect(verifyPassword("correctPassword", stored)).toBe(true);
  });

  it("verifyPassword returns false for wrong password", () => {
    const stored = hashNewPassword("correctPassword");
    expect(verifyPassword("wrongPassword", stored)).toBe(false);
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
