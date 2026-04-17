import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  OBRA_PAPEL_LIST, OBRA_PAPEL_LABEL, ObraPapel, PAPEL_PARA_TIPO,
} from "@/lib/pessoas-helpers";
import { useUserRole } from "@/hooks/useUserRole";

export function EquipeTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [papel, setPapel] = useState<ObraPapel>("executor_operacional");
  const [pessoaId, setPessoaId] = useState<string>("");

  const { data: vinculos } = useQuery({
    queryKey: ["obra-responsaveis", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_responsaveis")
        .select("id, papel, pessoa_id, created_at, pessoas:pessoa_id ( id, nome, tipo, cargo, tipo_servico, telefone, email )")
        .eq("obra_id", obraId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const tipoNecessario = PAPEL_PARA_TIPO[papel];
  const { data: pessoasDisponiveis } = useQuery({
    queryKey: ["pessoas-ativas", tipoNecessario],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome, cargo, tipo_servico")
        .eq("tipo", tipoNecessario)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("obra_responsaveis").insert([{
        obra_id: obraId,
        pessoa_id: pessoaId,
        papel,
        created_by: u.user?.id ?? null,
      }]);
      if (error) throw error;
      const pessoa = pessoasDisponiveis?.find((p) => p.id === pessoaId);
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId,
        user_id: u.user?.id,
        evento: "Pessoa vinculada",
        detalhes: `${OBRA_PAPEL_LABEL[papel]}: ${pessoa?.nome ?? ""}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Pessoa vinculada");
      setPessoaId("");
      qc.invalidateQueries({ queryKey: ["obra-responsaveis", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_responsaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["obra-responsaveis", obraId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Vincular pessoa
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Papel na obra</Label>
              <Select value={papel} onValueChange={(v: ObraPapel) => { setPapel(v); setPessoaId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBRA_PAPEL_LIST.map((p) => <SelectItem key={p} value={p}>{OBRA_PAPEL_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pessoa</Label>
              <Select value={pessoaId} onValueChange={setPessoaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(pessoasDisponiveis?.length ?? 0) === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma pessoa ativa cadastrada</div>
                  )}
                  {pessoasDisponiveis?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}{p.cargo ? ` • ${p.cargo}` : p.tipo_servico ? ` • ${p.tipo_servico}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={() => addMut.mutate()} disabled={!pessoaId || addMut.isPending}>
            {addMut.isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Equipe vinculada
        </h3>
        {(vinculos?.length ?? 0) === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma pessoa vinculada ainda.</p>
        )}
        {vinculos?.map((v: any) => (
          <div key={v.id} className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
            <div>
              <p className="font-medium">{v.pessoas?.nome ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {OBRA_PAPEL_LABEL[v.papel as ObraPapel]}
                {v.pessoas?.cargo && ` • ${v.pessoas.cargo}`}
                {v.pessoas?.tipo_servico && ` • ${v.pessoas.tipo_servico}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{v.pessoas?.tipo}</Badge>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => removeMut.mutate(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
