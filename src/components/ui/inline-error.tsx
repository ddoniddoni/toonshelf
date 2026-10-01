import { CircleAlert } from "lucide-react";

export function InlineError({ message, id }: { message: string; id?: string }) {
  return <p className="inline-error" role="alert" id={id}><CircleAlert size={18} aria-hidden="true" />{message}</p>;
}
