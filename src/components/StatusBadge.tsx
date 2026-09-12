import { cn } from "@/lib/utils";
import { useObraConfig } from "@/hooks/useObraConfig";

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const { statusLabel, statusColor } = useObraConfig();
  const color = statusColor(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}1A`,
        color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {statusLabel(status)}
    </span>
  );
}
