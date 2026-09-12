import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/obra-helpers";

export type RetencoesNf = {
  valor_bruto: string;
  valor_deducoes_inss: string;
  base_inss: string;
  aliquota_inss: string;
  ret_inss: string;
  aliquota_iss: string;
  ret_iss: string;
  ret_irrf: string;
  ret_pcc: string;
};

/** Estado inicial. As alíquotas reais vêm da configuração fiscal da empresa
 *  e substituem estes valores assim que o formulário carrega. */
export const emptyRetencoes = (
  valor = "",
  aliquotas: { inss?: number | string; iss?: number | string } = {},
): RetencoesNf => ({
  valor_bruto: valor,
  valor_deducoes_inss: "0",
  base_inss: valor || "0",
  aliquota_inss: String(aliquotas.inss ?? "0"),
  ret_inss: "0",
  aliquota_iss: String(aliquotas.iss ?? "0"),
  ret_iss: "0",
  ret_irrf: "0",
  ret_pcc: "0",
});

export const nfLiquido = (nf: RetencoesNf) =>
  Math.max(
    0,
    Number(nf.valor_bruto || 0) -
      Number(nf.ret_inss || 0) -
      Number(nf.ret_iss || 0) -
      Number(nf.ret_irrf || 0) -
      Number(nf.ret_pcc || 0),
  );

export const nfPayload = (nf: RetencoesNf) => ({
  valor: Number(nf.valor_bruto || 0),
  valor_bruto: Number(nf.valor_bruto || 0),
  valor_deducoes_inss: Number(nf.valor_deducoes_inss || 0),
  base_inss: Number(nf.base_inss || 0),
  aliquota_inss: Number(nf.aliquota_inss || 0),
  ret_inss: Number(nf.ret_inss || 0),
  aliquota_iss: Number(nf.aliquota_iss || 0),
  ret_iss: Number(nf.ret_iss || 0),
  ret_irrf: Number(nf.ret_irrf || 0),
  ret_pcc: Number(nf.ret_pcc || 0),
});

export function RetencoesNfFields({ value, onChange }: { value: RetencoesNf; onChange: (value: RetencoesNf) => void }) {
  const set = (key: keyof RetencoesNf, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><Label>Valor bruto</Label><Input type="number" step="0.01" value={value.valor_bruto} onChange={(e) => set("valor_bruto", e.target.value)} /></div>
        <div><Label>Deduções INSS</Label><Input type="number" step="0.01" value={value.valor_deducoes_inss} onChange={(e) => set("valor_deducoes_inss", e.target.value)} /></div>
        <div><Label>Base INSS</Label><Input type="number" step="0.01" value={value.base_inss} onChange={(e) => set("base_inss", e.target.value)} /></div>
        <div><Label>Alíquota INSS (%)</Label><Input type="number" step="0.01" value={value.aliquota_inss} onChange={(e) => set("aliquota_inss", e.target.value)} /></div>
        <div><Label>INSS retido</Label><Input type="number" step="0.01" value={value.ret_inss} onChange={(e) => set("ret_inss", e.target.value)} /></div>
        <div><Label>Alíquota ISS (%)</Label><Input type="number" step="0.01" value={value.aliquota_iss} onChange={(e) => set("aliquota_iss", e.target.value)} /></div>
        <div><Label>ISS retido</Label><Input type="number" step="0.01" value={value.ret_iss} onChange={(e) => set("ret_iss", e.target.value)} /></div>
        <div><Label>IRRF retido</Label><Input type="number" step="0.01" value={value.ret_irrf} onChange={(e) => set("ret_irrf", e.target.value)} /></div>
        <div><Label>PCC retido</Label><Input type="number" step="0.01" value={value.ret_pcc} onChange={(e) => set("ret_pcc", e.target.value)} /></div>
      </div>
      <div className="flex items-center justify-between border-t pt-3 text-sm">
        <span className="font-medium">Valor líquido a receber</span>
        <span className="text-base font-semibold tabular-nums text-success">{formatCurrency(nfLiquido(value))}</span>
      </div>
    </div>
  );
}