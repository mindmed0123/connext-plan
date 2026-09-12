import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";

interface Composicao {
  id: string; codigo: string; descricao: string; unidade: string;
  origem: string; preco_calculado: number; data_referencia: string | null;
}
interface ItemComp {
  id: string; tipo: "insumo" | "composicao"; insumo_id: string | null;
  composicao_filha_id: string | null; coeficiente: number;
}

export default function Composicoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [nova, setNova] = useState({ codigo: "", descricao: "", unidade: "un" });
  const [novaAberta, setNovaAberta] = useState(false);
  const [novoItem, setNovoItem] = useState({ tipo: "insumo", refId: "", coeficiente: "1" });
  const [dataRef, setDataRef] = useState("");

  const { data: composicoes = [] } = useQuery({
    queryKey: [empresaId, "composicoes"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("composicoes").select("*").order("codigo").limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Composicao[];
    },
  });

  const { data: insumos = [] } = useQuery({
    queryKey: [empresaId, "insumos", "para-composicao"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("insumos").select("id, codigo, descricao, unidade, preco_unitario").order("codigo").limit(500);
      if (error) throw error;
      return (data ?? []) as { id: string; codigo: string; descricao: string; unidade: string; preco_unitario: number }[];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: [empresaId, "composicao-itens", selecionada],
    enabled: !!empresaId && !!selecionada,
    queryFn: async () => {
      const { data, error } = await supabase.from("composicao_itens").select("*").eq("composicao_id", selecionada!).order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as ItemComp[];
    },
  });

  const comp = composicoes.find((c) => c.id === selecionada) ?? null;
  const mapaInsumos = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);
  const mapaComp = useMemo(() => new Map(composicoes.map((c) => [c.id, c])), [composicoes]);

  const linhas = itens.map((it) => {
    const nome = it.tipo === "insumo"
      ? mapaInsumos.get(it.insumo_id ?? "")?.descricao ?? "(insumo removido)"
      : mapaComp.get(it.composicao_filha_id ?? "")?.descricao ?? "(subcomposição)";
    const unit = it.tipo === "insumo"
      ? Number(mapaInsumos.get(it.insumo_id ?? "")?.preco_unitario ?? 0)
      : Number(mapaComp.get(it.composicao_filha_id ?? "")?.preco_calculado ?? 0);
    return { ...it, nome, unit, custo: unit * Number(it.coeficiente) };
  });
  const total = linhas.reduce((s, l) => s + l.custo, 0);

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("composicoes").insert({
        empresa_id: empresaId, codigo: nova.codigo.trim(), descricao: nova.descricao.trim(),
        unidade: nova.unidade.trim() || "un", origem: "propria",
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Composição criada."); setNovaAberta(false);
      setNova({ codigo: "", descricao: "", unidade: "un" });
      await qc.invalidateQueries({ queryKey: [empresaId, "composicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!selecionada || !novoItem.refId) throw new Error("Escolha o insumo ou a composição.");
      const { error } = await supabase.from("composicao_itens").insert({
        empresa_id: empresaId,
        composicao_id: selecionada,
        tipo: novoItem.tipo,
        insumo_id: novoItem.tipo === "insumo" ? novoItem.refId : null,
        composicao_filha_id: novoItem.tipo === "composicao" ? novoItem.refId : null,
        coeficiente: Number(novoItem.coeficiente.replace(",", ".")) || 1,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      setNovoItem({ tipo: "insumo", refId: "", coeficiente: "1" });
      await qc.invalidateQueries({ queryKey: [empresaId, "composicao-itens", selecionada] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("composicao_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [empresaId, "composicao-itens", selecionada] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const recalcular = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recalcular_composicao" as never, {
        _composicao_id: selecionada, _data: dataRef ? `${dataRef}-01` : null,
      } as never);
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: async (v) => {
      toast.success(`Preço da composição: ${formatCurrency(v)}`);
      await qc.invalidateQueries({ queryKey: [empresaId, "composicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Composições</h1>
          <p className="text-sm text-muted-foreground">
            Serviços formados por insumos e por outras composições, com coeficiente por unidade.
          </p>
        </div>
        <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nova composição</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova composição</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-1"><Label>Código</Label>
                <Input value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} /></div>
              <div className="space-y-1"><Label>Descrição</Label>
                <Input value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} /></div>
              <div className="space-y-1"><Label>Unidade</Label>
                <Input value={nova.unidade} onChange={(e) => setNova({ ...nova, unidade: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending || !nova.codigo || !nova.descricao}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Lista</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Preço</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {composicoes.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Nenhuma composição.</TableCell></TableRow>
                )}
                {composicoes.map((c) => (
                  <TableRow
                    key={c.id}
                    className={`cursor-pointer ${selecionada === c.id ? "bg-muted" : ""}`}
                    onClick={() => setSelecionada(c.id)}
                  >
                    <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                    <TableCell>
                      {c.descricao}
                      <Badge variant="outline" className="ml-2">{c.unidade}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.preco_calculado))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {comp ? `${comp.codigo} · ${comp.descricao}` : "Selecione uma composição"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!comp && <p className="text-sm text-muted-foreground">Clique em uma composição da lista para ver a árvore.</p>}
            {comp && (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Data de referência</Label>
                    <Input type="month" value={dataRef} onChange={(e) => setDataRef(e.target.value)} className="w-40" />
                  </div>
                  <Button variant="outline" onClick={() => recalcular.mutate()} disabled={recalcular.isPending}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Recalcular
                  </Button>
                </div>

                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Item</TableHead><TableHead className="text-right">Coef.</TableHead>
                    <TableHead className="text-right">Unitário</TableHead><TableHead className="text-right">Custo</TableHead><TableHead />
                  </TableRow></TableHeader>
                  <TableBody>
                    {linhas.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Sem itens ainda.</TableCell></TableRow>
                    )}
                    {linhas.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <span className="mr-2 text-xs text-muted-foreground">{l.tipo === "insumo" ? "insumo" : "subcomposição"}</span>
                          {l.nome}
                        </TableCell>
                        <TableCell className="text-right">{Number(l.coeficiente)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.unit)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.custo)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => remover.mutate(l.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="font-medium">Total por {comp.unidade}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[130px_1fr_100px_auto]">
                  <Select value={novoItem.tipo} onValueChange={(v) => setNovoItem({ ...novoItem, tipo: v, refId: "" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insumo">Insumo</SelectItem>
                      <SelectItem value="composicao">Subcomposição</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={novoItem.refId} onValueChange={(v) => setNovoItem({ ...novoItem, refId: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                    <SelectContent>
                      {novoItem.tipo === "insumo"
                        ? insumos.map((i) => <SelectItem key={i.id} value={i.id}>{i.codigo} · {i.descricao}</SelectItem>)
                        : composicoes.filter((c) => c.id !== comp.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.codigo} · {c.descricao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={novoItem.coeficiente}
                    onChange={(e) => setNovoItem({ ...novoItem, coeficiente: e.target.value })}
                    placeholder="Coef."
                  />
                  <Button onClick={() => addItem.mutate()} disabled={addItem.isPending}>Adicionar</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
