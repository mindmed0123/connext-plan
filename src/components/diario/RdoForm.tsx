import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOnline } from "@/hooks/useOnline";
import { useMinhasObras } from "@/hooks/useMinhasObras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Trash2, WifiOff } from "lucide-react";
import { CLIMA_LABEL, type RdoEfetivo, type RdoEquipamento } from "@/lib/rdo-pdf";

const CLIMAS = ["sol", "nublado", "chuva_fraca", "chuva_forte"] as const;

type Props = {
  obraId?: string;
  /** Layout com campos grandes, pensado para o celular. */
  compacto?: boolean;
  onSalvo?: (diarioId: string) => void;
};

export function RdoForm({ obraId: obraFixa, compacto, onSalvo }: Props) {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const online = useOnline();
  const { data: obras = [] } = useMinhasObras();

  const [obraId, setObraId] = useState(obraFixa ?? "");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [climaManha, setClimaManha] = useState<string>("sol");
  const [climaTarde, setClimaTarde] = useState<string>("sol");
  const [condicao, setCondicao] = useState("praticavel");
  const [efetivo, setEfetivo] = useState<RdoEfetivo[]>([{ funcao: "", quantidade: 1 }]);
  const [equipamentos, setEquipamentos] = useState<RdoEquipamento[]>([]);
  const [atividades, setAtividades] = useState("");
  const [ocorrencias, setOcorrencias] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (obraFixa) setObraId(obraFixa);
  }, [obraFixa]);

  const { data: pessoas = [] } = useQuery({
    queryKey: [empresaId, "pessoas-rdo"],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("id, nome").eq("status", "ativo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const campoGrande = compacto ? "h-12 text-base" : "";

  const salvar = async () => {
    if (!obraId) return toast.error("Escolha a obra");
    if (!online) {
      toast.error("Sem internet agora. O que você digitou continua aqui — tente enviar de novo quando o sinal voltar.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        empresa_id: empresaId!,
        obra_id: obraId,
        data_envio: data,
        clima_manha: climaManha,
        clima_tarde: climaTarde,
        condicao_trabalho: condicao,
        efetivo: efetivo.filter((e) => e.funcao.trim()),
        equipamentos: equipamentos.filter((e) => e.nome.trim()),
        atividades_executadas: atividades || null,
        ocorrencias: ocorrencias || null,
        observacoes: observacoes || "",
        responsavel_id: responsavelId || null,
        status: "enviado" as const,
      };
      const { data: salvo, error } = await supabase
        .from("diario_obra")
        .upsert(payload, { onConflict: "empresa_id,obra_id,data_envio" })
        .select("id")
        .single();
      if (error) throw error;

      if (fotos.length > 0) {
        const { data: u } = await supabase.auth.getUser();
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
              diario_id: salvo.id,
              tipo: "durante" as const,
              imagem_url: pub.publicUrl,
              storage_path: path,
              observacao: null,
              uploaded_by: u.user?.id ?? null,
            },
          ]);
          if (insErr) throw insErr;
        }
      }

      toast.success("Diário enviado");
      setFotos([]);
      qc.invalidateQueries();
      onSalvo?.(salvo.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast.error(
        navigator.onLine ? msg : "Sem internet agora. Nada foi perdido: tente enviar de novo quando o sinal voltar.",
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      {!online && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <WifiOff className="h-4 w-4 shrink-0" />
          Você está sem internet. Pode continuar preenchendo: nada é apagado da tela.
        </div>
      )}

      {!obraFixa && (
        <div className="space-y-1.5">
          <Label>Obra</Label>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger className={campoGrande}>
              <SelectValue placeholder="Escolha a obra" />
            </SelectTrigger>
            <SelectContent>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.codigo_chamado}
                  {o.descricao_servico ? ` — ${o.descricao_servico}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campoGrande} />
        </div>
        <div className="space-y-1.5">
          <Label>Condição de trabalho</Label>
          <Select value={condicao} onValueChange={setCondicao}>
            <SelectTrigger className={campoGrande}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="praticavel">Praticável</SelectItem>
              <SelectItem value="impraticavel">Impraticável</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Clima de manhã</Label>
          <Select value={climaManha} onValueChange={setClimaManha}>
            <SelectTrigger className={campoGrande}><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLIMAS.map((c) => <SelectItem key={c} value={c}>{CLIMA_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Clima à tarde</Label>
          <Select value={climaTarde} onValueChange={setClimaTarde}>
            <SelectTrigger className={campoGrande}><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLIMAS.map((c) => <SelectItem key={c} value={c}>{CLIMA_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Responsável</Label>
        <Select value={responsavelId} onValueChange={setResponsavelId}>
          <SelectTrigger className={campoGrande}><SelectValue placeholder="Quem respondeu pelo dia" /></SelectTrigger>
          <SelectContent>
            {pessoas.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <Label>Efetivo do dia</Label>
          {efetivo.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Função (ex.: pedreiro)"
                value={e.funcao}
                className={campoGrande}
                onChange={(ev) => setEfetivo(efetivo.map((x, j) => (j === i ? { ...x, funcao: ev.target.value } : x)))}
              />
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={e.quantidade}
                className={`w-20 ${campoGrande}`}
                onChange={(ev) =>
                  setEfetivo(efetivo.map((x, j) => (j === i ? { ...x, quantidade: Number(ev.target.value) } : x)))
                }
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setEfetivo(efetivo.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setEfetivo([...efetivo, { funcao: "", quantidade: 1 }])}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar função
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <Label>Equipamentos</Label>
          {equipamentos.map((e, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Equipamento"
                value={e.nome}
                className={campoGrande}
                onChange={(ev) =>
                  setEquipamentos(equipamentos.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))
                }
              />
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={e.quantidade}
                className={`w-20 ${campoGrande}`}
                onChange={(ev) =>
                  setEquipamentos(equipamentos.map((x, j) => (j === i ? { ...x, quantidade: Number(ev.target.value) } : x)))
                }
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setEquipamentos(equipamentos.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setEquipamentos([...equipamentos, { nome: "", quantidade: 1 }])}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar equipamento
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        <Label>Atividades executadas</Label>
        <Textarea rows={4} value={atividades} onChange={(e) => setAtividades(e.target.value)} className="text-base" />
      </div>
      <div className="space-y-1.5">
        <Label>Ocorrências</Label>
        <Textarea rows={3} value={ocorrencias} onChange={(e) => setOcorrencias(e.target.value)} className="text-base" />
      </div>
      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="text-base" />
      </div>

      <div className="space-y-1.5">
        <Label>Fotos do dia</Label>
        <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm font-medium">
          <Camera className="h-5 w-5" />
          {fotos.length > 0 ? `${fotos.length} foto(s) escolhida(s)` : "Tirar ou escolher fotos"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => setFotos([...fotos, ...Array.from(e.target.files ?? [])])}
          />
        </label>
      </div>

      <Button onClick={salvar} disabled={salvando} className="h-14 w-full text-base">
        {salvando ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
        Enviar diário
      </Button>
    </div>
  );
}
