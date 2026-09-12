import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresaConfig, type EmpresaConfig } from "@/hooks/useEmpresaConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Campos = Partial<EmpresaConfig>;

export function useSalvarConfig() {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [salvando, setSalvando] = useState(false);

  const salvar = async (campos: Campos) => {
    if (!empresaId) return;
    setSalvando(true);
    const { error } = await supabase
      .from("empresa_config")
      .upsert({ empresa_id: empresaId, ...campos } as never, { onConflict: "empresa_id" });
    setSalvando(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [empresaId, "empresa-config"] });
    toast.success("Configuração salva");
  };

  return { salvar, salvando };
}

const Ajuda = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground mt-1">{children}</p>
);

export function ConfigFiscalCard() {
  const { config, isLoading } = useEmpresaConfig();
  const { salvar, salvando } = useSalvarConfig();
  const [f, setF] = useState(config);
  useEffect(() => { setF(config); }, [config]);
  if (isLoading) return null;

  const numero = (k: keyof EmpresaConfig) => (
    <Input
      type="number"
      step="0.01"
      value={String(f[k] ?? 0)}
      onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiscal</CardTitle>
        <CardDescription>
          Valores que os formulários de nota fiscal e de orçamento usam como ponto de partida. O que estiver
          cadastrado no cliente continua tendo prioridade sobre estes padrões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Regime tributário</Label>
            <Select
              value={f.regime_tributario ?? "nao_informado"}
              onValueChange={(v) => setF({ ...f, regime_tributario: v === "nao_informado" ? null : v })}
            >
              <SelectTrigger><SelectValue placeholder="Não informado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nao_informado">Não informado</SelectItem>
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
            <Ajuda>Usado como referência do enquadramento da empresa.</Ajuda>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={f.cprb} onCheckedChange={(v) => setF({ ...f, cprb: v })} />
            <div>
              <Label>Desoneração da folha (CPRB)</Label>
              <Ajuda>Quando ligada, a nota usa a alíquota de INSS desonerada.</Ajuda>
            </div>
          </div>
          <div>
            <Label>INSS padrão (%)</Label>
            {numero("aliquota_inss_padrao")}
            <Ajuda>Retenção de INSS quando a empresa não está desonerada.</Ajuda>
          </div>
          <div>
            <Label>INSS desonerado (%)</Label>
            {numero("aliquota_inss_cprb")}
            <Ajuda>Retenção usada quando a CPRB está ligada.</Ajuda>
          </div>
          <div>
            <Label>ISS padrão (%)</Label>
            {numero("aliquota_iss_padrao")}
            <Ajuda>Usado quando o cliente não tem alíquota própria.</Ajuda>
          </div>
          <div>
            <Label>IRRF (%)</Label>
            {numero("aliquota_irrf_padrao")}
            <Ajuda>Retenção de imposto de renda na fonte.</Ajuda>
          </div>
          <div>
            <Label>PIS/COFINS/CSLL (%)</Label>
            {numero("aliquota_pcc_padrao")}
            <Ajuda>Retenção conjunta das três contribuições.</Ajuda>
          </div>
          <div>
            <Label>Prazo de pagamento padrão (dias)</Label>
            <Input
              type="number"
              value={String(f.prazo_pagamento_padrao ?? 30)}
              onChange={(e) => setF({ ...f, prazo_pagamento_padrao: Number(e.target.value) })}
            />
            <Ajuda>Prazo sugerido para o vencimento dos recebimentos.</Ajuda>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">BDI padrão (%)</Label>
          <Ajuda>Composição sugerida nos novos orçamentos: administração central, seguros, riscos, despesas financeiras, lucro e impostos.</Ajuda>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-2">
            {([["bdi_ac", "AC"], ["bdi_s", "S"], ["bdi_r", "R"], ["bdi_df", "DF"], ["bdi_l", "L"], ["bdi_i", "I"]] as const).map(
              ([k, label]) => (
                <div key={k}>
                  <Label className="text-xs">{label}</Label>
                  {numero(k)}
                </div>
              ),
            )}
          </div>
        </div>

        <Button
          disabled={salvando}
          onClick={() => salvar({
            regime_tributario: f.regime_tributario, cprb: f.cprb,
            aliquota_inss_padrao: f.aliquota_inss_padrao, aliquota_inss_cprb: f.aliquota_inss_cprb,
            aliquota_iss_padrao: f.aliquota_iss_padrao, aliquota_irrf_padrao: f.aliquota_irrf_padrao,
            aliquota_pcc_padrao: f.aliquota_pcc_padrao, prazo_pagamento_padrao: f.prazo_pagamento_padrao,
            bdi_ac: f.bdi_ac, bdi_s: f.bdi_s, bdi_r: f.bdi_r, bdi_df: f.bdi_df, bdi_l: f.bdi_l, bdi_i: f.bdi_i,
          })}
        >
          Salvar fiscal
        </Button>
      </CardContent>
    </Card>
  );
}

