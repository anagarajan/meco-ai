import { describe, it, expect } from "vitest";
import { rerank } from "../retrievalService";
import type { MemoryItem } from "../../../types/domain";

function makeMemory(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: "mem_1",
    message_id: "msg_1",
    memory_type: "object_location",
    canonical_text: "my keys are in the kitchen drawer",
    payload_json: { subject: "keys" },
    confidence: 0.88,
    source_kind: "text",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("rerank", () => {
  it("gives higher score to higher semantic similarity", () => {
    const m = makeMemory();
    const high = rerank(m, 0.9);
    const low = rerank(m, 0.3);
    expect(high).toBeGreaterThan(low);
  });

  it("applies subject boost for exact match", () => {
    const m = makeMemory({ payload_json: { subject: "keys" } });
    const withMatch = rerank(m, 0.5, "keys");
    const withoutMatch = rerank(m, 0.5, undefined);
    expect(withMatch).toBeGreaterThan(withoutMatch);
  });

  it("applies type boost when query type matches memory type", () => {
    const m = makeMemory({ memory_type: "object_location" });
    const withTypeMatch = rerank(m, 0.5, undefined, "object_location");
    const withTypeMiss = rerank(m, 0.5, undefined, "preference");
    expect(withTypeMatch).toBeGreaterThan(withTypeMiss);
  });

  it("applies superseded penalty", () => {
    const active = makeMemory();
    const superseded = makeMemory({ superseded_by: "mem_2" });
    expect(rerank(active, 0.5)).toBeGreaterThan(rerank(superseded, 0.5));
  });

  it("does NOT apply negative penalty when subjects differ", () => {
    const m = makeMemory({ payload_json: { subject: "passport" } });
    const withDifferentSubject = rerank(m, 0.5, "keys");
    const withNoSubject = rerank(m, 0.5, undefined);
    // Different subject should not be penalized below having no subject
    expect(withDifferentSubject).toBeGreaterThanOrEqual(withNoSubject);
  });

  it("returns a finite number for all inputs", () => {
    const m = makeMemory();
    expect(isFinite(rerank(m, 0, undefined, undefined))).toBe(true);
    expect(isFinite(rerank(m, 1, "keys", "object_location"))).toBe(true);
  });
});
