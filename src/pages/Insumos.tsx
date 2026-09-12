import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Percent, Plus } from "lucide-react";
import { toast } from "sonner";
import { ImportarBaseDialog } from "@/components/base-custos/ImportarBaseDialog";
import { formatCurrency } from "@/lib/obra-helpers";

interface Insumo {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  preco_unitario: number;
  origem: string;
  tabela_referencia: string;
  data_referencia: string | null;
  ativo: boolean;
}

export default function Insumos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("todas");
  const [importar, setImportar] = useState(false);
  const [reajuste, setReajuste] = useState("");
  const [novo, setNovo] = useState({ codigo: "", descricao: "", unidade: "un", preco_unitario: "" });
  const [novoAberto, setNovoAberto] = useState(false);

  const { data: insumos = [], isLoading } = useQuery({
    queryKey: [empresaId, "insumos", busca, origem],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase.from("insumos").select("*").order("codigo").limit(500);
      if (busca.trim()) q = q.or(`codigo.ilike.%${busca.trim()}%,descricao.ilike.%${busca.trim()}%`);
      if (origem !== "todas") q = q.eq("origem", origem);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Insumo[];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("insumos").insert({
        empresa_id: empresaId,
        codigo: novo.codigo.trim(),
        descricao: novo.descricao.trim(),
        unidade: novo.unidade.trim() || "un",
        preco_unitario: Number(novo.preco_unitario.replace(",", ".")) || 0,
        origem: "propria",
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Insumo cadastrado.");
      setNovo({ codigo: "", descricao: "", unidade: "un", preco_unitario: "" });
      setNovoAberto(false);
      await qc.invalidateQueries({ queryKey: [empresaId, "insumos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reajustar = useMutation({
    mutationFn: async () => {
      const pct = Number(reajuste.replace(",", "."));
      if (!Number.isFinite(pct) || pct === 0) throw new Error("Informe o percentual.");
      const fator = 1 + pct / 100;
      for (const i of insumos) {
        const { error } = await supabase
          .from("insumos")
          .update({ preco_unitario: Math.round(Number(i.preco_unitario) * fator * 10000) / 10000 } as never)
          .eq("id", i.id);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Preços reajustados nos insumos listados.");
      setReajuste("");
      await qc.invalidateQueries({ queryKey: [empresaId, "insumos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Insumos</h1>
          <p className="text-sm text-muted-foreground">
            Materiais, mão de obra e equipamentos que formam o custo das composições.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportar(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar planilha
          </Button>
          <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo insumo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo insumo</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1"><Label>Código</Label>
                  <Input value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} /></div>
                <div className="space-y-1"><Label>Descrição</Label>
                  <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Unidade</Label>
                    <Input value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Preço unitário</Label>
                    <Input value={novo.preco_unitario} onChange={(e) => setNovo({ ...novo, preco_unitario: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => criar.mutate()} disabled={criar.isPending || !novo.codigo || !novo.descricao}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Busca e reajuste</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label>Buscar por código ou descrição</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="cimento, 00001…" />
          </div>
          <div className="space-y-1">
            <Label>Origem</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="propria">Base própria</SelectItem>
                <SelectItem value="referencia">Tabela de referência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reajustar os listados (%)</Label>
            <div className="flex gap-2">
              <Input value={reajuste} onChange={(e) => setReajuste(e.target.value)} placeholder="5 ou -3" />
              <Button variant="outline" onClick={() => reajustar.mutate()} disabled={reajustar.isPending || !reajuste}>
                <Percent className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Referência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && insumos.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum insumo. Cadastre um ou importe a sua planilha.
                </TableCell></TableRow>
              )}
              {insumos.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.codigo}</TableCell>
                  <TableCell>{i.descricao}</TableCell>
                  <TableCell>{i.unidade}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(i.preco_unitario))}</TableCell>
                  <TableCell>
                    <Badge variant={i.origem === "propria" ? "secondary" : "outline"}>
                      {i.origem === "propria" ? "própria" : "referência"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.tabela_referencia || "—"} {i.data_referencia ? `· ${i.data_referencia.slice(0, 7)}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ImportarBaseDialog open={importar} onOpenChange={setImportar} />
    </div>
  );
}
