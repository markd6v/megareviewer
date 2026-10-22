import type { ErrorCode } from "../../../contracts/index.ts";

/** The contract's error codes, plus `unreachable`: no answer from megareviewer at all. */
export type ApiErrorCode = ErrorCode | "unreachable";

export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
}
