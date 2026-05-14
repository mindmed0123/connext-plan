import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Save, Upload, Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { toast } from "sonner";

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export default function Configuracoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();

  const { data: empresa, isLoading } = useQuery({
    queryKey: ["empresa-config", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("id", empresaId!).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    nome: "", cnpj: "", inscricao_estadual: "", endereco: "",
    bairro: "", cidade: "", uf: "", cep: "", telefone: "", email: "",
  });
  const [buscando, setBuscando] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoUrl = (empresa as any)?.logo_url as string | null | undefined;

  const handleLogoUpload = async (file: File) => {
    if (!empresaId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (PNG, JPG, etc.)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo muito grande (máx. 2MB)");
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${empresaId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("empresa-logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("empresa-logos").getPublicUrl(path);
      const { error: updErr } = await supabase.from("empresas").update({ logo_url: pub.publicUrl }).eq("id", empresaId);
      if (updErr) throw updErr;
      toast.success("Logo atualizada!");
      qc.invalidateQueries({ queryKey: ["empresa-config", empresaId] });
    } catch (e) {
      toast.error((e as Error).message || "Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removerLogo = async () => {
    if (!empresaId) return;
    const { error } = await supabase.from("empresas").update({ logo_url: null }).eq("id", empresaId);
    if (error) { toast.error(error.message); return; }
    toast.success("Logo removida");
    qc.invalidateQueries({ queryKey: ["empresa-config", empresaId] });
  };

  useEffect(() => {
    if (!empresa) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = empresa as any;
    setForm({
      nome: e.nome ?? "",
      cnpj: e.cnpj ?? "",
      inscricao_estadual: e.inscricao_estadual ?? "",
      endereco: e.endereco ?? "",
      bairro: e.bairro ?? "",
      cidade: e.cidade ?? "",
      uf: e.uf ?? "",
      cep: e.cep ?? "",
      telefone: e.telefone ?? "",
      email: e.email ?? "",
    });
  }, [empresa]);

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const buscarCnpj = async () => {
    const cnpj = form.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos)");
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const d = await res.json();
      setForm((f) => ({
        ...f,
        nome: d.razao_social || d.nome_fantasia || f.nome,
        endereco: [d.logradouro, d.numero && `, ${d.numero}`, d.complemento && ` - ${d.complemento}`].filter(Boolean).join(""),
        bairro: d.bairro || f.bairro,
        cidade: d.municipio || f.cidade,
        uf: d.uf || f.uf,
        cep: d.cep ? d.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : f.cep,
        telefone: d.ddd_telefone_1 ? `(${d.ddd_telefone_1.slice(0, 2)}) ${d.ddd_telefone_1.slice(2)}` : f.telefone,
        email: d.email || f.email,
      }));
      toast.success("Dados carregados!");
    } catch (e) {
      toast.error((e as Error).message || "Erro ao buscar CNPJ");
    } finally {
      setBuscando(false);
    }
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não identificada");
      const { error } = await supabase.from("empresas").update(form).eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas!");
      qc.invalidateQueries({ queryKey: ["empresa-config", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configurações da empresa</h1>
        <p className="text-sm text-muted-foreground">
          Esses dados aparecem no cabeçalho dos PDFs de orçamento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo da empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground text-center px-2">Sem logo</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                A logo aparece no canto superior esquerdo dos PDFs de orçamento. PNG/JPG, até 2MB.
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={uploadingLogo}>
                  <label className="cursor-pointer">
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
                    />
                  </label>
                </Button>
                {logoUrl && (
                  <Button variant="ghost" size="sm" onClick={removerLogo}>
                    <Trash2 className="h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-primary/5 p-3">
            <Label className="text-xs">Buscar pelo CNPJ</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={form.cnpj}
                onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarCnpj(); } }}
              />
              <Button type="button" onClick={buscarCnpj} disabled={buscando}>
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Digite o CNPJ e clique em buscar — preenchemos os campos automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Razão social</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input value={form.inscricao_estadual} onChange={(e) => set("inscricao_estadual", e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              <Save className="h-4 w-4" /> Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
