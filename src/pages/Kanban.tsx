import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OBRA_STATUS_LIST, OBRA_STATUS_LABEL, OBRA_STATUS_COLOR, REGIAO_LABEL } from "@/lib/obra-helpers";
import { ObraDetailSheet } from "@/components/obras/ObraDetailSheet";

export default function Kanban() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: obras } = useQuery({
    queryKey: ["kanban"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline de obras</h1>
        <p className="text-sm text-muted-foreground">Visualização Kanban por status</p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {OBRA_STATUS_LIST.map((status) => {
            const items = obras?.filter((o) => o.status === status) ?? [];
            const color = OBRA_STATUS_COLOR[status];
            return (
              <div key={status} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(--${color}))` }} />
                    <span className="text-xs font-semibold">{OBRA_STATUS_LABEL[status]}</span>
                  </div>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      className="w-full rounded-md border bg-card p-3 text-left transition hover:shadow-elev-md"
                    >
                      <div className="text-xs font-semibold">{o.codigo_chamado}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{o.descricao_servico}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{REGIAO_LABEL[o.regiao]}</span>
                        <span className="truncate">{o.engenheiro_responsavel}</span>
                      </div>
                    </button>
                  ))}
                  {items.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-3">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ObraDetailSheet obraId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
