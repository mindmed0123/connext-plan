import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMinhasObras } from "@/hooks/useMinhasObras";
import { useOnline } from "@/hooks/useOnline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function CampoFoto() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const online = useOnline();
  const { data: obras = [] } = useMinhasObras();

  const [obraId, setObraId] = useState("");
  const [tipo, setTipo] = useState<"antes" | "durante" | "depois">("durante");
  const [observacao, setObservacao] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!obraId) return toast.error("Escolha a obra");
    if (fotos.length === 0) return toast.error("Escolha pelo menos uma foto");
    if (!online) {
      toast.error("Sem internet agora. As fotos continuam escolhidas aqui — tente de novo quando o sinal voltar.");
      return;
    }
    setEnviando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: diario } = await supabase
        .from("diario_obra")
        .select("id")
        .eq("obra_id", obraId)
        .eq("data_envio", hoje)
        .maybeSingle();

      for (const file of fotos) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${obraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("obras-fotos").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("obras-fotos").getPublicUrl(path);
        const { error: insErr } = await supabase.from("fotos_obra").insert([
          {
            empresa_id: empresaId!,
            obra_id: obraId,
            diario_id: diario?.id ?? null,
            tipo,
            imagem_url: pub.publicUrl,
            storage_path: path,
            observacao: observacao || null,
            uploaded_by: u.user?.id ?? null,
          },
        ]);
        if (insErr) throw insErr;
      }
      toast.success(`${fotos.length} foto(s) enviada(s)`);
      setFotos([]);
      setObservacao("");
      qc.invalidateQueries();
      navigate("/campo");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast.error(navigator.onLine ? msg : "Sem internet agora. Nada foi perdido: tente de novo com sinal.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/campo")} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
      </Button>
      <h1 className="text-2xl font-bold">Nova foto</h1>

      {!online && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <WifiOff className="h-4 w-4 shrink-0" /> Sem internet. Escolha as fotos agora e envie quando o sinal voltar.
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Obra</Label>
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Escolha a obra" /></SelectTrigger>
          <SelectContent>
            {obras.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.codigo_chamado}{o.descricao_servico ? ` — ${o.descricao_servico}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Momento</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
          <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="antes">Antes</SelectItem>
            <SelectItem value="durante">Durante</SelectItem>
            <SelectItem value="depois">Depois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm font-medium">
        <Camera className="h-8 w-8 text-primary" />
        {fotos.length > 0 ? `${fotos.length} foto(s) escolhida(s)` : "Abrir câmera"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => setFotos([...fotos, ...Array.from(e.target.files ?? [])])}
        />
      </label>

      <div className="space-y-1.5">
        <Label>Observação</Label>
        <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} className="text-base" />
      </div>

      <Button onClick={enviar} disabled={enviando} className="h-14 w-full text-base">
        {enviando ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null} Enviar fotos
      </Button>
    </div>
  );
}
