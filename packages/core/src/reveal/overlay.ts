import type { PredictionScore } from "../predict";

export type PredictionKind = "hit" | "miss" | "fa" | "none";

export function predictionKind(id: string, score: PredictionScore): PredictionKind {
  if (score.hits.includes(id)) return "hit";
  if (score.missed.includes(id)) return "miss";
  if (score.falseAlarms.includes(id)) return "fa";
  return "none";
}

export function predictionOverlay(id: string, score: PredictionScore): {
  badgeClass: string;
  glyph: string;
} {
  switch (predictionKind(id, score)) {
    case "hit":
      return { badgeClass: "b-hit", glyph: "✓" };
    case "miss":
      return { badgeClass: "b-miss", glyph: "!" };
    case "fa":
      return { badgeClass: "b-false", glyph: "?" };
    case "none":
      return { badgeClass: "b-hide", glyph: "" };
  }
}
