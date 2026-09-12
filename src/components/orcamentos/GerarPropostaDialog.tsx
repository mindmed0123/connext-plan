import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaConfig } from "@/hooks/useEmpresaConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { gerarPropostaPDF, type PropostaItem, type PropostaModelo, type PropostaOrcamento } from "@/lib/proposta-pdf";

export function GerarPropostaDialog({
  orcamentoId, open, onOpenChange,
}: {
  orcamentoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { empresaId, user } = useAuth();
  const { config } = useEmpresaConfig();
  const qc = useQueryClient();
  const [modeloId, setModeloId] = useState<string>("");
  const [agrupamento, setAgrupamento] = useState<"etapa" | "resumido">("resumido");
  const [gerando, setGerando] = useState(false);

  const { data: modelos } = useQuery({
    queryKey: [empresaId, "modelos-proposta"],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase.from("modelos_proposta").select("*").order("padrao", { ascending: false }).order("nome");
      return data ?? [];
    },
  });

  const { data: versoes } = useQuery({
    queryKey: [empresaId, "proposta-versoes", orcamentoId],
    enabled: !!empresaId && !!orcamentoId && open,
    queryFn: async () => {
      const { data } = await supabase.from("proposta_versoes").select("*")
        .eq("orcamento_id", orcamentoId!).order("versao", { ascending: false });
      return data ?? [];
    },
  });

  const modeloSelecionado = modelos?.find((m) => m.id === modeloId) ?? modelos?.find((m) => m.padrao) ?? modelos?.[0];

  const montarConteudo = async () => {
    const [{ data: orc }, { data: itens }, { data: empresa }] = await Promise.all([
      supabase.from("orcamentos").select("*").eq("id", orcamentoId!).single(),
      supabase.from("orcamento_itens").select("*, obra_etapas(nome)").eq("orcamento_id", orcamentoId!).order("ordem"),
      supabase.from("empresas").select("*").eq("id", empresaId!).single(),
    ]);
    if (!orc || !empresa) throw new Error("Orçamento não encontrado");
    const itensPdf: PropostaItem[] = (itens ?? []).map((i) => ({
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: Number(i.quantidade),
      preco_unitario: Number(i.preco_unitario),
      desconto_pct: Number(i.desconto_pct ?? 0),
      aliquota_iss: Number(i.aliquota_iss ?? 0),
      bdi_pct: i.bdi_pct == null ? null : Number(i.bdi_pct),
      etapa_nome: (i as { obra_etapas?: { nome: string } | null }).obra_etapas?.nome ?? null,
    }));
    return { orc: orc as unknown as PropostaOrcamento, itensPdf, empresa };
  };

  const imprimir = async (
    orc: PropostaOrcamento,
    itensPdf: PropostaItem[],
    empresa: Record<string, unknown>,
    modelo: PropostaModelo,
    agrupar: boolean,
  ) => {
    await gerarPropostaPDF(orc, itensPdf, {
      nome: (empresa.nome as string) ?? "Empresa",
      cnpj: (empresa.cnpj as string) ?? null,
      endereco: (empresa.endereco as string) ?? null,
      cidade: (empresa.cidade as string) ?? null,
      uf: (empresa.uf as string) ?? null,
      telefone: (empresa.telefone as string) ?? null,
      email: (empresa.email as string) ?? null,
      logo_url: (empresa.logo_url as string) ?? null,
      cor_primaria: config.cor_primaria,
    }, modelo, { agruparPorEtapa: agrupar });
  };

  const gerar = async () => {
    if (!orcamentoId || !empresaId) return;
    if (!modeloSelecionado) { toast.error("Cadastre um modelo de proposta em Configurações"); return; }
    setGerando(true);
    try {
      const { orc, itensPdf, empresa } = await montarConteudo();
      const agrupar = agrupamento === "etapa";
      await imprimir(orc, itensPdf, empresa as Record<string, unknown>, modeloSelecionado, agrupar);

      const proxima = (versoes?.[0]?.versao ?? 0) + 1;
      const { error } = await supabase.from("proposta_versoes").insert({
        empresa_id: empresaId,
        orcamento_id: orcamentoId,
        modelo_id: modeloSelecionado.id,
        versao: proxima,
        gerado_por_email: user?.email ?? null,
        conteudo: { orc, itens: itensPdf, empresa, modelo: modeloSelecionado, agruparPorEtapa: agrupar } as never,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: [empresaId, "proposta-versoes", orcamentoId] });
      toast.success(`Proposta v${proxima} gerada`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGerando(false);
    }
  };

  const reimprimir = async (conteudo: unknown) => {
    try {
      const c = conteudo as {
        orc: PropostaOrcamento; itens: PropostaItem[];
        empresa: Record<string, unknown>; modelo: PropostaModelo; agruparPorEtapa: boolean;
      };
      await imprimir(c.orc, c.itens, c.empresa, c.modelo, !!c.agruparPorEtapa);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar proposta</DialogTitle>
          <DialogDescription>Escolha o modelo e como os itens aparecem no PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={modeloSelecionado?.id ?? ""} onValueChange={setModeloId}>
              <SelectTrigger><SelectValue placeholder="Nenhum modelo cadastrado" /></SelectTrigger>
              <SelectContent>
                {(modelos ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}{m.padrao ? " (padrão)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(modelos?.length ?? 0) === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre um modelo em Configurações → Modelos de proposta.
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Itens</Label>
            <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as "etapa" | "resumido")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resumido">Lista única (resumido)</SelectItem>
                <SelectItem value="etapa">Agrupados por etapa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(versoes?.length ?? 0) > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold">Propostas já geradas</p>
              <div className="space-y-1">
                {versoes!.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      v{v.versao} — {format(parseISO(v.created_at), "dd/MM/yyyy HH:mm")}
                      {v.gerado_por_email ? ` — ${v.gerado_por_email}` : ""}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => reimprimir(v.conteudo)}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Reimprimir
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={gerar} disabled={gerando || !modeloSelecionado}>
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
