import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const EVENTOS = [
  ["contas_a_vencer", "Contas a pagar vencendo nos próximos 7 dias"],
  ["recebimento_vencido", "Recebimentos em atraso"],
  ["medicao_aprovada", "Medição aprovada"],
  ["nf_emitida", "Nota fiscal emitida"],
  ["orcamento_decidido", "Orçamento aprovado ou reprovado"],
  ["rdo_reprovado", "Diário de obra reprovado"],
] as const;

type Pref = Record<string, boolean | string | null>;

export default function Notificacoes() {
  const { empresaId, user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<Pref | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data } = useQuery({
    queryKey: [empresaId, "notificacao-preferencias", user?.id],
    enabled: !!empresaId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacao_preferencias")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setForm(
      data ?? {
        ativo: true,
        frequencia: "diario",
        contas_a_vencer: true,
        recebimento_vencido: true,
        medicao_aprovada: true,
        nf_emitida: true,
        orcamento_decidido: true,
        rdo_reprovado: true,
      },
    );
  }, [data]);

  const salvar = async () => {
    if (!form || !empresaId || !user?.id) return;
    setSalvando(true);
    const payload = { ...form, empresa_id: empresaId, user_id: user.id };
    const { error } = await supabase
      .from("notificacao_preferencias")
      .upsert(payload, { onConflict: "empresa_id,user_id" });
    setSalvando(false);
    if (error) return toast.error(error.message);
    toast.success("Preferências salvas");
    qc.invalidateQueries({ queryKey: [empresaId, "notificacao-preferencias", user.id] });
  };

  if (!form) return <Loader2 className="m-8 h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Avisos por e-mail</h1>
        <p className="text-sm text-muted-foreground">Escolha o que você quer receber e com que frequência.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
          <CardDescription>Enviamos um único e-mail com tudo que precisa da sua atenção.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Receber avisos</Label>
            <Switch checked={!!form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Frequência</Label>
            <Select value={String(form.frequencia)} onValueChange={(v) => setForm({ ...form, frequencia: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="semanal">Semanal (segundas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 border-t pt-4">
            {EVENTOS.map(([campo, label]) => (
              <div key={campo} className="flex items-center justify-between">
                <Label className="font-normal">{label}</Label>
                <Switch
                  checked={!!form[campo]}
                  onCheckedChange={(v) => setForm({ ...form, [campo]: v })}
                />
              </div>
            ))}
          </div>

          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar preferências
          </Button>

          <p className="text-xs text-muted-foreground">
            Todo e-mail traz o link de descadastro no rodapé.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
