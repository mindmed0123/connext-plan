import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { hexToRgb } from "@/lib/color";
import type { PDFRelatorioEmpresa, PDFRelatorioObra } from "@/lib/relatorio-fotografico-pdf";

export const CLIMA_LABEL: Record<string, string> = {
  sol: "Sol",
  nublado: "Nublado",
  chuva_fraca: "Chuva fraca",
  chuva_forte: "Chuva forte",
};

export type RdoEfetivo = { funcao: string; quantidade: number };
export type RdoEquipamento = { nome: string; quantidade: number };

export type RdoPDFItem = {
  data_envio: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  condicao_trabalho: string;
  efetivo: RdoEfetivo[];
  equipamentos: RdoEquipamento[];
  atividades_executadas: string | null;
  ocorrencias: string | null;
  observacoes: string | null;
  status: string;
  responsavel_nome?: string | null;
  fotos: { imagem_url: string; observacao: string | null }[];
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
    const fmt = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    return { dataUrl, w: dims.w, h: dims.h, format: fmt };
  } catch {
    return null;
  }
}

function dataBR(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return format(new Date(a, (m ?? 1) - 1, d ?? 1), "dd/MM/yyyy", { locale: ptBR });
}

export async function gerarRelatorioDiarioPDF(
  empresa: PDFRelatorioEmpresa,
  obra: PDFRelatorioObra,
  itens: RdoPDFItem[],
  periodo: { de: string; ate: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const cor = hexToRgb(empresa.cor_primaria ?? "", [82, 196, 184]);

  const logo = empresa.logo_url ? await loadImage(empresa.logo_url) : null;

  // pré-carrega fotos
  const fotosCache = new Map<string, Awaited<ReturnType<typeof loadImage>>>();
  await Promise.all(
    itens.flatMap((i) =>
      i.fotos.map(async (f) => {
        fotosCache.set(f.imagem_url, await loadImage(f.imagem_url));
      }),
    ),
  );

  const dadosEmpresa = [
    empresa.cnpj ? `CNPJ: ${empresa.cnpj}` : null,
    [empresa.endereco, [empresa.cidade, empresa.uf].filter(Boolean).join(" - ")].filter(Boolean).join(" — ") || null,
    [empresa.telefone, empresa.email].filter(Boolean).join(" | ") || null,
  ]
    .filter(Boolean)
    .join("  •  ");

  const drawHeader = () => {
    if (logo && logo.w > 0) {
      const ratio = logo.w / logo.h;
      let h = 10;
      let w = h * ratio;
      if (w > 40) {
        w = 40;
        h = w / ratio;
      }
      doc.addImage(logo.dataUrl, logo.format, margin, 4, w, h);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(empresa.nome, margin, 10);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Diário de obra — ${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`, pageW - margin, 10, { align: "right" });
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(margin, 16, pageW - margin, 16);
  };

  const drawFooter = () => {
    doc.setDrawColor(cor[0], cor[1], cor[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140);
    if (dadosEmpresa) doc.text(dadosEmpresa, margin, pageH - 8);
    const rodape = (empresa.texto_rodape ?? "").trim();
    if (rodape) doc.text(rodape, margin, pageH - 4.5);
  };

  let y = 0;
  const novaPagina = (primeira = false) => {
    if (!primeira) doc.addPage();
    drawHeader();
    y = 22;
  };
  const garanteEspaco = (h: number) => {
    if (y + h > pageH - 16) novaPagina();
  };

  novaPagina(true);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30);
  doc.text("Relatório Diário de Obra", margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  doc.text(`Obra: ${obra.codigo_chamado}${obra.descricao_servico ? ` — ${obra.descricao_servico}` : ""}`, margin, y);
  y += 5;
  if (obra.endereco) {
    doc.text(obra.endereco, margin, y);
    y += 5;
  }
  y += 3;

  const bloco = (titulo: string, texto: string) => {
    if (!texto.trim()) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90);
    garanteEspaco(10);
    doc.text(titulo, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    const linhas = doc.splitTextToSize(texto, pageW - margin * 2);
    for (const l of linhas) {
      garanteEspaco(5);
      doc.text(l, margin, y);
      y += 4.4;
    }
    y += 2;
  };

  for (const item of itens) {
    garanteEspaco(30);
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.rect(margin, y, pageW - margin * 2, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(dataBR(item.data_envio), margin + 2, y + 4.8);
    doc.setFontSize(8);
    doc.text(
      `${item.condicao_trabalho === "impraticavel" ? "Dia impraticável" : "Dia praticável"} • ${item.status}`,
      pageW - margin - 2,
      y + 4.8,
      { align: "right" },
    );
    y += 11;
    doc.setTextColor(30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const clima = `Clima — manhã: ${CLIMA_LABEL[item.clima_manha ?? ""] ?? "—"} | tarde: ${CLIMA_LABEL[item.clima_tarde ?? ""] ?? "—"}`;
    doc.text(clima, margin, y);
    y += 5;
    if (item.responsavel_nome) {
      doc.text(`Responsável: ${item.responsavel_nome}`, margin, y);
      y += 5;
    }
    const efetivo = (item.efetivo ?? []).filter((e) => e.funcao).map((e) => `${e.quantidade}× ${e.funcao}`).join(", ");
    const equip = (item.equipamentos ?? []).filter((e) => e.nome).map((e) => `${e.quantidade}× ${e.nome}`).join(", ");
    bloco("Efetivo", efetivo);
    bloco("Equipamentos", equip);
    bloco("Atividades executadas", item.atividades_executadas ?? "");
    bloco("Ocorrências", item.ocorrencias ?? "");
    bloco("Observações", item.observacoes ?? "");

    // fotos do dia — 2 por linha
    if (item.fotos.length > 0) {
      const gutter = 5;
      const cellW = (pageW - margin * 2 - gutter) / 2;
      const imgH = 42;
      const cellH = imgH + 8;
      for (let i = 0; i < item.fotos.length; i += 2) {
        garanteEspaco(cellH + 2);
        for (let c = 0; c < 2; c++) {
          const foto = item.fotos[i + c];
          if (!foto) break;
          const img = fotosCache.get(foto.imagem_url) ?? null;
          const x = margin + c * (cellW + gutter);
          doc.setDrawColor(220);
          doc.setLineWidth(0.2);
          doc.rect(x, y, cellW, cellH);
          if (img && img.w > 0) {
            const ratio = img.w / img.h;
            let iw = cellW - 2;
            let ih = iw / ratio;
            if (ih > imgH - 2) {
              ih = imgH - 2;
              iw = ih * ratio;
            }
            try {
              doc.addImage(img.dataUrl, img.format, x + (cellW - iw) / 2, y + 1 + (imgH - ih) / 2, iw, ih);
            } catch {
              /* ignora imagem inválida */
            }
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(110);
          const cap = doc.splitTextToSize(foto.observacao ?? "", cellW - 4);
          doc.text(cap.slice(0, 1), x + 2, y + imgH + 4);
          doc.setTextColor(30);
        }
        y += cellH + 2;
      }
    }
    y += 4;
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter();
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`${p} / ${total}`, pageW - margin, pageH - 6, { align: "right" });
  }

  doc.save(`RDO-${obra.codigo_chamado}-${periodo.de}_${periodo.ate}.pdf`);
}
