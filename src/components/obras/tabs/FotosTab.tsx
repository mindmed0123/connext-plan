import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, ImageIcon } from "lucide-react";

const TIPO_LABEL = { antes: "Antes", durante: "Durante", depois: "Depois" } as const;

export function FotosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"antes" | "durante" | "depois">("durante");
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: fotos } = useQuery({
    queryKey: ["fotos", obraId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fotos_obra").select("*").eq("obra_id", obraId).order("data_upload", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("obras-fotos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("obras-fotos").getPublicUrl(path);
      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("fotos_obra").insert([{
        obra_id: obraId, tipo, imagem_url: pub.publicUrl, storage_path: path, observacao: observacao || null,
      }]);
      if (insErr) throw insErr;
      await supabase.from("obra_timeline").insert([{
        obra_id: obraId, user_id: u.user?.id, evento: "Foto adicionada", detalhes: `Tipo: ${TIPO_LABEL[tipo]}`,
      }]);
      toast.success("Foto enviada");
      setObservacao("");
      qc.invalidateQueries({ queryKey: ["fotos", obraId] });
      qc.invalidateQueries({ queryKey: ["timeline", obraId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Adicionar foto</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="antes">Antes</SelectItem>
                <SelectItem value="durante">Durante</SelectItem>
                <SelectItem value="depois">Depois</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-surface-muted px-4 py-6 text-sm text-muted-foreground transition hover:bg-secondary">
          <Upload className="h-4 w-4" />
          {busy ? "Enviando..." : "Selecionar arquivo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={busy} />
        </label>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Galeria</h3>
        {(fotos?.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-8 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <p className="text-xs">Sem fotos ainda</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {fotos?.map((f) => (
            <a key={f.id} href={f.imagem_url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-md border">
              <img src={f.imagem_url} alt={f.observacao || ""} className="aspect-square w-full object-cover transition group-hover:scale-105" />
              <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                {TIPO_LABEL[f.tipo as keyof typeof TIPO_LABEL]}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
