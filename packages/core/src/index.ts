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
export { parsePrUrl, type ParsedPrUrl } from "./github";
