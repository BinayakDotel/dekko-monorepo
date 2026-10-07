import { z } from "zod";
import {
  ComponentSchema,
  EdgeSchema,
  KeyHunkSchema,
  QuestionKindSchema,
  HunkIdSchema,
  type ChangeModel,
} from "../schema";

export const RevealQuestionSchema = z.object({
  id: z.string().min(1),
  kind: QuestionKindSchema,
  text: z.string().min(1),
  hunks: z.array(HunkIdSchema).min(1),
});

export const RevealModelSchema = z.object({
  schemaVersion: z.literal(1),
  components: z.array(ComponentSchema).min(1),
  edges: z.array(EdgeSchema),
  keyHunks: z.array(KeyHunkSchema).min(1).max(3),
  questions: z.array(RevealQuestionSchema).length(3),
  summary: z.array(z.string().min(1)).length(3),
  edgeCase: z.string().min(1),
});

export type RevealQuestion = z.infer<typeof RevealQuestionSchema>;
export type RevealModel = z.infer<typeof RevealModelSchema>;

export function toRevealModel(model: ChangeModel): RevealModel {
  return {
    ...model,
    questions: model.questions.map(({ expectedAnswer: _omit, ...q }) => q),
  };
}
