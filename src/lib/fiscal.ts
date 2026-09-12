export type ConfigFiscal = {
  cprb: boolean;
  aliquota_inss_padrao: number;
  aliquota_inss_cprb: number;
  aliquota_iss_padrao: number;
  aliquota_irrf_padrao: number;
  aliquota_pcc_padrao: number;
};

export type RegrasCliente = {
  aliquota_iss?: number | null;
  retem_iss?: boolean | null;
  retem_inss?: boolean | null;
  retem_irrf?: boolean | null;
  retem_csrf?: boolean | null;
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Alíquotas efetivas: o cliente tem prioridade sobre o padrão da empresa. */
export function aliquotasEfetivas(config: ConfigFiscal | null, cliente: RegrasCliente | null) {
  const inss = config?.cprb ? num(config?.aliquota_inss_cprb, 3.5) : num(config?.aliquota_inss_padrao, 11);
  const issEmpresa = num(config?.aliquota_iss_padrao, 0);
  const issCliente = cliente?.aliquota_iss == null ? null : num(cliente.aliquota_iss, 0);
  return {
    inss,
    iss: issCliente ?? issEmpresa,
    irrf: num(config?.aliquota_irrf_padrao, 1.5),
    pcc: num(config?.aliquota_pcc_padrao, 4.65),
  };
}

/** Calcula as retenções de uma NF a partir do valor bruto e das deduções da base do INSS. */
export function calcularRetencoes(
  config: ConfigFiscal | null,
  cliente: RegrasCliente | null,
  brutoTexto: string,
  deducoesInss: string | number,
) {
  const bruto = num(brutoTexto);
  const a = aliquotasEfetivas(config, cliente);
  const baseInss = Math.max(0, bruto - num(deducoesInss));
  const pct = (base: number, aliq: number) => String(Math.round(base * aliq) / 100);
  return {
    valor_bruto: brutoTexto,
    base_inss: String(baseInss),
    aliquota_inss: String(a.inss),
    aliquota_iss: String(a.iss),
    ret_inss: cliente?.retem_inss ? pct(baseInss, a.inss) : "0",
    ret_iss: cliente?.retem_iss ? pct(bruto, a.iss) : "0",
    ret_irrf: cliente?.retem_irrf ? pct(bruto, a.irrf) : "0",
    ret_pcc: cliente?.retem_csrf ? pct(bruto, a.pcc) : "0",
  };
}
