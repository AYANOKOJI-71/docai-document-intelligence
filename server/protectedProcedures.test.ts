import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("protected document intelligence procedures", () => {
  it("does not expose document metadata without a Manus OAuth session", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());
    await expect(caller.documents.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("does not expose persisted chat history without a Manus OAuth session", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());
    await expect(caller.chat.conversations()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
