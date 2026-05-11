import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type PDFOrcamento = {
  numero_orcamento: string | null;
  titulo: string | null;
  data_orcamento: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  observacoes: string | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_endereco: string | null;
  valor_orcamento: number;
  obras: { codigo_chamado: string } | null;
};

export type PDFItem = {
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  subtotal: number;
};

export function gerarOrcamentoPDF(
  orc: PDFOrcamento,
  itens: PDFItem[],
  empresa: { nome: string; cnpj: string | null }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  const NAVY: [number, number, number] = [11, 31, 66];
  const ORANGE: [number, number, number] = [238, 102, 22];
  const LIGHT_GRAY: [number, number, number] = [245, 245, 245];

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(empresa.nome, margin, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (empresa.cnpj) doc.text(`CNPJ: ${empresa.cnpj}`, margin, 18);
  doc.text("Gestão de Obra — Software de Gestão de Obras", margin, 23);
  doc.setFillColor(...ORANGE);
  doc.rect(0, 28, pageW, 3, "F");
  y = 38;

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PROPOSTA COMERCIAL", margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  const numOrc = orc.numero_orcamento ? `Nº ${orc.numero_orcamento}` : "";
  const dataFormatada = format(parseISO(orc.data_orcamento), "dd/MM/yyyy", { locale: ptBR });
  const dataValidade = format(addDays(parseISO(orc.data_orcamento), orc.validade_dias), "dd/MM/yyyy", { locale: ptBR });
  doc.text(`${numOrc}   Data: ${dataFormatada}   Válido até: ${dataValidade}`, margin, y);
  y += 4;
  if (orc.titulo) {
    doc.setFont("helvetica", "italic");
    doc.text(orc.titulo, margin, y);
    y += 4;
  }
  y += 4;

  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  if (orc.cliente_nome || orc.obras?.codigo_chamado) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("PARA:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    if (orc.cliente_nome) { doc.text(orc.cliente_nome, margin, y); y += 4; }
    if (orc.cliente_cnpj) { doc.text(`CNPJ: ${orc.cliente_cnpj}`, margin, y); y += 4; }
    if (orc.cliente_endereco) { doc.text(orc.cliente_endereco, margin, y); y += 4; }
    if (orc.obras?.codigo_chamado) { doc.text(`Referência: Obra ${orc.obras.codigo_chamado}`, margin, y); y += 4; }
    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("ITENS DE SERVIÇO", margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Un.", "Qtd.", "P. Unit.", "Desc.", "Total"]],
    body: itens.map((item) => [
      item.descricao,
      item.unidade,
      Number(item.quantidade).toLocaleString("pt-BR"),
      BRL(Number(item.preco_unitario)),
      Number(item.desconto_pct) > 0 ? `${item.desconto_pct}%` : "—",
      BRL(Number(item.subtotal)),
    ]),
    theme: "striped",
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: LIGHT_GRAY },
    margin: { left: margin, right: margin },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 5;

  const totalBruto = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
  const totalDesc = totalBruto - Number(orc.valor_orcamento);
  const colRight = pageW - margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Subtotal:", colRight - 60, y, { align: "right" });
  doc.text(BRL(totalBruto), colRight, y, { align: "right" });
  y += 5;
  if (totalDesc > 0.01) {
    doc.text("Desconto:", colRight - 60, y, { align: "right" });
    doc.setTextColor(238, 102, 22);
    doc.text(`- ${BRL(totalDesc)}`, colRight, y, { align: "right" });
    doc.setTextColor(80, 80, 80);
    y += 5;
  }
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(colRight - 80, y, colRight, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("TOTAL:", colRight - 60, y, { align: "right" });
  doc.setTextColor(...ORANGE);
  doc.text(BRL(Number(orc.valor_orcamento)), colRight, y, { align: "right" });
  y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  if (orc.condicoes_pagamento) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("Condições de pagamento:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(orc.condicoes_pagamento, margin + 52, y);
    y += 5;
  }
  if (orc.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("Observações:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(orc.observacoes, pageW - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 4;
  }

  const pageH = doc.internal.pageSize.getHeight();
  if (y + 35 > pageH - 20) { doc.addPage(); y = 20; } else y += 8;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.4);
  const col1 = margin;
  const col2 = pageW / 2 + 10;
  doc.line(col1, y, col1 + 75, y);
  doc.line(col2, y, col2 + 75, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Aprovação do cliente", col1, y);
  doc.text(empresa.nome, col2, y);
  y += 4;
  doc.text("Data: ___/___/______", col1, y);
  doc.text(dataFormatada, col2, y);

  doc.setFillColor(...NAVY);
  doc.rect(0, pageH - 10, pageW, 10, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("Gestão de Obra — Software de Gestão de Obras", pageW / 2, pageH - 4, { align: "center" });

  doc.save(`orcamento-${orc.numero_orcamento || "proposta"}-${format(new Date(), "yyyyMMdd")}.pdf`);
}
