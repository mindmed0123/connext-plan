import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { formatDateBR } from "@/lib/date";

function gerarToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function PortalTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [validadeDias, setValidadeDias] = useState("90");
  const [docNome, setDocNome] = useState("");
  const [enviandoDoc, setEnviandoDoc] = useState(false);

  const { data: tokens = [] } = useQuery({
    queryKey: [empresaId, "portal-tokens", obraId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_portal_tokens")
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: acessos = [] } = useQuery({
    queryKey: [empresaId, "portal-acessos", obraId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_portal_acessos")
        .select("id, acessado_em, ip")
        .eq("obra_id", obraId)
        .order("acessado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: [empresaId, "obra-documentos", obraId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_documentos")
        .select("*")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      const dias = Number(validadeDias);
      const expira = dias > 0 ? new Date(Date.now() + dias * 86400000).toISOString() : null;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("obra_portal_tokens").insert([
        {
          empresa_id: empresaId!,
          obra_id: obraId,
          token: gerarToken(),
          expira_em: expira,
          criado_por: u.user?.id ?? null,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link do cliente criado");
      qc.invalidateQueries({ queryKey: [empresaId, "portal-tokens", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revogar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_portal_tokens").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link revogado");
      qc.invalidateQueries({ queryKey: [empresaId, "portal-tokens", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarDoc = useMutation({
    mutationFn: async ({ id, visivel }: { id: string; visivel: boolean }) => {
      const { error } = await supabase.from("obra_documentos").update({ visivel_cliente: visivel }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [empresaId, "obra-documentos", obraId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const excluirDoc = useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string | null }) => {
      if (path) await supabase.storage.from("obra-documentos").remove([path]);
      const { error } = await supabase.from("obra_documentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: [empresaId, "obra-documentos", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enviarDoc = async (file: File) => {
    setEnviandoDoc(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${empresaId}/${obraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("obra-documentos").upload(path, file);
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("obra_documentos").insert([
        {
          empresa_id: empresaId!,
          obra_id: obraId,
          nome: docNome || file.name,
          arquivo_path: path,
          arquivo_nome: file.name,
          created_by: u.user?.id ?? null,
        },
      ]);
      if (error) throw error;
      setDocNome("");
      toast.success("Documento enviado");
      qc.invalidateQueries({ queryKey: [empresaId, "obra-documentos", obraId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setEnviandoDoc(false);
    }
  };

  const copiar = (token: string) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Link do cliente</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O cliente acompanha a obra sem login e vê apenas andamento, fotos e documentos liberados e
            medições aprovadas. Valores de custo, fornecedores e margem nunca aparecem.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Validade (dias, 0 = sem prazo)</Label>
              <Input
                type="number"
                min={0}
                value={validadeDias}
                onChange={(e) => setValidadeDias(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}
              Gerar link do cliente
            </Button>
          </div>

          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                <Badge variant={t.ativo ? "default" : "secondary"}>{t.ativo ? "Ativo" : "Revogado"}</Badge>
                <code className="truncate text-xs text-muted-foreground">/portal/{t.token.slice(0, 12)}…</code>
                <span className="text-xs text-muted-foreground">
                  {t.expira_em ? `vence em ${formatDateBR(t.expira_em)}` : "sem prazo"}
                  {t.ultimo_acesso ? ` • último acesso ${formatDateBR(t.ultimo_acesso)}` : " • nunca acessado"}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copiar(t.token)}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
                  </Button>
                  {t.ativo && (
                    <Button size="sm" variant="ghost" onClick={() => revogar.mutate(t.id)}>Revogar</Button>
                  )}
                </div>
              </div>
            ))}
            {tokens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link criado ainda.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documentos da obra</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome (opcional)</Label>
              <Input value={docNome} onChange={(e) => setDocNome(e.target.value)} className="w-[260px]" placeholder="Ex.: ART assinada" />
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium">
              {enviandoDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar documento
              <input
                type="file"
                className="hidden"
                disabled={enviandoDoc}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviarDoc(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <div className="space-y-2">
            {documentos.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
                <span className="font-medium">{d.nome}</span>
                <span className="text-xs text-muted-foreground">{formatDateBR(d.created_at)}</span>
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={d.visivel_cliente}
                      onCheckedChange={(v) => alternarDoc.mutate({ id: d.id, visivel: v })}
                    />
                    <span className="text-xs">Visível para o cliente</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => excluirDoc.mutate({ id: d.id, path: d.arquivo_path })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {documentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Acessos do cliente</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {acessos.map((a) => (
            <div key={a.id} className="flex justify-between border-b py-1 last:border-0">
              <span>{new Date(a.acessado_em).toLocaleString("pt-BR")}</span>
              <span className="text-xs text-muted-foreground">{a.ip ?? ""}</span>
            </div>
          ))}
          {acessos.length === 0 && <p className="text-muted-foreground">O link ainda não foi aberto.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
