import { describe, expect, it } from "vitest";
import { LING_PET_ANIMATIONS, type LingPetState } from "@/components/ling-pet";

describe("LingPet animation contract", () => {
  const expectedFrames: Record<LingPetState, number> = {
    idle: 6,
    waving: 4,
    failed: 8,
    waiting: 6,
    running: 6,
    review: 6
  };

  it("keeps each web strip aligned with its declared frame timing", () => {
    for (const [state, frameCount] of Object.entries(expectedFrames) as Array<[LingPetState, number]>) {
      const animation = LING_PET_ANIMATIONS[state];

      expect(animation.frameCount).toBe(frameCount);
      expect(animation.durations).toHaveLength(frameCount);
      expect(animation.src).toBe(`/mascot/pet/ling-${state}-v1.webp`);
      expect(animation.durations.every((duration) => duration > 0)).toBe(true);
    }
  });
});
