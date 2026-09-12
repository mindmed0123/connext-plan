import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { hexToRgb } from "@/lib/color";
import { arredondar2 } from "@/lib/money";
import { calcularBdiPct, subtotalItem } from "@/lib/orcamento-calc";

const BRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type PropostaModelo = {
  nome: string;
  capa?: string | null;
  texto_introducao?: string | null;
  texto_condicoes?: string | null;
  texto_rodape?: string | null;
  mostra_bdi?: boolean | null;
};

export type PropostaEmpresa = {
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  cor_primaria?: string | null;
};

export type PropostaItem = {
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct?: number | null;
  aliquota_iss?: number | null;
  bdi_pct?: number | null;
  etapa_nome?: string | null;
};

export type PropostaOrcamento = {
  numero?: string | null;
  numero_orcamento?: string | null;
  titulo?: string | null;
  objeto?: string | null;
  data_orcamento: string;
  validade_dias?: number | null;
  cliente_nome?: string | null;
  cliente_cnpj?: string | null;
  cliente_endereco?: string | null;
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  condicao_pagamento?: string | null;
  numero_parcelas?: number | null;
  prazo_execucao?: string | null;
  local_execucao?: string | null;
  valor_total?: number | null;
  bdi_ac?: number | null; bdi_s?: number | null; bdi_r?: number | null;
  bdi_df?: number | null; bdi_l?: number | null; bdi_i?: number | null;
};

