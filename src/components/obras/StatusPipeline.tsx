import { OBRA_STATUS_LABEL } from "@/lib/obra-helpers";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type ObraStatus = Database["public"]["Enums"]["obra_status"];

interface Props {
  currentStatus: ObraStatus;
  onChangeStatus: (s: ObraStatus) => void;
  canEdit: boolean;
}

const PIPELINE: ObraStatus[] = [
  "recebido",
  "em_vistoria",
  "aguardando_orcamento",
  "em_aprovacao",
  "em_execucao",
  "finalizado",
  "aguardando_rc",
  "aguardando_pedido_compra",
  "aguardando_nf",
  "aguardando_pagamento",
  "pago",
];

export function StatusPipeline({ currentStatus, onChangeStatus, canEdit }: Props) {
  const currentIdx = PIPELINE.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {PIPELINE.map((s, i) => (
        <div key={s} className="flex items-center gap-1 shrink-0">
          {i > 0 && (
            <span
              className={cn(
                "block h-px w-3",
                i <= currentIdx ? "bg-primary/40" : "bg-border"
              )}
            />
          )}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => canEdit && onChangeStatus(s)}
            title={OBRA_STATUS_LABEL[s]}
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
