export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class ConstraintError extends AppError {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(violations[0] ?? "Constraint violation", 422, "CONSTRAINT");
    this.name = "ConstraintError";
    this.violations = violations;
  }
}

export function toErrorPayload(err: unknown): {
  ok: false;
  error: string;
  code: string;
  status: number;
  violations?: string[];
} {
  if (err instanceof AppError) {
    return {
      ok: false,
      error: err.message,
      code: err.code,
      status: err.status,
      violations: err instanceof ConstraintError ? err.violations : undefined,
    };
  }
  if (err instanceof Error && err.message === "Unauthorized") {
    return { ok: false, error: "Unauthorized", code: "UNAUTHORIZED", status: 401 };
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return { ok: false, error: message, code: "INTERNAL", status: 500 };
}
