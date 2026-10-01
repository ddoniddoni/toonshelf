import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

export function EmptyState({ title, description, action, icon }: {
  title: string; description: string; action?: ReactNode; icon?: ReactNode;
}) {
  return <div className="empty-state">
    <span className="empty-icon" aria-hidden="true">{icon ?? <BookOpen size={26} />}</span>
    <h2>{title}</h2><p>{description}</p>{action}
  </div>;
}
