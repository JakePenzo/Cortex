import { describe, it, expect } from "bun:test";
import { classifyWrite, classifyRead } from "../../src/router/classifier.js";

describe("classifyWrite", () => {
  it("detects preference", () => {
    const r = classifyWrite({ content: "I prefer TypeScript strict mode" });
    expect(r.writeType).toBe("preference");
  });

  it("detects decision", () => {
    const r = classifyWrite({ content: "We decided to use Postgres because it supports JSONB" });
    expect(r.writeType).toBe("decision");
  });

  it("detects fact from path", () => {
    const r = classifyWrite({ content: "Auth service lives at /apps/auth, port 3001" });
    expect(r.writeType).toBe("fact");
  });

  it("uses explicit type hint", () => {
    const r = classifyWrite({ content: "anything", type: "session" });
    expect(r.writeType).toBe("session");
  });
});

describe("classifyRead", () => {
  it("classifies short keyword query", () => {
    const r = classifyRead({ query: "auth endpoint" });
    expect(r.readType).toBe("keyword");
  });

  it("classifies preference recall", () => {
    const r = classifyRead({ query: "how do I like to name variables?" });
    expect(r.readType).toBe("preference_recall");
  });

  it("classifies semantic query", () => {
    const r = classifyRead({ query: "anything related to error handling patterns in this project" });
    expect(r.readType).toBe("hybrid");
  });

  it("classifies empty as bootstrap", () => {
    const r = classifyRead({ query: "" });
    expect(r.readType).toBe("context_bootstrap");
  });
});
