import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, HardHat, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { OBRA_STATUS_LABEL } from "@/lib/obra-helpers";
import { ObraPapel, PessoaTipo, PAPEL_PARA_TIPO } from "@/lib/pessoas-helpers";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAPEL_POR_TIPO: Record<PessoaTipo, ObraPapel> = {
  administrativo: "responsavel_administrativo",
  operacional: "executor_operacional",
  terceirizado: "terceirizado",
};

export function PessoaObrasVinculadasTab({
  pessoaId,
  tipo,
}: {
  pessoaId: string;
  tipo: PessoaTipo;
}) {
  const qc = useQueryClient();
  const papel = PAPEL_POR_TIPO[tipo];
  const [openAdd, setOpenAdd] = useState(false);
  const [removerId, setRemoverId] = useState<string | null>(null);

  // Vínculos atuais
  const { data: vinculos, isLoading } = useQuery({
    queryKey: ["pessoa-obras-vinculadas", pessoaId, papel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_responsaveis")
        .select(`
          id, observacao, created_at,
          obra:obras!inner(id, codigo_chamado, descricao_servico, endereco, status, regiao)
        `)
        .eq("pessoa_id", pessoaId)
        .eq("papel", papel)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_responsaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obra desvinculada");
      qc.invalidateQueries({ queryKey: ["pessoa-obras-vinculadas", pessoaId, papel] });
      setRemoverId(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao desvincular");
      setRemoverId(null);
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Obras em que esta pessoa pode acessar e enviar fotos.
        </p>
        <Button size="sm" onClick={() => setOpenAdd(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Vincular obra
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && (vinculos?.length ?? 0) === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-8 text-muted-foreground">
          <HardHat className="h-6 w-6" />
          <p className="text-xs">Nenhuma obra vinculada ainda.</p>
        </div>
      )}

      <div className="space-y-2">
        {vinculos?.map((v: any) => (
          <div
            key={v.id}
            className="flex items-start justify-between gap-3 rounded-lg border bg-card p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{v.obra?.codigo_chamado}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {v.obra?.descricao_servico}
              </p>
              {v.obra?.endereco && (
                <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                  📍 {v.obra.endereco}
                </p>
              )}
              {v.observacao && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  {v.observacao}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[10px]">
                {OBRA_STATUS_LABEL[v.obra?.status as keyof typeof OBRA_STATUS_LABEL]}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => setRemoverId(v.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <VincularObraDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        pessoaId={pessoaId}
        papel={papel}
        jaVinculadasIds={(vinculos ?? []).map((v: any) => v.obra?.id).filter(Boolean)}
      />

      <AlertDialog open={!!removerId} onOpenChange={(o) => !o && setRemoverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular obra?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa não terá mais acesso a esta obra. Os dados da obra (fotos, etapas) permanecem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removerId && remover.mutate(removerId)}
              disabled={remover.isPending}
            >
              {remover.isPending ? "Removendo..." : "Desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VincularObraDialog({
  open, onOpenChange, pessoaId, papel, jaVinculadasIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pessoaId: string;
  papel: ObraPapel;
  jaVinculadasIds: string[];
}) {
  const qc = useQueryClient();
  const [obraId, setObraId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: obras } = useQuery({
    queryKey: ["obras-disponiveis-para-vinculo"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, codigo_chamado, descricao_servico, status")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const obrasDisponiveis = (obras ?? []).filter((o) => !jaVinculadasIds.includes(o.id));
  const obraSelecionada = obras?.find((o) => o.id === obraId);

  const vincular = useMutation({
    mutationFn: async () => {
      if (!obraId) throw new Error("Selecione uma obra");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("obra_responsaveis").insert([
        {
          obra_id: obraId,
          pessoa_id: pessoaId,
          papel,
          observacao: observacao || null,
          created_by: u.user?.id ?? null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obra vinculada");
      qc.invalidateQueries({ queryKey: ["pessoa-obras-vinculadas", pessoaId, papel] });
      setObraId(null);
      setObservacao("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao vincular"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular obra</DialogTitle>
          <DialogDescription>
            A pessoa terá acesso a esta obra para visualizar e enviar fotos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Obra</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  {obraSelecionada
                    ? `${obraSelecionada.codigo_chamado} — ${obraSelecionada.descricao_servico?.slice(0, 40)}`
                    : "Selecione uma obra..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por código ou descrição..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma obra disponível.</CommandEmpty>
                    <CommandGroup>
                      {obrasDisponiveis.map((o) => (
                        <CommandItem
                          key={o.id}
                          value={`${o.codigo_chamado} ${o.descricao_servico}`}
                          onSelect={() => {
                            setObraId(o.id);
                            setPopoverOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{o.codigo_chamado}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {o.descricao_servico}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Responsável pela parte hidráulica"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => vincular.mutate()} disabled={!obraId || vincular.isPending}>
            {vincular.isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
