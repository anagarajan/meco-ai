import { describe, expect, it } from "vitest";

import { LocalMemoryExtractionProvider } from "../src/services/ai/localHeuristicProvider";

describe("LocalMemoryExtractionProvider", () => {
  it("classifies object locations", async () => {
    const provider = new LocalMemoryExtractionProvider();
    const result = await provider.extract("Remember that my passport is in the blue drawer", {} as never);
    expect(result.memoryType).toBe("object_location");
    expect(result.payload.subject).toBe("passport");
  });
});
