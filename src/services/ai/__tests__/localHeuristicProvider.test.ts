import { describe, it, expect } from "vitest";
import {
  extractQuerySubject,
  LocalEmbeddingProvider,
} from "../localHeuristicProvider";

// ─── extractQuerySubject ──────────────────────────────────────────────────────

describe("extractQuerySubject", () => {
  it("extracts from 'where is my X?'", () => {
    const s = extractQuerySubject("where is my passport?");
    expect(s).toBe("passport");
  });

  it("extracts from 'where did I leave my X?'", () => {
    const s = extractQuerySubject("where did I leave my keys?");
    expect(s).toContain("keys");
  });

  it("extracts from 'what do I know about X?'", () => {
    const s = extractQuerySubject("what do I know about Sarah?");
    expect(s).toBe("sarah");
  });

  it("extracts from 'tell me about X'", () => {
    const s = extractQuerySubject("tell me about John");
    expect(s).toBe("john");
  });

  it("extracts from 'what did I promise X?'", () => {
    const s = extractQuerySubject("what did I promise Sarah?");
    expect(s).toBeTruthy();
  });

  it("extracts from 'does X like Y?'", () => {
    const s = extractQuerySubject("does Sarah like chocolate?");
    expect(s).toBe("sarah");
  });

  it("uses fallback for unrecognized patterns", () => {
    const s = extractQuerySubject("passport location");
    expect(s).toBeTruthy();
  });
});

// ─── LocalEmbeddingProvider ───────────────────────────────────────────────────

describe("LocalEmbeddingProvider", () => {
  const provider = new LocalEmbeddingProvider();

  it("returns a 256-dimensional normalized vector", async () => {
    const v = await provider.embed("my keys are in the drawer");
    expect(v).toHaveLength(256);
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1, 4);
  });

  it("produces non-zero vectors for non-empty input", async () => {
    const v = await provider.embed("passport is in the safe");
    expect(v.some((x) => x !== 0)).toBe(true);
  });

  it("produces identical vectors for identical text", async () => {
    const v1 = await provider.embed("my laptop is on the desk");
    const v2 = await provider.embed("my laptop is on the desk");
    expect(v1).toEqual(v2);
  });

  it("produces higher cosine similarity for related sentences than unrelated ones", async () => {
    const cosine = (a: number[], b: number[]) => {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
      return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
    };

    const base = await provider.embed("my keys are in the kitchen drawer");
    const similar = await provider.embed("I put the keys in the kitchen");
    const unrelated = await provider.embed("Sarah prefers tea over coffee");

    expect(cosine(base, similar)).toBeGreaterThan(cosine(base, unrelated));
  });

  it("handles empty string without throwing", async () => {
    const v = await provider.embed("");
    expect(v).toHaveLength(256);
  });
});
