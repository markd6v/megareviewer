import type { PipelineVersion } from "../../domain/review/index.ts";
import type { AnalysisModel } from "../ports/index.ts";

/** Bump whenever pipeline logic changes what an analysis contains. */
export const PIPELINE_VERSION = "1";

export const pipelineVersion = (model: AnalysisModel): PipelineVersion =>
  `${PIPELINE_VERSION}+${model.version}`;
