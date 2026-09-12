import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeftRight, Info, Package, Plus, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { useObraConfig } from "@/hooks/useObraConfig";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";

type Tipo = "entrada" | "saida" | "transferencia" | "ajuste";

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  transferencia: "Transferência",
  ajuste: "Ajuste",
};

const ORIGEM_LABEL: Record<string, string> = {
  ordem_compra: "Recebimento de compra",
  requisicao: "Requisição da obra",
  transferencia: "Transferência",
  manual: "Manual",
};

const movimentoVazio = {
  tipo: "entrada" as Tipo,
  deposito_id: "",
  deposito_destino_id: "",
  material: "",
  unidade: "un",
  quantidade: "1",
  custo_unitario: "",
  obra_id: "",
  etapa_id: "",
  data: getTodayDateInputValue(),
  responsavel_id: "",
  observacoes: "",
  sentido: "entrada" as "entrada" | "saida",
};

export default function Estoque() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const { rotulos } = useObraConfig();
  const { config } = useEmpresaConfig();

  const [novoDeposito, setNovoDeposito] = useState(false);
  const [depForm, setDepForm] = useState({ nome: "", obra_id: "", observacoes: "" });
  const [movAberto, setMovAberto] = useState(false);
  const [mov, setMov] = useState({ ...movimentoVazio });
  const [filtroDeposito, setFiltroDeposito] = useState<string>("todos");

  const { data: depositos = [] } = useQuery({
    queryKey: [empresaId, "depositos"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depositos")
        .select("id, nome, obra_id, padrao, ativo, obras(codigo_chamado)")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: obras = [] } = useQuery({
    queryKey: [empresaId, "obras-min-estoque"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, codigo_chamado, descricao_servico")
        .eq("arquivada", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: etapas = [] } = useQuery({
    queryKey: [empresaId, "etapas-estoque", mov.obra_id],
    enabled: !!empresaId && !!mov.obra_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_etapas")
        .select("id, nome")
        .eq("obra_id", mov.obra_id)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: saldos = [] } = useQuery({
    queryKey: [empresaId, "estoque-saldos", filtroDeposito],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_estoque_saldos", {
        _deposito_id: filtroDeposito === "todos" ? null : filtroDeposito,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: [empresaId, "estoque-movimentos", filtroDeposito],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("estoque_movimentos")
        .select("id, data, material, unidade, quantidade, sentido, tipo, origem, custo_unitario, valor_total, deposito_id, obra_id, depositos(nome), obras(codigo_chamado)")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (filtroDeposito !== "todos") q = q.eq("deposito_id", filtroDeposito);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalEstoque = useMemo(
    () => (saldos as any[]).reduce((s, l) => s + Number(l.valor_saldo ?? 0), 0),
    [saldos],
  );

  const criarDeposito = useMutation({
    mutationFn: async () => {
      if (!depForm.nome.trim()) throw new Error("Informe o nome do depósito");
      const { error } = await supabase.from("depositos").insert([
        {
          nome: depForm.nome.trim(),
          obra_id: depForm.obra_id || null,
          observacoes: depForm.observacoes || null,
          padrao: depositos.length === 0,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Depósito criado");
      setNovoDeposito(false);
      setDepForm({ nome: "", obra_id: "", observacoes: "" });
      qc.invalidateQueries({ queryKey: [empresaId, "depositos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registrar = useMutation({
    mutationFn: async () => {
      if (!mov.deposito_id) throw new Error("Escolha o depósito");
      if (!mov.material.trim()) throw new Error("Informe o material");
      const { error } = await supabase.rpc("registrar_movimento_estoque", {
        _tipo: mov.tipo,
        _deposito_id: mov.deposito_id,
        _material: mov.material.trim(),
        _unidade: mov.unidade || "un",
        _quantidade: Number(mov.quantidade) || 0,
        _custo_unitario: mov.custo_unitario === "" ? null : Number(mov.custo_unitario),
        _deposito_destino_id: mov.tipo === "transferencia" ? mov.deposito_destino_id || null : null,
        _obra_id: mov.tipo === "saida" ? mov.obra_id || null : null,
        _etapa_id: mov.tipo === "saida" ? mov.etapa_id || null : null,
        _data: mov.data,
        _responsavel_id: mov.responsavel_id || null,
        _observacoes: mov.observacoes || null,
        _sentido: mov.tipo === "ajuste" ? mov.sentido : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimento registrado");
      setMovAberto(false);
      setMov({ ...movimentoVazio });
      qc.invalidateQueries({ queryKey: [empresaId, "estoque-saldos"] });
      qc.invalidateQueries({ queryKey: [empresaId, "estoque-movimentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirMovimento = (tipo: Tipo) => {
    setMov({ ...movimentoVazio, tipo, deposito_id: depositos[0]?.id ?? "" });
    setMovAberto(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">
            Depósitos, entradas, saídas para a {rotulos.obra_singular.toLowerCase()} e saldo com custo médio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => abrirMovimento("entrada")}>
            <Plus className="mr-2 h-4 w-4" /> Entrada
          </Button>
          <Button variant="outline" onClick={() => abrirMovimento("saida")}>
            <Package className="mr-2 h-4 w-4" /> Saída para a {rotulos.obra_singular.toLowerCase()}
          </Button>
          <Button variant="outline" onClick={() => abrirMovimento("transferencia")}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Transferência
          </Button>
          <Button variant="outline" onClick={() => abrirMovimento("ajuste")}>
            Ajuste
          </Button>
        </div>
      </header>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Quando o custo do material entra na {rotulos.obra_singular.toLowerCase()}</AlertTitle>
        <AlertDescription className="text-sm">
          {config.usa_estoque ? (
            <>
              Sua empresa usa estoque. Ao receber uma ordem de compra, o material <strong>entra no depósito</strong> e
              ainda não vira custo da {rotulos.obra_singular.toLowerCase()}. O custo só é lançado quando o material{" "}
              <strong>sai do depósito para a {rotulos.obra_singular.toLowerCase()}</strong>, pelo custo médio do depósito. Isso
              muda o resultado: material comprado e ainda parado no depósito não aparece como custo no DRE da{" "}
              {rotulos.obra_singular.toLowerCase()} — ele é um bem em estoque.
            </>
          ) : (
            <>
              Sua empresa <strong>não usa estoque</strong>: o custo do material entra na {rotulos.obra_singular.toLowerCase()} no
              recebimento da compra. Se ligar o estoque em Configurações, o custo passa a entrar na saída do depósito
              para a {rotulos.obra_singular.toLowerCase()}, e o material parado no depósito deixa de aparecer como custo no DRE.
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Label>Depósito</Label>
          <Select value={filtroDeposito} onValueChange={setFiltroDeposito}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os depósitos</SelectItem>
              {depositos.map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="flex-1 min-w-[200px]">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Valor em estoque (custo médio)</span>
            <span className="text-lg font-semibold">{formatCurrency(totalEstoque)}</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="saldos">
        <TabsList>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentação</TabsTrigger>
          <TabsTrigger value="depositos">Depósitos</TabsTrigger>
        </TabsList>

        <TabsContent value="saldos" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Depósito</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Custo médio</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(saldos as any[]).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        Nenhum material em estoque ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {(saldos as any[]).map((l, i) => (
                    <TableRow key={`${l.deposito_id}-${l.material}-${i}`}>
                      <TableCell>{l.deposito_nome}</TableCell>
                      <TableCell className="font-medium">{l.material}</TableCell>
                      <TableCell className="text-right">{Number(l.entradas).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">{Number(l.saidas).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(l.saldo).toLocaleString("pt-BR")} {l.unidade}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(l.custo_medio))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(l.valor_saldo))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimentos" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Depósito</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>{rotulos.obra_singular}</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movimentos as any[]).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Nenhuma movimentação registrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {(movimentos as any[]).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDateBR(m.data)}</TableCell>
                      <TableCell>{m.depositos?.nome ?? "—"}</TableCell>
                      <TableCell className="font-medium">{m.material}</TableCell>
                      <TableCell>
                        <Badge variant={m.sentido === "entrada" ? "secondary" : "outline"}>
                          {TIPO_LABEL[m.tipo] ?? m.tipo} · {m.sentido === "entrada" ? "entra" : "sai"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ORIGEM_LABEL[m.origem] ?? m.origem}</TableCell>
                      <TableCell>{m.obras?.codigo_chamado ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {m.sentido === "saida" ? "-" : "+"}
                        {Number(m.quantidade).toLocaleString("pt-BR")} {m.unidade}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(m.valor_total))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depositos" className="mt-4 space-y-3">
          <Button onClick={() => setNovoDeposito(true)}>
            <Warehouse className="mr-2 h-4 w-4" /> Novo depósito
          </Button>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>{rotulos.obra_singular}</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depositos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        Nenhum depósito cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {depositos.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        {d.nome} {d.padrao && <Badge variant="secondary" className="ml-2">Padrão</Badge>}
                      </TableCell>
                      <TableCell>{d.obras?.codigo_chamado ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={d.ativo ? "default" : "outline"}>{d.ativo ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* novo depósito */}
      <Dialog open={novoDeposito} onOpenChange={setNovoDeposito}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo depósito</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={depForm.nome} onChange={(e) => setDepForm({ ...depForm, nome: e.target.value })} />
            </div>
            <div>
              <Label>{rotulos.obra_singular} (opcional)</Label>
              <Select
                value={depForm.obra_id || "nenhuma"}
                onValueChange={(v) => setDepForm({ ...depForm, obra_id: v === "nenhuma" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Depósito central" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Depósito central</SelectItem>
                  {obras.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.codigo_chamado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={depForm.observacoes}
                onChange={(e) => setDepForm({ ...depForm, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoDeposito(false)}>Cancelar</Button>
            <Button onClick={() => criarDeposito.mutate()} disabled={criarDeposito.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* movimento */}
      <Dialog open={movAberto} onOpenChange={setMovAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{TIPO_LABEL[mov.tipo]} de material</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Depósito {mov.tipo === "transferencia" ? "de origem" : ""}</Label>
              <Select value={mov.deposito_id} onValueChange={(v) => setMov({ ...mov, deposito_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {depositos.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mov.tipo === "transferencia" && (
              <div>
                <Label>Depósito de destino</Label>
                <Select
                  value={mov.deposito_destino_id}
                  onValueChange={(v) => setMov({ ...mov, deposito_destino_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {depositos.filter((d: any) => d.id !== mov.deposito_id).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mov.tipo === "ajuste" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Ajuste de entrada</p>
                  <p className="text-xs text-muted-foreground">Desligue para registrar um ajuste de baixa.</p>
                </div>
                <Switch
                  checked={mov.sentido === "entrada"}
                  onCheckedChange={(c) => setMov({ ...mov, sentido: c ? "entrada" : "saida" })}
                />
              </div>
            )}

            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3">
                <Label>Material</Label>
                <Input value={mov.material} onChange={(e) => setMov({ ...mov, material: e.target.value })} />
              </div>
              <div>
                <Label>Un.</Label>
                <Input value={mov.unidade} onChange={(e) => setMov({ ...mov, unidade: e.target.value })} />
              </div>
              <div>
                <Label>Qtd.</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={mov.quantidade}
                  onChange={(e) => setMov({ ...mov, quantidade: e.target.value })}
                />
              </div>
              <div>
                <Label>Custo un.</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="médio"
                  value={mov.custo_unitario}
                  onChange={(e) => setMov({ ...mov, custo_unitario: e.target.value })}
                />
              </div>
            </div>

            {mov.tipo === "saida" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{rotulos.obra_singular} que recebe</Label>
                  <Select
                    value={mov.obra_id}
                    onValueChange={(v) => setMov({ ...mov, obra_id: v, etapa_id: "" })}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent>
                      {obras.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>{o.codigo_chamado}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Etapa (opcional)</Label>
                  <Select
                    value={mov.etapa_id || "nenhuma"}
                    onValueChange={(v) => setMov({ ...mov, etapa_id: v === "nenhuma" ? "" : v })}
                    disabled={!mov.obra_id}
                  >
                    <SelectTrigger><SelectValue placeholder="Sem etapa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Sem etapa</SelectItem>
                      {(etapas as any[]).map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Data</Label>
                <Input type="date" value={mov.data} onChange={(e) => setMov({ ...mov, data: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={mov.observacoes}
                onChange={(e) => setMov({ ...mov, observacoes: e.target.value })}
              />
            </div>

            {mov.tipo === "saida" && mov.obra_id && (
              <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Esta saída lança o custo do material na {rotulos.obra_singular.toLowerCase()} pelo custo médio do depósito. É
                aqui que o material vira custo no DRE — não na compra.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovAberto(false)}>Cancelar</Button>
            <Button onClick={() => registrar.mutate()} disabled={registrar.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
