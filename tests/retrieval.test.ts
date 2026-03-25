import { describe, expect, it } from "vitest";

import { defaultSettings } from "../src/db/database";
import {
  LocalEmbeddingProvider,
  extractQuerySubject,
  extractSubject,
} from "../src/services/ai/localHeuristicProvider";
import { rerank } from "../src/services/retrieval/retrievalService";

describe("LocalEmbeddingProvider", () => {
  it("keeps similar objects closer than unrelated ones", async () => {
    const provider = new LocalEmbeddingProvider();
    const passport = await provider.embed("passport is in blue drawer", defaultSettings);
    const question = await provider.embed("where is my passport", defaultSettings);
    const belt = await provider.embed("belt is in shoe closet", defaultSettings);

    const dot = (left: number[], right: number[]) => left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
    expect(dot(passport, question)).toBeGreaterThan(dot(belt, question));
  });
});

describe("subject-aware retrieval", () => {
  it("extracts multi-word and single-word subjects", () => {
    expect(extractSubject("car key is in first drawer", "object_location")).toBe("car key");
    expect(extractSubject("belt is in shoe closet", "object_location")).toBe("belt");
    expect(extractQuerySubject("where is my car key?")).toBe("car key");
    expect(extractQuerySubject("where is belt ?")).toBe("belt");
  });

  it("prefers exact subject matches over generic location overlap", () => {
    const createdAt = "2026-03-23T18:00:00.000Z";
    const beltMemory = {
      id: "m1",
      message_id: "msg1",
      memory_type: "object_location",
      canonical_text: "belt is in shoe closet",
      payload_json: { subject: "belt" },
      confidence: 0.88,
      source_kind: "text",
      created_at: createdAt,
    } as const;
    const passportMemory = {
      ...beltMemory,
      id: "m2",
      canonical_text: "passport is in my car drawer",
      payload_json: { subject: "passport" },
    };
    const carKeyMemory = {
      ...beltMemory,
      id: "m3",
      canonical_text: "car key is in first drawer",
      payload_json: { subject: "car key" },
    };

    const querySubject = extractQuerySubject("where is belt?");
    const beltScore = rerank(beltMemory, 0.25, querySubject);
    const passportScore = rerank(passportMemory, 0.33, querySubject);
    const carKeyScore = rerank(carKeyMemory, 0.34, querySubject);

    expect(beltScore).toBeGreaterThan(passportScore);
    expect(beltScore).toBeGreaterThan(carKeyScore);
  });

  it("supports strict subject filtering when the query names an object", () => {
    const querySubject = extractQuerySubject("where is the belt?");
    const candidateSubjects = ["belt", "car key", "passport"];
    const filtered = candidateSubjects.filter((subject) => {
      if (!querySubject) return true;
      return subject === querySubject || subject.includes(querySubject) || querySubject.includes(subject);
    });

    expect(filtered).toEqual(["belt"]);
  });
});
