import { describe, expect, it } from "vitest";

describe("application title metadata", () => {
  it("uses the updated DocAI project title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("DocAI — AI Document Intelligence Assistant");
  });
});
