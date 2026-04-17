import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/obra-helpers";
import { Pencil, Paperclip, Upload, ExternalLink, Trash2, X } from "lucide-react";

const STATUS = ["em_elaboracao", "enviado", "em_negociacao", "aprovado", "reprovado"] as const;
type Status = typeof STATUS[number];
const LABEL: Record<Status, string> = {
  em_elaboracao: "Em elaboração",
  enviado: "Enviado",
  em_negociacao: "Em negociação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

const ACCEPT = ".pdf,image/*";

type FormState = {
  numero_orcamento: string;
  valor_orcamento: string;
  data_envio: string;
  engenheiro_aprovador: string;
  status: Status;
  descricao: string;
};

const emptyForm = (): FormState => ({
  numero_orcamento: "",
  valor_orcamento: "",
  data_envio: new Date().toISOString().slice(0, 10),
  engenheiro_aprovador: "",
  status: "enviado",
  descricao: "",
});

async function uploadAnexo(obraId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${obraId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("orcamentos-anexos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("orcamentos-anexos").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export function OrcamentoTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editRemoveAnexo, setEditRemoveAnexo] = useState(false);

  const { data } = useQuery({
    queryKey: ["orcamentos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      let arquivo_url: string | null = null;
      let arquivo_path: string | null = null;
      if (file) {
        const up = await uploadAnexo(obraId, file);
        arquivo_url = up.url;
        arquivo_path = up.path;
      }
      const { error } = await supabase.from("orcamentos").insert([{
        obra_id: obraId,
        numero_orcamento: form.numero_orcamento || null,
        valor_orcamento: parseFloat(form.valor_orcamento) || 0,
        data_envio: form.data_envio || null,
        engenheiro_aprovador: form.engenheiro_aprovador || null,
        status: form.status,
        descricao: form.descricao || null,
        arquivo_url,
        arquivo_path,
        last_updated_by: u.user?.id ?? null,
        last_updated_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId,
        user_id: u.user?.id,
        evento: "Orçamento registrado",
        detalhes: `${LABEL[form.status]} • ${formatCurrency(form.valor_orcamento)}${arquivo_url ? " • anexo" : ""}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Orçamento registrado");
      qc.invalidateQueries({ queryKey: ["orcamentos", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setForm(emptyForm());
      setFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const current = data?.find((o) => o.id === editingId);
      const { data: u } = await supabase.auth.getUser();
      let arquivo_url: string | null | undefined = undefined;
      let arquivo_path: string | null | undefined = undefined;

      if (editFile) {
        if (current?.arquivo_path) {
          await supabase.storage.from("orcamentos-anexos").remove([current.arquivo_path]);
        }
        const up = await uploadAnexo(obraId, editFile);
        arquivo_url = up.url;
        arquivo_path = up.path;
      } else if (editRemoveAnexo && current?.arquivo_path) {
        await supabase.storage.from("orcamentos-anexos").remove([current.arquivo_path]);
        arquivo_url = null;
        arquivo_path = null;
      }

      const patch: Record<string, any> = {
        numero_orcamento: editForm.numero_orcamento || null,
        valor_orcamento: parseFloat(editForm.valor_orcamento) || 0,
        data_envio: editForm.data_envio || null,
        engenheiro_aprovador: editForm.engenheiro_aprovador || null,
        status: editForm.status,
        descricao: editForm.descricao || null,
        last_updated_by: u.user?.id ?? null,
        last_updated_at: new Date().toISOString(),
      };
      if (arquivo_url !== undefined) patch.arquivo_url = arquivo_url;
      if (arquivo_path !== undefined) patch.arquivo_path = arquivo_path;

      const { error } = await supabase.from("orcamentos").update(patch).eq("id", editingId);
      if (error) throw error;

      await supabase.from("obra_timeline").insert([{
        obra_id: obraId,
        user_id: u.user?.id,
        evento: "Orçamento atualizado",
        detalhes: `${LABEL[editForm.status]} • ${formatCurrency(editForm.valor_orcamento)}`,
      }]);
    },
    onSuccess: () => {
      toast.success("Orçamento atualizado");
      qc.invalidateQueries({ queryKey: ["orcamentos", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setEditingId(null);
      setEditFile(null);
      setEditRemoveAnexo(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startEdit = (o: any) => {
    setEditingId(o.id);
    setEditForm({
      numero_orcamento: o.numero_orcamento ?? "",
      valor_orcamento: String(o.valor_orcamento ?? ""),
      data_envio: o.data_envio ?? new Date().toISOString().slice(0, 10),
      engenheiro_aprovador: o.engenheiro_aprovador ?? "",
      status: o.status,
      descricao: o.descricao ?? "",
    });
    setEditFile(null);
    setEditRemoveAnexo(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Novo orçamento</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nº orçamento (Omie)</Label>
            <Input value={form.numero_orcamento} onChange={(e) => setForm({ ...form, numero_orcamento: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor (R$)</Label>
            <Input type="number" step="0.01" value={form.valor_orcamento} onChange={(e) => setForm({ ...form, valor_orcamento: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data de envio</Label>
            <Input type="date" value={form.data_envio} onChange={(e) => setForm({ ...form, data_envio: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v: Status) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Engenheiro aprovador</Label>
            <Input value={form.engenheiro_aprovador} onChange={(e) => setForm({ ...form, engenheiro_aprovador: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Descrição / observações</Label>
            <Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Anexar orçamento Omie (PDF ou imagem)</Label>
            <div className="flex items-center gap-2">
              <Input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} title="Remover">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
          </div>
        </div>
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Salvando..." : "Registrar orçamento"}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Orçamentos</h3>
        {(data?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Nenhum orçamento</p>}
        {data?.map((o: any) => {
          const isEditing = editingId === o.id;
          return (
            <div key={o.id} className="rounded-md border bg-card p-3 text-sm">
              {!isEditing ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {o.numero_orcamento || "Sem nº"} • {formatCurrency(o.valor_orcamento)}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {LABEL[o.status as Status]}
                        {o.data_envio && ` • Enviado ${format(new Date(o.data_envio), "dd/MM/yyyy")}`}
                        {o.engenheiro_aprovador && ` • Aprovador: ${o.engenheiro_aprovador}`}
                      </p>
                      {o.descricao && <p className="mt-1 text-xs">{o.descricao}</p>}
                      {o.last_updated_at && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Última atualização: {format(new Date(o.last_updated_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {o.arquivo_url && (
                        <a
                          href={o.arquivo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-accent"
                        >
                          <Paperclip className="h-3.5 w-3.5" /> Anexo <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => startEdit(o)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nº orçamento</Label>
                      <Input value={editForm.numero_orcamento} onChange={(e) => setEditForm({ ...editForm, numero_orcamento: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input type="number" step="0.01" value={editForm.valor_orcamento} onChange={(e) => setEditForm({ ...editForm, valor_orcamento: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data de envio</Label>
                      <Input type="date" value={editForm.data_envio} onChange={(e) => setEditForm({ ...editForm, data_envio: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={editForm.status} onValueChange={(v: Status) => setEditForm({ ...editForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS.map((s) => <SelectItem key={s} value={s}>{LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Engenheiro aprovador</Label>
                      <Input value={editForm.engenheiro_aprovador} onChange={(e) => setEditForm({ ...editForm, engenheiro_aprovador: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Descrição / observações</Label>
                      <Textarea rows={2} value={editForm.descricao} onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Anexo (PDF/imagem)</Label>
                      {o.arquivo_url && !editFile && !editRemoveAnexo && (
                        <div className="flex items-center gap-2 text-xs">
                          <a href={o.arquivo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                            <Paperclip className="h-3.5 w-3.5" /> Ver anexo atual
                          </a>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditRemoveAnexo(true)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover
                          </Button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input type="file" accept={ACCEPT} onChange={(e) => { setEditFile(e.target.files?.[0] ?? null); setEditRemoveAnexo(false); }} />
                        {editFile && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => setEditFile(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {editFile && <p className="text-xs text-muted-foreground truncate"><Upload className="inline h-3 w-3" /> {editFile.name}</p>}
                      {editRemoveAnexo && <p className="text-xs text-destructive">Anexo será removido ao salvar</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => update.mutate()} disabled={update.isPending}>
                      {update.isPending ? "Salvando..." : "Salvar alterações"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