async function loadImage(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims, format: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

export interface PropostaOpcoes {
  /** true = itens agrupados por etapa; false = lista única resumida */
  agruparPorEtapa: boolean;
  assinante?: string | null;
}

export async function gerarPropostaPDF(
  orc: PropostaOrcamento,
  itens: PropostaItem[],
  empresa: PropostaEmpresa,
  modelo: PropostaModelo,
  opcoes: PropostaOpcoes,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const COR: [number, number, number] = hexToRgb(empresa.cor_primaria ?? "", [82, 196, 184]);
  let y = margin;

  // ---- capa / cabeçalho ----
  if (empresa.logo_url) {
    const logo = await loadImage(empresa.logo_url);
    if (logo && logo.w > 0) {
      const ratio = logo.w / logo.h;
      let w = 45, h = w / ratio;
      if (h > 25) { h = 25; w = h * ratio; }
      try { doc.addImage(logo.dataUrl, logo.format, margin, y, w, h); } catch { /* ignore */ }
    }
  }
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(40, 40, 40);
  doc.text((empresa.nome || "").toUpperCase(), pageW - margin, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110, 110, 110);
  const linhasEmpresa = [
    empresa.cnpj ? `CNPJ ${empresa.cnpj}` : "",
    [empresa.endereco, empresa.cidade, empresa.uf].filter(Boolean).join(" - "),
    [empresa.telefone, empresa.email].filter(Boolean).join(" | "),
  ].filter(Boolean);
  let ye = y + 9;
  linhasEmpresa.forEach((l) => { doc.text(l, pageW - margin, ye, { align: "right" }); ye += 4; });

  y = Math.max(y + 28, ye + 4);
  doc.setDrawColor(...COR).setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...COR);
  doc.text("PROPOSTA COMERCIAL", margin, y);
  doc.setFontSize(10).setTextColor(80, 80, 80);
  const numero = orc.numero || orc.numero_orcamento || "";
  if (numero) doc.text(numero, pageW - margin, y, { align: "right" });
  y += 8;

  if (modelo.capa) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 60, 60);
    const t = doc.splitTextToSize(modelo.capa, pageW - margin * 2);
    doc.text(t, margin, y);
    y += t.length * 5 + 3;
  }

  // ---- cliente ----
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40, 40, 40);
  doc.text("Cliente", margin, y); y += 5;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70, 70, 70);
  [
    orc.cliente_nome ?? "",
    orc.cliente_cnpj ? `CNPJ/CPF: ${orc.cliente_cnpj}` : "",
    orc.cliente_endereco ?? "",
    [orc.cliente_email, orc.cliente_telefone].filter(Boolean).join(" | "),
  ].filter(Boolean).forEach((l) => { doc.text(l, margin, y); y += 4.5; });
  y += 4;

  if (modelo.texto_introducao) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60, 60, 60);
    const t = doc.splitTextToSize(modelo.texto_introducao, pageW - margin * 2);
    doc.text(t, margin, y); y += t.length * 4.6 + 4;
  }

  if (orc.objeto) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40, 40, 40);
    doc.text("Objeto", margin, y); y += 5;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70, 70, 70);
    const t = doc.splitTextToSize(orc.objeto, pageW - margin * 2);
    doc.text(t, margin, y); y += t.length * 4.5 + 4;
  }

  // ---- itens ----
  const linha = (i: PropostaItem) => [
    i.descricao,
    i.unidade,
    (Number(i.quantidade) || 0).toLocaleString("pt-BR"),
    BRL(Number(i.preco_unitario) || 0),
    BRL(arredondar2(subtotalItem(i))),
  ];

  const head = [["Descrição", "Un.", "Qtd", "Preço un.", "Total"]];
  if (opcoes.agruparPorEtapa) {
    const grupos = new Map<string, PropostaItem[]>();
    itens.forEach((i) => {
      const k = i.etapa_nome || "Sem etapa";
      grupos.set(k, [...(grupos.get(k) ?? []), i]);
    });
    for (const [etapa, lista] of grupos) {
      const totalEtapa = lista.reduce((s, i) => s + subtotalItem(i), 0);
      autoTable(doc, {
        startY: y,
        head,
        body: [
          [{ content: etapa.toUpperCase(), colSpan: 4, styles: { fontStyle: "bold" as const } },
           { content: BRL(arredondar2(totalEtapa)), styles: { fontStyle: "bold" as const, halign: "right" as const } }],
          ...lista.map(linha),
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: COR, textColor: 255, fontSize: 8.5 },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }
  } else {
    autoTable(doc, {
      startY: y,
      head,
      body: itens.map(linha),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: COR, textColor: 255, fontSize: 8.5 },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  const total = Number(orc.valor_total) || arredondar2(itens.reduce((s, i) => s + subtotalItem(i), 0));
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(40, 40, 40);
  doc.text(`Valor total: ${BRL(total)}`, pageW - margin, y + 4, { align: "right" });
  y += 12;

  if (modelo.mostra_bdi) {
    const bdi = calcularBdiPct({
      ac: Number(orc.bdi_ac) || 0, s: Number(orc.bdi_s) || 0, r: Number(orc.bdi_r) || 0,
      df: Number(orc.bdi_df) || 0, l: Number(orc.bdi_l) || 0, i: Number(orc.bdi_i) || 0,
    });
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 90, 90);
    doc.text(`BDI considerado: ${bdi.toFixed(2)}%`, margin, y);
    y += 7;
  }

  // ---- condições ----
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40, 40, 40);
  doc.text("Condições", margin, y); y += 5;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70, 70, 70);
  const validade = orc.validade_dias
    ? format(addDays(parseISO(orc.data_orcamento), Number(orc.validade_dias)), "dd/MM/yyyy", { locale: ptBR })
    : null;
  [
    orc.condicao_pagamento ? `Pagamento: ${orc.condicao_pagamento.replace(/_/g, " ")}${orc.numero_parcelas && orc.numero_parcelas > 1 ? ` em ${orc.numero_parcelas}x` : ""}` : "",
    orc.prazo_execucao ? `Prazo de execução: ${orc.prazo_execucao}` : "",
    orc.local_execucao ? `Local: ${orc.local_execucao}` : "",
    validade ? `Proposta válida até ${validade}` : "",
  ].filter(Boolean).forEach((l) => { doc.text(l, margin, y); y += 4.5; });

  if (modelo.texto_condicoes) {
    y += 2;
    const t = doc.splitTextToSize(modelo.texto_condicoes, pageW - margin * 2);
    doc.text(t, margin, y); y += t.length * 4.5;
  }
  y += 14;

  // ---- assinatura ----
  if (y > pageH - 40) { doc.addPage(); y = margin + 20; }
  doc.setDrawColor(120, 120, 120).setLineWidth(0.3);
  doc.line(margin, y, margin + 70, y);
  doc.setFontSize(9).setTextColor(70, 70, 70);
  doc.text(opcoes.assinante || empresa.nome, margin, y + 5);
  doc.line(pageW - margin - 70, y, pageW - margin, y);
  doc.text(orc.cliente_nome || "Cliente", pageW - margin - 70, y + 5);

  // ---- rodapé ----
  const rodape = modelo.texto_rodape;
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5).setTextColor(140, 140, 140);
    if (rodape) doc.text(doc.splitTextToSize(rodape, pageW - margin * 2 - 20), margin, pageH - 8);
    doc.text(`${p}/${paginas}`, pageW - margin, pageH - 8, { align: "right" });
  }

  doc.save(`proposta-${(numero || "orcamento").replace(/[^\w-]/g, "")}.pdf`);
}
