import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Download, FileText, Plus, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/obra-helpers";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { TIPO_INSTITUICAO_LABEL, TIPO_INSTITUICAO_LIST } from "@/lib/comprador-helpers";

const BUCKET = "compradores-contratos";

const emptyContrato = {
  numero_contrato: "",
  objeto: "",
  valor: "",
  data_inicio: getTodayDateInputValue(),
  data_fim: "",
  status: "ativo",
  observacoes: "",
};

export default function CompradorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<any>(null);
  const [contratoOpen, setContratoOpen] = useState(false);
  const [contratoForm, setContratoForm] = useState(emptyContrato);
  const [file, setFile] = useState<File | null>(null);

  const { data: comprador } = useQuery({
    queryKey: ["comprador", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("compradores" as any) as any).select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (comprador && !form) setForm(comprador);
  }, [comprador, form]);

  const { data: contratos = [] } = useQuery({
    queryKey: ["comprador-contratos", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("comprador_contratos" as any) as any)
        .select("*").eq("comprador_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: historico } = useQuery({
    queryKey: ["comprador-historico", id],
    enabled: !!id,
    queryFn: async () => {
      const [pcs, mats, cards] = await Promise.all([
        (supabase.from("pedidos_compra") as any).select("id, numero_pedido, valor, created_at, obras(codigo_chamado)").eq("comprador_id", id!).order("created_at", { ascending: false }),
        (supabase.from("materiais_obra") as any).select("id, descricao, valor_total, data_compra, obras(codigo_chamado)").eq("comprador_id", id!).order("data_compra", { ascending: false }),
        (supabase.from("cartao_despesas" as any) as any).select("id, descricao, valor, data_compra, obras(codigo_chamado), cartoes_credito(apelido)").eq("comprador_id", id!).order("data_compra", { ascending: false }),
      ]);
      return { pcs: pcs.data ?? [], mats: mats.data ?? [], cards: cards.data ?? [] };
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome?.trim(),
        tipo_instituicao: form.tipo_instituicao ?? "outro",
        razao_social: form.razao_social || null,
        cpf_cnpj: form.cpf_cnpj || null,
        inscricao_estadual: form.inscricao_estadual || null,
        site: form.site || null,
        email: form.email || null,
        telefone: form.telefone || null,
        cargo: form.cargo || null,
        responsavel_nome: form.responsavel_nome || null,
        responsavel_email: form.responsavel_email || null,
        responsavel_telefone: form.responsavel_telefone || null,
        endereco: form.endereco || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        cep: form.cep || null,
        condicoes_comerciais: form.condicoes_comerciais || null,
        observacoes: form.observacoes || null,
        ativo: form.ativo ?? true,
      };
      const { error } = await (supabase.from("compradores" as any) as any).update(payload).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comprador atualizado");
      qc.invalidateQueries({ queryKey: ["comprador", id] });
      qc.invalidateQueries({ queryKey: ["compradores-full"] });
      qc.invalidateQueries({ queryKey: ["compradores"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarContrato = useMutation({
    mutationFn: async () => {
      let arquivo_path: string | null = null;
      let arquivo_nome: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${empresaId}/${id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        arquivo_path = path;
        arquivo_nome = file.name;
      }
      const { error } = await (supabase.from("comprador_contratos" as any) as any).insert([{
        comprador_id: id,
        numero_contrato: contratoForm.numero_contrato || null,
        objeto: contratoForm.objeto.trim(),
        valor: Number(contratoForm.valor || 0),
        data_inicio: contratoForm.data_inicio || null,
        data_fim: contratoForm.data_fim || null,
        status: contratoForm.status,
        observacoes: contratoForm.observacoes || null,
        arquivo_path,
        arquivo_nome,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato adicionado");
      setContratoOpen(false);
      setContratoForm(emptyContrato);
      setFile(null);
      qc.invalidateQueries({ queryKey: ["comprador-contratos", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delContrato = useMutation({
    mutationFn: async (c: any) => {
      if (c.arquivo_path) await supabase.storage.from(BUCKET).remove([c.arquivo_path]);
      const { error } = await (supabase.from("comprador_contratos" as any) as any).delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comprador-contratos", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const baixar = async (c: any) => {
    if (!c.arquivo_path) return toast.error("Sem arquivo anexado");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(c.arquivo_path, 120);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  };

  if (!form) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const totalContratos = contratos.reduce((s, c: any) => s + Number(c.valor || 0), 0);
  const totalHistorico = (historico?.pcs ?? []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0)
    + (historico?.mats ?? []).reduce((s: number, m: any) => s + Number(m.valor_total || 0), 0)
    + (historico?.cards ?? []).reduce((s: number, c: any) => s + Number(c.valor || 0), 0);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/compradores")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{form.nome}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">{TIPO_INSTITUICAO_LABEL[form.tipo_instituicao] ?? "Outro"}</Badge>
              <span className="text-xs text-muted-foreground">{form.cpf_cnpj || "sem CPF/CNPJ"}</span>
            </div>
          </div>
        </div>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          <Save className="mr-2 h-4 w-4" /> {salvar.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contratos.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro" className="mt-4 space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Identificação</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Nome / Nome fantasia *</Label>
                <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Tipo de instituição</Label>
                <Select value={form.tipo_instituicao ?? "outro"} onValueChange={(v) => set("tipo_instituicao", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_INSTITUICAO_LIST.map((t) => <SelectItem key={t} value={t}>{TIPO_INSTITUICAO_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Razão social</Label>
                <Input value={form.razao_social ?? ""} onChange={(e) => set("razao_social", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">CPF / CNPJ</Label>
                <Input value={form.cpf_cnpj ?? ""} onChange={(e) => set("cpf_cnpj", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Inscrição estadual</Label>
                <Input value={form.inscricao_estadual ?? ""} onChange={(e) => set("inscricao_estadual", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Site</Label>
                <Input value={form.site ?? ""} onChange={(e) => set("site", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                <Select value={form.ativo === false ? "inativo" : "ativo"} onValueChange={(v) => set("ativo", v === "ativo")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Contato</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="space-y-1.5"><Label className="text-xs">E-mail</Label>
                <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Telefone</Label>
                <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Cargo / setor</Label>
                <Input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Responsável</Label>
                <Input value={form.responsavel_nome ?? ""} onChange={(e) => set("responsavel_nome", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">E-mail do responsável</Label>
                <Input value={form.responsavel_email ?? ""} onChange={(e) => set("responsavel_email", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Telefone do responsável</Label>
                <Input value={form.responsavel_telefone ?? ""} onChange={(e) => set("responsavel_telefone", e.target.value)} /></div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Endereço</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2"><Label className="text-xs">Logradouro</Label>
                <Input value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Bairro</Label>
                <Input value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">CEP</Label>
                <Input value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Cidade</Label>
                <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Estado</Label>
                <Input value={form.estado ?? ""} onChange={(e) => set("estado", e.target.value)} /></div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Comercial</h3>
            <div className="space-y-1.5"><Label className="text-xs">Condições comerciais</Label>
              <Textarea rows={2} value={form.condicoes_comerciais ?? ""} onChange={(e) => set("condicoes_comerciais", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Observações</Label>
              <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></div>
          </section>
        </TabsContent>

        <TabsContent value="contratos" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Contratos com este comprador</p>
              <p className="text-xs text-muted-foreground">Total contratado: {formatCurrency(totalContratos)}</p>
            </div>
            <Button size="sm" onClick={() => setContratoOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo contrato</Button>
          </div>
          {contratos.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum contrato cadastrado.</div>
          )}
          {contratos.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.numero_contrato ? `${c.numero_contrato} — ` : ""}{c.objeto}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(c.valor)}
                    {c.data_inicio ? ` • início ${formatDateBR(c.data_inicio)}` : ""}
                    {c.data_fim ? ` • fim ${formatDateBR(c.data_fim)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge>
                {c.arquivo_path && (
                  <Button variant="ghost" size="icon" onClick={() => baixar(c)}><Download className="h-4 w-4" /></Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => confirm("Excluir contrato?") && delContrato.mutate(c)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Total movimentado</p>
            <p className="text-2xl font-semibold">{formatCurrency(totalHistorico)}</p>
          </div>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Pedidos de compra ({historico?.pcs.length ?? 0})</h3>
            {(historico?.pcs ?? []).map((p: any) => (
              <div key={p.id} className="flex justify-between border-b py-1 text-sm">
                <span>PC {p.numero_pedido} • {p.obras?.codigo_chamado ?? "—"}</span>
                <span className="font-medium">{formatCurrency(p.valor)}</span>
              </div>
            ))}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Materiais ({historico?.mats.length ?? 0})</h3>
            {(historico?.mats ?? []).map((m: any) => (
              <div key={m.id} className="flex justify-between border-b py-1 text-sm">
                <span>{m.descricao} • {m.obras?.codigo_chamado ?? "—"} • {formatDateBR(m.data_compra)}</span>
                <span className="font-medium">{formatCurrency(m.valor_total)}</span>
              </div>
            ))}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Cartão de crédito ({historico?.cards.length ?? 0})</h3>
            {(historico?.cards ?? []).map((c: any) => (
              <div key={c.id} className="flex justify-between border-b py-1 text-sm">
                <span>{c.descricao} • {c.cartoes_credito?.apelido} • {c.obras?.codigo_chamado ?? "—"}</span>
                <span className="font-medium">{formatCurrency(c.valor)}</span>
              </div>
            ))}
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={contratoOpen} onOpenChange={setContratoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Número</Label>
              <Input value={contratoForm.numero_contrato} onChange={(e) => setContratoForm({ ...contratoForm, numero_contrato: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={contratoForm.valor} onChange={(e) => setContratoForm({ ...contratoForm, valor: e.target.value })} /></div>
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Objeto *</Label>
              <Textarea rows={2} value={contratoForm.objeto} onChange={(e) => setContratoForm({ ...contratoForm, objeto: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Início</Label>
              <Input type="date" value={contratoForm.data_inicio} onChange={(e) => setContratoForm({ ...contratoForm, data_inicio: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Fim</Label>
              <Input type="date" value={contratoForm.data_fim} onChange={(e) => setContratoForm({ ...contratoForm, data_fim: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Status</Label>
              <Select value={contratoForm.status} onValueChange={(v) => setContratoForm({ ...contratoForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="em_negociacao">Em negociação</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Arquivo</Label>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> <span className="truncate">{file ? file.name : "Anexar"}</span>
              </Button>
            </div>
            <div className="space-y-1.5 col-span-2"><Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={contratoForm.observacoes} onChange={(e) => setContratoForm({ ...contratoForm, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContratoOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvarContrato.mutate()} disabled={!contratoForm.objeto || salvarContrato.isPending}>
              {salvarContrato.isPending ? "Salvando..." : "Salvar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
