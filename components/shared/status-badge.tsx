import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "secondary" },
  present: { label: "Present", variant: "success" },
  absent: { label: "Absent", variant: "destructive" },
  late: { label: "Late", variant: "warning" },
  draft: { label: "Draft", variant: "secondary" },
  published: { label: "Published", variant: "success" },
  archived: { label: "Archived", variant: "secondary" },
  submitted: { label: "Submitted", variant: "success" },
  reviewed: { label: "Reviewed", variant: "default" },
  upcoming: { label: "Upcoming", variant: "outline" },
  completed: { label: "Completed", variant: "secondary" },
  dropped: { label: "Dropped", variant: "destructive" },
  scheduled: { label: "Scheduled", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const info = statusMap[status] ?? { label: status, variant: "outline" as const };
  return (
    <Badge variant={info.variant} className={cn("capitalize", className)}>
      {info.label}
    </Badge>
  );
}
