export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: {
      code: "AUTH_REQUIRED" | "EMAIL_UNVERIFIED" | "ONBOARDING_REQUIRED" |
        "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" |
        "RATE_LIMITED" | "CONFIG_REQUIRED" | "RIGHTS_RESTRICTED" | "INTERNAL_ERROR";
      message: string;
      fieldErrors?: Record<string, string[]>;
      retryAfterSeconds?: number;
    } };

export type CursorPage<T> = { items: T[]; nextCursor: string | null };
