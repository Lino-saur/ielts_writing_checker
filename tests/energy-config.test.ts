import { describe, expect, it } from "vitest";
import { DEFAULT_ENERGY_BALANCE } from "@/lib/energy-config";

describe("energy configuration", () => {
  it("grants three bottles of Magic Ink to newly created energy accounts", () => {
    expect(DEFAULT_ENERGY_BALANCE).toBe(3);
  });
});