export function ConfigDocumentosCard() {
  const { config, isLoading } = useEmpresaConfig();
  const { salvar, salvando } = useSalvarConfig();
  const [f, setF] = useState(config);
  useEffect(() => { setF(config); }, [config]);
  if (isLoading) return null;

  const texto = (k: keyof EmpresaConfig) => (
    <Input value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Numeração e textos dos documentos</CardTitle>
        <CardDescription>
          Use {"{ano}"}, {"{ano2}"}, {"{mes}"} e {"{seq}"} nas máscaras. A sequência é própria de cada empresa e por ano,
          então dois documentos nunca recebem o mesmo número.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Máscara do orçamento</Label>{texto("mascara_orcamento")}</div>
          <div><Label>Máscara da medição</Label>{texto("mascara_medicao")}</div>
          <div><Label>Máscara do contrato</Label>{texto("mascara_contrato")}</div>
          <div><Label>Máscara da nota fiscal</Label>{texto("mascara_nf")}</div>
          <div>
            <Label>Validade padrão do orçamento (dias)</Label>
            <Input
              type="number"
              value={String(f.validade_orcamento_dias ?? 30)}
              onChange={(e) => setF({ ...f, validade_orcamento_dias: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label>Condições padrão</Label>
          <Textarea rows={2} value={f.texto_condicoes ?? ""} onChange={(e) => setF({ ...f, texto_condicoes: e.target.value })} />
        </div>
        <div>
          <Label>Observações padrão</Label>
          <Textarea rows={2} value={f.texto_observacoes ?? ""} onChange={(e) => setF({ ...f, texto_observacoes: e.target.value })} />
        </div>
        <div>
          <Label>Rodapé dos documentos</Label>
          <Textarea rows={2} value={f.texto_rodape ?? ""} onChange={(e) => setF({ ...f, texto_rodape: e.target.value })} />
          <Ajuda>Aparece no rodapé do orçamento e do relatório fotográfico.</Ajuda>
        </div>
        <Button
          disabled={salvando}
          onClick={() => salvar({
            mascara_orcamento: f.mascara_orcamento, mascara_medicao: f.mascara_medicao,
            mascara_contrato: f.mascara_contrato, mascara_nf: f.mascara_nf,
            validade_orcamento_dias: f.validade_orcamento_dias,
            texto_condicoes: f.texto_condicoes || null,
            texto_observacoes: f.texto_observacoes || null,
            texto_rodape: f.texto_rodape || null,
          })}
        >
          Salvar documentos
        </Button>
      </CardContent>
    </Card>
  );
}

export function ConfigMarcaCard() {
  const { config, isLoading } = useEmpresaConfig();
  const { salvar, salvando } = useSalvarConfig();
  const [f, setF] = useState(config);
  useEffect(() => { setF(config); }, [config]);
  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Marca nos documentos e e-mails</CardTitle>
        <CardDescription>A cor é usada nos PDFs, junto com a logo e os dados já cadastrados da empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Cor da marca</Label>
            <div className="flex gap-2">
              <Input type="color" className="w-14 p-1" value={f.cor_primaria || "#52C4B8"} onChange={(e) => setF({ ...f, cor_primaria: e.target.value })} />
              <Input value={f.cor_primaria ?? ""} onChange={(e) => setF({ ...f, cor_primaria: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Nome do remetente dos e-mails</Label>
            <Input value={f.email_remetente_nome ?? ""} onChange={(e) => setF({ ...f, email_remetente_nome: e.target.value })} />
            <Ajuda>Aparece como remetente nos convites e avisos.</Ajuda>
          </div>
          <div>
            <Label>E-mail do remetente (opcional)</Label>
            <Input value={f.email_remetente_endereco ?? ""} onChange={(e) => setF({ ...f, email_remetente_endereco: e.target.value })} />
            <Ajuda>Só entra em uso depois que o domínio próprio for liberado no provedor de e-mail.</Ajuda>
          </div>
        </div>
        <Button
          disabled={salvando}
          onClick={() => salvar({
            cor_primaria: f.cor_primaria,
            email_remetente_nome: f.email_remetente_nome || null,
            email_remetente_endereco: f.email_remetente_endereco || null,
          })}
        >
          Salvar marca
        </Button>
      </CardContent>
    </Card>
  );
}
