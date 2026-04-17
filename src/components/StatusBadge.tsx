import { OBRA_STATUS_COLOR, OBRA_STATUS_LABEL } from "@/lib/obra-helpers";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type ObraStatus = Database["public"]["Enums"]["obra_status"];

export function StatusBadge({ status, className }: { status: ObraStatus; className?: string }) {
  const color = OBRA_STATUS_COLOR[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        borderColor: `hsl(var(--${color}) / 0.25)`,
        backgroundColor: `hsl(var(--${color}) / 0.10)`,
        color: `hsl(var(--${color}))`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: `hsl(var(--${color}))` }} />
      {OBRA_STATUS_LABEL[status]}
    </span>
  );
}
