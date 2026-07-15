import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, ImageIcon, Trash2, Loader2, Download, FileText } from "lucide-react";
import JSZip from "jszip";
import { useAuth } from "@/contexts/AuthContext";
import { gerarRelatorioFotograficoPDF } from "@/lib/relatorio-fotografico-pdf";

const TIPO_LABEL = { antes: "Antes", durante: "Durante", depois: "Depois" } as const;
const MAX_FOTOS = 50;

export function FotosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [tipo, setTipo] = useState<"antes" | "durante" | "depois">("durante");
  const [observacao, setObservacao] = useState("");
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  const [fotoParaExcluir, setFotoParaExcluir] = useState<{ id: string; storage_path: string | null } | null>(null);
  const [baixando, setBaixando] = useState<{ feitas: number; total: number } | null>(null);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const { data: fotos } = useQuery({
    queryKey: ["fotos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fotos_obra")
        .select("*")
        .eq("obra_id", obraId)
        .order("data_upload", { ascending: false });
      if (error) throw error;
      const paths = (data ?? []).map((d) => d.storage_path).filter(Boolean) as string[];
      const urlMap = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("obras-fotos")
          .createSignedUrls(paths, 60 * 60);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
        });
      }
      return (data ?? []).map((d) => ({
        ...d,
        imagem_url: (d.storage_path && urlMap.get(d.storage_path)) || d.imagem_url,
      }));
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (files.length > MAX_FOTOS) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos por vez. Você selecionou ${files.length}.`);
      return;
    }

    setProgresso({ feitas: 0, total: files.length });
    const { data: u } = await supabase.auth.getUser();
    const userId = u.user?.id ?? null;

    let sucessos = 0;
    let falhas = 0;

    // Processa em paralelo (lotes de 5 para não sobrecarregar)
    const BATCH = 5;
    for (let i = 0; i < files.length; i += BATCH) {
      const lote = files.slice(i, i + BATCH);
      const resultados = await Promise.allSettled(
        lote.map(async (file) => {
          const ext = file.name.split(".").pop();
          const path = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("obras-fotos")
            .upload(path, file, { upsert: false });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("obras-fotos").getPublicUrl(path);
          const { error: insErr } = await supabase.from("fotos_obra").insert([
            {
              obra_id: obraId,
              tipo,
              imagem_url: pub.publicUrl,
              storage_path: path,
              observacao: observacao || null,
              uploaded_by: userId,
            },
          ]);
          if (insErr) throw insErr;
        }),
      );
      resultados.forEach((r) => {
        if (r.status === "fulfilled") sucessos++;
        else falhas++;
      });
      setProgresso({ feitas: Math.min(i + BATCH, files.length), total: files.length });
    }

    if (sucessos > 0) {
      await supabase.from("obra_timeline").insert([
        {
          obra_id: obraId,
          user_id: userId,
          evento: sucessos === 1 ? "Foto adicionada" : `${sucessos} fotos adicionadas`,
          detalhes: `Tipo: ${TIPO_LABEL[tipo]}`,
        },
      ]);
    }

    setProgresso(null);
    setObservacao("");
    qc.invalidateQueries({ queryKey: ["fotos", obraId] });
    qc.invalidateQueries({ queryKey: ["timeline", obraId] });

    if (falhas === 0) toast.success(`${sucessos} foto(s) enviada(s)`);
    else if (sucessos === 0) toast.error(`Falha ao enviar as ${falhas} foto(s)`);
    else toast.warning(`${sucessos} enviada(s), ${falhas} falharam`);
  };

  const excluir = useMutation({
    mutationFn: async ({ id, storage_path }: { id: string; storage_path: string | null }) => {
      if (storage_path) {
        await supabase.storage.from("obras-fotos").remove([storage_path]);
      }
      const { error } = await supabase.from("fotos_obra").delete().eq("id", id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("obra_timeline").insert([
        { obra_id: obraId, user_id: u.user?.id, evento: "Foto excluída" },
      ]);
    },
    onSuccess: () => {
      toast.success("Foto excluída");
      qc.invalidateQueries({ queryKey: ["fotos", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      setFotoParaExcluir(null);
    },
    onError: (err: any) => {
      toast.error(err.message ?? "Erro ao excluir");
      setFotoParaExcluir(null);
    },
  });

  const enviando = progresso !== null;

  const baixarTodas = async () => {
    if (!fotos || fotos.length === 0) return;
    setBaixando({ feitas: 0, total: fotos.length });
    try {
      const zip = new JSZip();
      const usados = new Set<string>();
      let feitas = 0;

      const BATCH = 5;
      for (let i = 0; i < fotos.length; i += BATCH) {
        const lote = fotos.slice(i, i + BATCH);
        await Promise.all(
          lote.map(async (f) => {
            try {
              const res = await fetch(f.imagem_url);
              if (!res.ok) throw new Error("falha");
              const blob = await res.blob();
              const ext = (f.storage_path?.split(".").pop() || "jpg").toLowerCase();
              const tipoLabel = TIPO_LABEL[f.tipo as keyof typeof TIPO_LABEL] || "Foto";
              let nome = `${tipoLabel}/${tipoLabel}-${String(feitas + 1).padStart(3, "0")}.${ext}`;
              while (usados.has(nome)) {
                nome = `${tipoLabel}/${tipoLabel}-${String(feitas + 1).padStart(3, "0")}-${Math.random().toString(36).slice(2, 5)}.${ext}`;
              }
              usados.add(nome);
              zip.file(nome, blob);
            } catch {
              // ignora foto que falhar
            } finally {
              feitas++;
              setBaixando({ feitas, total: fotos.length });
            }
          }),
        );
      }

      const conteudo = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(conteudo);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fotos-obra-${obraId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${fotos.length} foto(s) baixada(s)`);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao baixar");
    } finally {
      setBaixando(null);
    }
  };

  const gerarRelatorio = async () => {
    if (!fotos || fotos.length === 0) return;
    setGerandoPDF(true);
    try {
      const [obraRes, empresaRes, countRes] = await Promise.all([
        supabase
          .from("obras")
          .select("codigo_chamado, descricao_servico, endereco")
          .eq("id", obraId)
          .single(),
        empresaId
          ? supabase
              .from("empresas")
              .select("nome, logo_url")
              .eq("id", empresaId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        supabase
          .from("obra_timeline")
          .select("id", { count: "exact", head: true })
          .eq("obra_id", obraId)
          .eq("evento", "Relatório fotográfico gerado"),
      ]);
      if (obraRes.error) throw obraRes.error;
      const numeroRelatorio = (countRes.count ?? 0) + 1;

      // Assina URLs frescas (as da query podem estar expirando)
      const paths = fotos
        .map((f) => f.storage_path)
        .filter(Boolean) as string[];
      const urlMap = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("obras-fotos")
          .createSignedUrls(paths, 60 * 60);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
        });
      }

      await gerarRelatorioFotograficoPDF(
        {
          nome: empresaRes.data?.nome ?? "Empresa",
          logo_url: empresaRes.data?.logo_url ?? null,
        },
        {
          codigo_chamado: obraRes.data.codigo_chamado,
          descricao_servico: obraRes.data.descricao_servico ?? null,
          endereco: obraRes.data.endereco ?? null,
        },
        fotos.map((f) => ({
          imagem_url:
            (f.storage_path && urlMap.get(f.storage_path)) || f.imagem_url,
          observacao: f.observacao ?? null,
          tipo: f.tipo,
          data_upload: f.data_upload,
        })),
        { numeroRelatorio, dataRelatorio: new Date() },
      );

      const { data: u } = await supabase.auth.getUser();
      await supabase.from("obra_timeline").insert([
        {
          obra_id: obraId,
          user_id: u.user?.id,
          evento: "Relatório fotográfico gerado",
          detalhes: `Relatório n° ${numeroRelatorio} — ${fotos.length} foto(s)`,
        },
      ]);
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
      toast.success("Relatório gerado");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar relatório");
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Adicionar fotos</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)} disabled={enviando}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="antes">Antes</SelectItem>
                <SelectItem value="durante">Durante</SelectItem>
                <SelectItem value="depois">Depois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (aplicada a todas)</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} disabled={enviando} />
          </div>
        </div>
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-surface-muted px-4 py-6 text-sm text-muted-foreground transition hover:bg-secondary ${enviando ? "pointer-events-none opacity-60" : ""}`}>
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando {progresso?.feitas}/{progresso?.total}...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Selecionar fotos (até {MAX_FOTOS} por vez)
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={enviando}
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Galeria {fotos && fotos.length > 0 && <span className="text-muted-foreground font-normal">({fotos.length})</span>}
          </h3>
          {fotos && fotos.length > 0 && (
            <Button size="sm" variant="outline" onClick={baixarTodas} disabled={!!baixando}>
              {baixando ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Baixando {baixando.feitas}/{baixando.total}
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Baixar tudo
                </>
              )}
            </Button>
          )}
        </div>
        {(fotos?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-8 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <p className="text-xs">Sem fotos ainda</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {fotos?.map((f) => (
            <div key={f.id} className="group relative overflow-hidden rounded-md border">
              <a href={f.imagem_url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={f.imagem_url}
                  alt={f.observacao || ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition group-hover:scale-105"
                />
              </a>
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                {TIPO_LABEL[f.tipo as keyof typeof TIPO_LABEL]}
              </span>
              <Button
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 h-7 w-7 opacity-0 transition group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  setFotoParaExcluir({ id: f.id, storage_path: f.storage_path });
                }}
                aria-label="Excluir foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!fotoParaExcluir} onOpenChange={(v) => !v && setFotoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A foto será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fotoParaExcluir && excluir.mutate(fotoParaExcluir)}
              disabled={excluir.isPending}
            >
              {excluir.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
