import { describe, expect, test } from "vitest";
import { fixtureRevealModel } from "./fixture";
import { toRevealModel } from "./toRevealModel";

describe("toRevealModel", () => {
  test("strips expectedAnswer from every question", () => {
    const model = fixtureRevealModel();
    const reveal = toRevealModel(model);
    expect(reveal.questions).toHaveLength(model.questions.length);
    for (const q of reveal.questions) {
      expect(q).not.toHaveProperty("expectedAnswer");
      expect(q.id).toBeTruthy();
      expect(q.text).toBeTruthy();
      expect(q.kind).toBeTruthy();
      expect(q.hunks.length).toBeGreaterThan(0);
    }
  });

  test("keeps the rest of the model intact", () => {
    const model = fixtureRevealModel();
    const reveal = toRevealModel(model);
    expect(reveal.components).toEqual(model.components);
    expect(reveal.edges).toEqual(model.edges);
    expect(reveal.keyHunks).toEqual(model.keyHunks);
    expect(reveal.summary).toEqual(model.summary);
    expect(reveal.edgeCase).toBe(model.edgeCase);
  });
});
