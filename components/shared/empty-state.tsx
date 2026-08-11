import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Nothing here yet",
  description,
  icon: Icon = Inbox,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-muted-foreground">
      <Icon className="h-9 w-9 opacity-40" />
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm max-w-sm">{description}</p>}
    </div>
  );
}
