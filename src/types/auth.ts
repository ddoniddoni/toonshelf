import type { ActionResult } from "./result";
export type FormState = ActionResult<{message: string}> | null;
export type FormAction = (previous: FormState, form: FormData) => Promise<FormState>;
