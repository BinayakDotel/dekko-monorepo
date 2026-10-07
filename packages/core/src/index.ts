export const PACKAGE_NAME = "@dekko/core";
export * from "./schema";
export * from "./diff";
export * from "./predict";
export * from "./read";
export * from "./answer";
export { analyze, type AnalyzeInput, type AnalyzeOptions, type AnalyzeResult } from "./ai/analyze";
export {
  grade,
  GradeSchema,
  type Grade,
  type GradeInput,
  type GradeOptions,
  type GradeResult,
} from "./ai/grade";
export { formatElapsed } from "./elapsed";
export { parsePrUrl, type ParsedPrUrl } from "./github";
export { edgeTargetId } from "./reveal/ids";
export {
  buildRevealGraph,
  type RevealEdgeLayout,
  type RevealLayout,
  type RevealNodeLayout,
  type RevealPoint,
} from "./reveal/layout";
export {
  renderRevealSvg,
  type RenderRevealSvgInput,
  type RenderRevealSvgResult,
  type RevealEdgeMeta,
  type RevealNodeMeta,
} from "./reveal/render";
export {
  toRevealModel,
  RevealModelSchema,
  RevealQuestionSchema,
  type RevealModel,
  type RevealQuestion,
} from "./reveal/toRevealModel";
export {
  buildTeachingList,
  CitedHunkRefSchema,
  TeachingKindSchema,
  SheetEntrySchema,
  TeachingListItemSchema,
  type BuildTeachingListInput,
  type BuildTeachingListResult,
  type CitedHunkRef,
  type SheetEntry,
  type TeachingKind,
  type TeachingListItem,
} from "./reveal/teachingList";
