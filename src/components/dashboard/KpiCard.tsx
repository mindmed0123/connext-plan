import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: string;
  to?: string;
}

export function KpiCard({ title, value, hint, icon: Icon, accent = "primary", to }: Props) {
  const inner = (
    <div className="stat-card group h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
          style={{ backgroundColor: `hsl(var(--${accent}) / 0.10)`, color: `hsl(var(--${accent}))` }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}
