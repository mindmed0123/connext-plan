import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace("R$", "").trim();

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
  cliente_email?: string | null;
  cliente_telefone?: string | null;
  valor_orcamento: number;
  codigo_chamado?: string | null;
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

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number; format: string } | null> {
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
    const fmt = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    return { dataUrl, w: dims.w, h: dims.h, format: fmt };
  } catch {
    return null;
  }
}

export async function gerarOrcamentoPDF(
  orc: PDFOrcamento,
  itens: PDFItem[],
  empresa: {
    nome: string;
    cnpj: string | null;
    inscricao_estadual?: string | null;
    endereco?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    telefone?: string | null;
    logo_url?: string | null;
  }
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Cores estilo do modelo
  const TEAL: [number, number, number] = [82, 196, 184];
  const TEAL_LIGHT: [number, number, number] = [225, 244, 241];
  const TEXT: [number, number, number] = [40, 40, 40];
  const MUTED: [number, number, number] = [110, 110, 110];

  // ====== CABEÇALHO ======
  let y = margin;

  // Logo (esquerda)
  let logoBottom = y;
  if (empresa.logo_url) {
    const logo = await loadImageDataUrl(empresa.logo_url);
    if (logo && logo.w > 0) {
      const maxW = 45;
      const maxH = 25;
      const ratio = logo.w / logo.h;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      try {
        doc.addImage(logo.dataUrl, logo.format, margin, y, w, h);
        logoBottom = y + h;
      } catch { /* ignore */ }
    }
  }

  // Nome da empresa (direita, bold)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text((empresa.nome || "").toUpperCase(), pageW - margin, y + 2, { align: "right" });

  // Dados empresa (direita, normais)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  let yh = y + 8;
  if (empresa.cnpj) { doc.text(`CNPJ: ${empresa.cnpj}`, pageW - margin, yh, { align: "right" }); yh += 4; }
  if (empresa.inscricao_estadual) { doc.text(`Inscrição Estadual: ${empresa.inscricao_estadual}`, pageW - margin, yh, { align: "right" }); yh += 4; }
  yh += 1;
  if (empresa.endereco) { doc.text(empresa.endereco, pageW - margin, yh, { align: "right" }); yh += 4; }
  if (empresa.bairro) { doc.text(empresa.bairro, pageW - margin, yh, { align: "right" }); yh += 4; }
  const cidLinha = [empresa.cidade, empresa.uf].filter(Boolean).join(" - ") + (empresa.cep ? ` - CEP: ${empresa.cep}` : "");
  if (cidLinha.trim()) { doc.text(cidLinha, pageW - margin, yh, { align: "right" }); yh += 4; }
  if (empresa.telefone) { doc.text(`Telefone: ${empresa.telefone}`, pageW - margin, yh, { align: "right" }); yh += 4; }

  y = Math.max(yh, logoBottom, y + 28) + 4;

  // ====== TÍTULO ORÇAMENTO ======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TEXT);
  const numero = orc.numero_orcamento ? orc.numero_orcamento.replace(/^ORC-?/i, "") : "—";
  doc.text(`Orçamento Nº ${numero}`, margin, y);
  y += 8;

  // ====== INFORMAÇÕES DO CLIENTE ======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Informações do Cliente", margin, y);
  y += 7;

  if (orc.cliente_nome) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(orc.cliente_nome.toUpperCase(), margin, y);
    y += 6;
  }

  // Duas colunas: esquerda CNPJ/email, direita endereço/telefone
  const colL = margin;
  const colR = pageW / 2 + 5;
  let yL = y;
  let yR = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);

  if (orc.cliente_cnpj) { doc.text(`CNPJ: ${orc.cliente_cnpj}`, colL, yL); yL += 5; }
  if (orc.cliente_email) {
    yL += 2;
    doc.setFont("helvetica", "bold");
    doc.text(orc.cliente_email, colL, yL);
    doc.setFont("helvetica", "normal");
    yL += 5;
  }

  if (orc.cliente_endereco) {
    const enderecoLines = doc.splitTextToSize(orc.cliente_endereco, pageW / 2 - margin - 5);
    doc.text(enderecoLines, colR, yR);
    yR += enderecoLines.length * 5;
  }
  if (orc.cliente_telefone) {
    doc.setFont("helvetica", "bold");
    doc.text(`Telefone: ${orc.cliente_telefone}`, colR, yR);
    doc.setFont("helvetica", "normal");
    yR += 5;
  }

  y = Math.max(yL, yR) + 6;

  // ====== LISTA DE SERVIÇOS ======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text("Lista dos Serviços", margin, y);
  y += 4;

  const totalBruto = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0);
  const totalDesc = totalBruto - Number(orc.valor_orcamento);

  autoTable(doc, {
    startY: y,
    head: [["Descrição do Serviço", "Quantidade", "Valor Unit. (R$)", "Valor Total (R$)"]],
    body: itens.map((item) => [
      item.descricao,
      Number(item.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      BRL(Number(item.preco_unitario)),
      BRL(Number(item.subtotal)),
    ]),
    foot: [
      [
        { content: "Total:", colSpan: 3, styles: { halign: "right", fontStyle: "bold", fillColor: TEAL_LIGHT, textColor: TEXT } },
        { content: BRL(Number(orc.valor_orcamento)), styles: { halign: "right", fontStyle: "bold", fillColor: TEAL_LIGHT, textColor: TEXT } },
      ],
      [
        { content: "Total do ISS:", colSpan: 3, styles: { halign: "right", fontStyle: "bold", fillColor: TEAL_LIGHT, textColor: TEXT } },
        { content: BRL(0), styles: { halign: "right", fontStyle: "bold", fillColor: TEAL_LIGHT, textColor: TEXT } },
      ],
    ],
    theme: "plain",
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    bodyStyles: { fontSize: 9, textColor: TEXT, fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: TEAL_LIGHT },
    columnStyles: {
      0: { cellWidth: "auto", halign: "left" },
      1: { cellWidth: 28, halign: "right" },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // ====== VENCIMENTOS ======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...TEXT);
  doc.text("Vencimentos", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const vencW = doc.getTextWidth("Vencimentos");
  doc.text(orc.condicoes_pagamento || "A Vista", margin + vencW + 4, y - 0.5);
  y += 4;

  const dataVenc = format(addDays(parseISO(orc.data_orcamento), orc.validade_dias || 0), "dd/MM/yyyy", { locale: ptBR });
  autoTable(doc, {
    startY: y,
    body: [
      ["Parcela", "1"],
      ["Vencimento", dataVenc],
      ["Valor (R$)", BRL(Number(orc.valor_orcamento))],
    ],
    theme: "plain",
    styles: { fontSize: 9, textColor: TEXT },
    columnStyles: {
      0: { cellWidth: 30, halign: "right", fontStyle: "bold", fillColor: TEAL_LIGHT },
      1: { cellWidth: 30, halign: "right", fillColor: TEAL_LIGHT },
    },
    margin: { left: margin },
    tableWidth: 60,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ====== OUTRAS INFORMAÇÕES ======
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Outras Informações", margin, y);
  y += 7;

  const dataIncl = format(parseISO(orc.data_orcamento), "dd/MM/yyyy", { locale: ptBR });
  const horaIncl = format(new Date(), "HH:mm:ss", { locale: ptBR });
  doc.setFontSize(9);
  const labelCol = margin;
  const valueCol = margin + 55;

  doc.setFont("helvetica", "bold");
  doc.text("Orçamento - incluído em:", labelCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${dataIncl} às ${horaIncl}`, valueCol, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Previsão de Faturamento:", labelCol, y);
  doc.setFont("helvetica", "normal");
  doc.text(dataVenc, valueCol, y);
  y += 8;

  const chamadoLabel = orc.codigo_chamado || orc.obras?.codigo_chamado || "";
  if (chamadoLabel) {
    doc.setFont("helvetica", "bold");
    doc.text("CHAMADOS:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const linhaChamado = orc.titulo ? `${chamadoLabel} - ${orc.titulo}` : chamadoLabel;
    const linhas = doc.splitTextToSize(linhaChamado, pageW - margin * 2);
    doc.text(linhas, margin, y);
    y += linhas.length * 5 + 2;
  }

  if (orc.observacoes) {
    y += 3;
    const obsLines = doc.splitTextToSize(orc.observacoes, pageW - margin * 2);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 5;
  }

  // ====== RODAPÉ ======
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  doc.text(`Gerado em ${geradoEm}`, pageW / 2, pageH - 14, { align: "center" });
  doc.text("Página 1 de 1", pageW / 2, pageH - 9, { align: "center" });

  doc.save(`orcamento-${orc.numero_orcamento || "proposta"}-${format(new Date(), "yyyyMMdd")}.pdf`);
}
