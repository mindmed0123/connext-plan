import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import {
  OBRA_STATUS_LIST,
  OBRA_STATUS_LABEL,
  OBRA_STATUS_COLOR,
  REGIAO_LABEL,
  type ObraStatus,
} from "@/lib/obra-helpers";
import { ObraDetailSheet } from "@/components/obras/ObraDetailSheet";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";

type Obra = {
  id: string;
  codigo_chamado: string;
  descricao_servico: string;
  regiao: keyof typeof REGIAO_LABEL;
  engenheiro_responsavel: string;
  status: ObraStatus;
};

function ObraCard({ obra, dragging = false }: { obra: Obra; dragging?: boolean }) {
  return (
    <div
      className={`rounded-md border bg-card p-3 text-left transition ${
        dragging ? "shadow-lg ring-2 ring-primary/40" : "hover:shadow-elev-md"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">{obra.codigo_chamado}</div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{obra.descricao_servico}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{REGIAO_LABEL[obra.regiao]}</span>
            <span className="truncate">{obra.engenheiro_responsavel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraggableCard({ obra, onClick }: { obra: Obra; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: obra.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Avoid opening sheet right after drag
        if (!isDragging) onClick();
        e.stopPropagation();
      }}
      style={{ opacity: isDragging ? 0 : 1, cursor: "grab" }}
    >
      <ObraCard obra={obra} />
    </div>
  );
}

function Column({
  status,
  items,
  onCardClick,
}: {
  status: ObraStatus;
  items: Obra[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = OBRA_STATUS_COLOR[status];
  return (
    <div className="w-72 shrink-0">
      <div className="mb-2 flex items-center justify-between rounded-md border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(--${color}))` }} />
          <span className="text-xs font-semibold">{OBRA_STATUS_LABEL[status]}</span>
        </div>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[120px] space-y-2 rounded-md p-1 transition ${
          isOver ? "bg-accent/40 ring-2 ring-primary/40" : ""
        }`}
      >
        {items.map((o) => (
          <DraggableCard key={o.id} obra={o} onClick={() => onCardClick(o.id)} />
        ))}
        {items.length === 0 && (
          <p className="rounded-md border border-dashed py-4 text-center text-[11px] text-muted-foreground">
            Solte aqui
          </p>
        )}
      </div>
    </div>
  );
}

export default function Etapas() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const { data: obras } = useQuery<Obra[]>({
    queryKey: ["etapas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, codigo_chamado, descricao_servico, regiao, engenheiro_responsavel, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Obra[];
    },
  });

  // Realtime: invalidate on any obra change
  useEffect(() => {
    const ch = supabase
      .channel("etapas-obras")
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, () => {
        qc.invalidateQueries({ queryKey: ["etapas"] });
        qc.invalidateQueries({ queryKey: ["obras"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ObraStatus }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("obras").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: id,
        user_id: u.user?.id,
        evento: "Status alterado",
        detalhes: `Movido para: ${OBRA_STATUS_LABEL[status]}`,
      }]);
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["etapas"] });
      const prev = qc.getQueryData<Obra[]>(["etapas"]);
      qc.setQueryData<Obra[]>(["etapas"], (old) =>
        (old ?? []).map((o) => (o.id === id ? { ...o, status } : o))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["etapas"], ctx.prev);
      toast.error("Não foi possível mover a obra");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
    },
  });

  const grouped = useMemo(() => {
    const g: Record<ObraStatus, Obra[]> = OBRA_STATUS_LIST.reduce(
      (acc, s) => ({ ...acc, [s]: [] }),
      {} as Record<ObraStatus, Obra[]>
    );
    (obras ?? []).forEach((o) => {
      if (g[o.status]) g[o.status].push(o);
    });
    return g;
  }, [obras]);

  const activeObra = obras?.find((o) => o.id === activeId) ?? null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const newStatus = String(overId) as ObraStatus;
    const obra = obras?.find((o) => o.id === id);
    if (!obra || obra.status === newStatus) return;
    move.mutate({ id, status: newStatus });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Etapas das obras</h1>
        <p className="text-sm text-muted-foreground">
          Arraste qualquer obra entre etapas — atualização em tempo real
        </p>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {OBRA_STATUS_LIST.map((status) => (
              <Column
                key={status}
                status={status}
                items={grouped[status]}
                onCardClick={(id) => setSelectedId(id)}
              />
            ))}
          </div>
        </div>
        <DragOverlay>{activeObra ? <ObraCard obra={activeObra} dragging /> : null}</DragOverlay>
      </DndContext>

      <ObraDetailSheet obraId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
