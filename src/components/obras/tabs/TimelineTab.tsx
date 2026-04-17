import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TimelineTab({ obraId }: { obraId: string }) {
  const { data } = useQuery({
    queryKey: ["timeline", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("obra_timeline").select("*").eq("obra_id", obraId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-3">
      {(data?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sem eventos</p>}
      <ol className="relative border-l border-border pl-4">
        {data?.map((e) => (
          <li key={e.id} className="mb-4">
            <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <div className="text-sm font-medium">{e.evento}</div>
            {e.detalhes && <div className="text-xs text-muted-foreground">{e.detalhes}</div>}
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {format(new Date(e.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
