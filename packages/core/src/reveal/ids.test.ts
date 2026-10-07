import { describe, expect, test } from "vitest";
import { edgeTargetId } from "./ids";

describe("edgeTargetId", () => {
  test("combines endpoints and relation with a stable delimiter", () => {
    expect(edgeTargetId("ledger-service", "audit-log", "writes")).toBe(
      "ledger-service→audit-log:writes",
    );
  });
});
