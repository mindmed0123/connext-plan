import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, getTodayDateInputValue } from "@/lib/date";
import { DOCUMENTO_TIPOS } from "@/lib/pessoas-helpers";

const BUCKET = "pessoas-documentos";

type Doc = {
  id: string;
  tipo: string;
  nome: string;
  numero: string | null;
  descricao: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
};

const emptyForm = {
  tipo: "ASO",
  nome: "",
  numero: "",
  descricao: "",
  data_emissao: getTodayDateInputValue(),
  data_validade: "",
};

function validadeBadge(validade: string | null) {
  if (!validade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = validade.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12);
  const dias = Math.round((dt.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (dias <= 30) return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Vence em {dias}d</Badge>;
  return <Badge variant="secondary">Válido</Badge>;
}

export function PessoaDocumentosTab({ pessoaId }: { pessoaId: string }) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["pessoa-documentos", pessoaId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("pessoa_documentos" as any) as any)
        .select("*")
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      let arquivo_path: string | null = null;
      let arquivo_nome: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${empresaId}/${pessoaId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
        if (upErr) throw upErr;
        arquivo_path = path;
        arquivo_nome = file.name;
      }
      const { error } = await (supabase.from("pessoa_documentos" as any) as any).insert([{
        pessoa_id: pessoaId,
        tipo: form.tipo,
        nome: form.nome.trim() || form.tipo,
        numero: form.numero || null,
        descricao: form.descricao || null,
        data_emissao: form.data_emissao || null,
        data_validade: form.data_validade || null,
        arquivo_path,
        arquivo_nome,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento adicionado");
      setOpen(false);
      setForm(emptyForm);
      setFile(null);
      qc.invalidateQueries({ queryKey: ["pessoa-documentos", pessoaId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (doc: Doc) => {
      if (doc.arquivo_path) await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
      const { error } = await (supabase.from("pessoa_documentos" as any) as any).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["pessoa-documentos", pessoaId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const baixar = async (doc: Doc) => {
    if (!doc.arquivo_path) return toast.error("Este documento não tem arquivo anexado");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.arquivo_path, 120);
    if (error || !data) return toast.error("Não foi possível abrir o arquivo");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Documentos do funcionário</h3>
          <p className="text-xs text-muted-foreground">NRs, ASO, ficha de registro, contratos e demais anexos</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Adicionar documento</Button>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && docs.length === 0 && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum documento enviado ainda.
          </div>
        )}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border bg-card p-3">
            <div className="flex items-start gap-3 min-w-0">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {d.tipo}
                  {d.numero ? ` • nº ${d.numero}` : ""}
                  {d.data_emissao ? ` • emitido ${formatDateBR(d.data_emissao)}` : ""}
                  {d.data_validade ? ` • validade ${formatDateBR(d.data_validade)}` : ""}
                </p>
                {d.descricao && <p className="text-xs text-muted-foreground">{d.descricao}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {validadeBadge(d.data_validade)}
              {d.arquivo_path && (
                <Button variant="ghost" size="icon" onClick={() => baixar(d)} title="Baixar">
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => confirm("Excluir documento?") && del.mutate(d)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENTO_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número / identificação</Label>
              <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Nome do documento</Label>
              <Input
                value={form.nome}
                placeholder="Ex: ASO admissional 2026"
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data de emissão</Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Validade</Label>
              <Input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Arquivo</Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> {file ? file.name : "Selecionar arquivo"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
