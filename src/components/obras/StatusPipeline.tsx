import { cn } from "@/lib/utils";
import { useObraConfig } from "@/hooks/useObraConfig";

interface Props {
  currentStatus: string;
  onChangeStatus: (s: string) => void;
  canEdit: boolean;
}

export function StatusPipeline({ currentStatus, onChangeStatus, canEdit }: Props) {
  const { statuses } = useObraConfig();
  const pipeline = statuses.map((s) => s.chave);
  const currentIdx = pipeline.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {statuses.map((cfg, i) => (
        <div key={cfg.chave} className="flex items-center gap-1 shrink-0">
          {i > 0 && (
            <span className={cn("block h-px w-3", i <= currentIdx ? "bg-primary/40" : "bg-border")} />
          )}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => canEdit && onChangeStatus(cfg.chave)}
            title={cfg.nome}
            className={cn(
              "h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all",
              i < currentIdx
                ? "bg-primary/20 border-primary/40 text-primary"
                : i === currentIdx
                  ? "bg-primary border-primary text-primary-foreground scale-110"
                  : "bg-muted border-border text-muted-foreground",
              canEdit && "hover:scale-110 cursor-pointer"
            )}
          >
            {i + 1}
          </button>
        </div>
      ))}
    </div>
  );
}
