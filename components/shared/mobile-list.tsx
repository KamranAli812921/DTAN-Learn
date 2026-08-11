import { cn } from "@/lib/utils";

/** Mobile-only (< sm) stacked-card fallback for a data table — shown instead
 *  of the table's horizontally-scrolling layout so every column's data
 *  stays visible without side-scrolling. Pair with `hidden sm:block` on the
 *  <Table> and `sm:hidden` on this. */
export function MobileList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("sm:hidden divide-y", className)}>{children}</div>;
}

export function MobileCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4 space-y-2", className)}>{children}</div>;
}

export function MobileCardHeader({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}

export function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {/* break-words (not truncate) — every value must stay fully visible, never clipped */}
      <span className="text-right font-medium min-w-0 break-words">{children}</span>
    </div>
  );
}
