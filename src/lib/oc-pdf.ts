import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { hexToRgb, lighten } from "@/lib/color";
import { formatDateBR } from "@/lib/date";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace("R$", "").trim();

export type PDFEmpresaOC = {
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  cor_primaria?: string | null;
  texto_rodape?: string | null;
};

export type PDFOrdemCompra = {
  numero: string | null;
  data: string;
  condicao_pagamento?: string | null;
  prazo_entrega?: string | null;
  observacoes?: string | null;
  frete?: number | null;
  valor_total: number;
  fornecedor?: { nome: string; cnpj_cpf?: string | null; telefone?: string | null; email?: string | null } | null;
  obra?: { codigo_chamado?: string | null; descricao_servico?: string | null } | null;
};

export type PDFItemOC = {
  descricao: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

async function loadImageDataUrl(url: string) {
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

export async function gerarOrdemCompraPDF(
  oc: PDFOrdemCompra,
  itens: PDFItemOC[],
  empresa: PDFEmpresaOC,
  rotuloObra = "Obra",
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  const COR: [number, number, number] = hexToRgb(empresa.cor_primaria ?? "", [82, 196, 184]);
  const COR_CLARA: [number, number, number] = lighten(COR, 0.86);
  const TEXT: [number, number, number] = [40, 40, 40];
  const MUTED: [number, number, number] = [110, 110, 110];

  let y = margin;

  if (empresa.logo_url) {
    const logo = await loadImageDataUrl(empresa.logo_url);
    if (logo && logo.w > 0) {
      const maxW = 42;
      const maxH = 20;
      const escala = Math.min(maxW / logo.w, maxH / logo.h);
      doc.addImage(logo.dataUrl, logo.format, margin, y, logo.w * escala, logo.h * escala);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COR);
  doc.text("ORDEM DE COMPRA", pageW - margin, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Nº ${oc.numero ?? "—"}`, pageW - margin, y + 12, { align: "right" });
  doc.text(`Data: ${formatDateBR(oc.data)}`, pageW - margin, y + 17, { align: "right" });

  y += 26;

  const linhasEmpresa = [
    empresa.nome,
    empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : null,
    [empresa.endereco, empresa.bairro].filter(Boolean).join(", ") || null,
    [[empresa.cidade, empresa.uf].filter(Boolean).join("/"), empresa.cep].filter(Boolean).join(" - ") || null,
    [empresa.telefone, empresa.email].filter(Boolean).join(" • ") || null,
  ].filter(Boolean) as string[];

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  linhasEmpresa.forEach((l, i) => doc.text(l, margin, y + i * 4.2));
  y += linhasEmpresa.length * 4.2 + 6;

  // Bloco fornecedor / obra
  const boxH = 26;
  doc.setFillColor(...COR_CLARA);
  doc.rect(margin, y, pageW - margin * 2, boxH, "F");
  doc.setTextColor(...TEXT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("FORNECEDOR", margin + 3, y + 6);
  doc.text(rotuloObra.toUpperCase(), pageW / 2 + 3, y + 6);
  doc.setFont("helvetica", "normal");
  const forn = [
    oc.fornecedor?.nome ?? "—",
    oc.fornecedor?.cnpj_cpf ? `CNPJ/CPF: ${oc.fornecedor.cnpj_cpf}` : null,
    [oc.fornecedor?.telefone, oc.fornecedor?.email].filter(Boolean).join(" • ") || null,
  ].filter(Boolean) as string[];
  forn.forEach((l, i) => doc.text(String(l).slice(0, 55), margin + 3, y + 11.5 + i * 4.3));
  const obraTxt = [
    oc.obra?.codigo_chamado ?? "—",
    (oc.obra?.descricao_servico ?? "").slice(0, 50) || null,
  ].filter(Boolean) as string[];
  obraTxt.forEach((l, i) => doc.text(String(l), pageW / 2 + 3, y + 11.5 + i * 4.3));

  y += boxH + 6;

  autoTable(doc, {
    startY: y,
    head: [["#", "Descrição", "Un.", "Qtd.", "Preço unit.", "Subtotal"]],
    body: itens.map((it, i) => [
      String(i + 1),
      it.descricao,
      it.unidade,
      Number(it.quantidade).toLocaleString("pt-BR"),
      BRL(Number(it.preco_unitario)),
      BRL(Number(it.subtotal)),
    ]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: TEXT },
    headStyles: { fillColor: COR, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 249, 249] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 27, halign: "right" },
      5: { cellWidth: 29, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  const subtotal = itens.reduce((s, i) => s + Number(i.subtotal), 0);
  const frete = Number(oc.frete ?? 0);
  const linhasTotais: [string, string][] = [["Subtotal", BRL(subtotal)]];
  if (frete > 0) linhasTotais.push(["Frete", BRL(frete)]);
  linhasTotais.push(["TOTAL", BRL(Number(oc.valor_total))]);

  doc.setFontSize(10);
  linhasTotais.forEach(([rot, val], i) => {
    const yy = y + i * 6;
    const negrito = rot === "TOTAL";
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setTextColor(...(negrito ? COR : TEXT));
    doc.text(rot, pageW - margin - 45, yy, { align: "right" });
    doc.text(val, pageW - margin, yy, { align: "right" });
  });
  y += linhasTotais.length * 6 + 6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  doc.setFontSize(9);
  const info = [
    oc.condicao_pagamento ? `Condição de pagamento: ${oc.condicao_pagamento}` : null,
    oc.prazo_entrega ? `Prazo de entrega: ${oc.prazo_entrega}` : null,
    oc.observacoes ? `Observações: ${oc.observacoes}` : null,
  ].filter(Boolean) as string[];
  info.forEach((l) => {
    const partes = doc.splitTextToSize(l, pageW - margin * 2);
    doc.text(partes, margin, y);
    y += partes.length * 4.5 + 1;
  });

  y += 12;
  doc.setDrawColor(...MUTED);
  doc.line(margin, y, margin + 65, y);
  doc.line(pageW - margin - 65, y, pageW - margin, y);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Autorizado por", margin, y + 4);
  doc.text("Fornecedor (ciente)", pageW - margin - 65, y + 4);

  if (empresa.texto_rodape) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const rod = doc.splitTextToSize(empresa.texto_rodape, pageW - margin * 2);
    doc.text(rod, pageW / 2, pageH - 10, { align: "center" });
  }

  doc.save(`ordem-compra-${(oc.numero ?? "sn").replace(/\W+/g, "-")}.pdf`);
}
