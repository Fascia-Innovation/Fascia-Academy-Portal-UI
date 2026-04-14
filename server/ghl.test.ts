import { describe, expect, it } from "vitest";

describe("GHL API credentials", () => {
  it("GHL_API_KEY env var is set", () => {
    expect(process.env.GHL_API_KEY).toBeTruthy();
    expect(process.env.GHL_API_KEY).toMatch(/^pit-/);
  });

  it("GHL_LOCATION_ID env var is set", () => {
    expect(process.env.GHL_LOCATION_ID).toBeTruthy();
    expect(process.env.GHL_LOCATION_ID?.length).toBeGreaterThan(5);
  });
});
