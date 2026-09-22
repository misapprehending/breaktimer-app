import { describe, expect, it } from "vitest";
import { formatTimeSinceLastBreak } from "./utils";

describe("formatTimeSinceLastBreak", () => {
  it("uses break as the default noun", () => {
    expect(formatTimeSinceLastBreak(120)).toBe("2m since last break");
  });

  it("can describe time since the last stand", () => {
    expect(formatTimeSinceLastBreak(120, "stand")).toBe("2m since last stand");
  });
});
