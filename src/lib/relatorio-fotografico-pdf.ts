import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type PDFRelatorioFoto = {
  imagem_url: string;
  observacao: string | null;
  tipo: string;
  data_upload: string;
};

export type PDFRelatorioObra = {
  codigo_chamado: string;
  descricao_servico: string | null;
  endereco: string | null;
};

export type PDFRelatorioEmpresa = {
  nome: string;
  logo_url?: string | null;
};

async function loadImage(
  url: string,
): Promise<{ dataUrl: string; w: number; h: number; format: string } | null> {
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
    const fmt = blob.type.includes("png")
      ? "PNG"
      : blob.type.includes("webp")
        ? "WEBP"
        : "JPEG";
    return { dataUrl, w: dims.w, h: dims.h, format: fmt };
  } catch {
    return null;
  }
}

const TIPO_LABEL: Record<string, string> = {
  antes: "Antes",
  durante: "Durante",
  depois: "Depois",
};

export async function gerarRelatorioFotograficoPDF(
  empresa: PDFRelatorioEmpresa,
  obra: PDFRelatorioObra,
  fotos: PDFRelatorioFoto[],
  opts: { numeroRelatorio: number; dataRelatorio: Date },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  const logo = empresa.logo_url ? await loadImage(empresa.logo_url) : null;

  const dataFmt = format(opts.dataRelatorio, "dd/MM/yyyy", { locale: ptBR });
  const diaSemana = format(opts.dataRelatorio, "EEEE", { locale: ptBR });
  const diaSemanaFmt = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  // Pré-carrega todas as fotos em paralelo
  const imagens = await Promise.all(fotos.map((f) => loadImage(f.imagem_url)));

  // ---- Cabeçalho (aplicado em toda página) ----
  const drawHeader = () => {
    const headerH = 14;
    // faixa fininha superior
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(margin, headerH + 2, pageW - margin, headerH + 2);

    // logo à esquerda
    if (logo && logo.w > 0) {
      const maxH = 10;
      const maxW = 40;
      const ratio = logo.w / logo.h;
      let h = maxH;
      let w = h * ratio;
      if (w > maxW) {
        w = maxW;
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
    doc.text(
      `Relatório ${dataFmt} n° ${opts.numeroRelatorio}`,
      pageW - margin,
      10,
      { align: "right" },
    );
  };

  const drawFooter = (page: number, total: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`${page} / ${total}`, pageW - margin, pageH - 6, {
      align: "right",
    });
  };

  // ---- Página 1: capa/tabela ----
  drawHeader();

  let y = 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30);
  doc.text("Relatório de Obra", margin, y);
  y += 8;

  // Tabela header
  const tableX = margin;
  const tableW = pageW - margin * 2;
  const rowH = 9;

  const drawCell = (
    x: number,
    yy: number,
    w: number,
    h: number,
    label: string,
    value: string,
  ) => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text(label.toUpperCase(), x + 2, yy + 3.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(value || "—", w - 4);
    doc.text(lines, x + 2, yy + 6.8);
  };

  const col1 = tableW * 0.33;
  const col2 = tableW * 0.34;
  const col3 = tableW * 0.33;
  drawCell(tableX, y, col1, rowH, "Relatório n°", String(opts.numeroRelatorio));
  drawCell(tableX + col1, y, col2, rowH, "Data do relatório", dataFmt);
  drawCell(tableX + col1 + col2, y, col3, rowH, "Dia da semana", diaSemanaFmt);
  y += rowH;
  drawCell(tableX, y, tableW, rowH + 2, "Obra", obra.codigo_chamado);
  y += rowH + 2;
  if (obra.descricao_servico) {
    drawCell(tableX, y, tableW, rowH + 2, "Descrição", obra.descricao_servico);
    y += rowH + 2;
  }
  if (obra.endereco) {
    drawCell(tableX, y, tableW, rowH + 2, "Endereço", obra.endereco);
    y += rowH + 2;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Fotos (${fotos.length})`, margin, y);
  y += 4;

  // ---- Grid de fotos (2x2 por página) ----
  const gridStartY = y;
  const gutter = 6;
  const cellsPerRow = 2;
  const rowsPerPage = 2;
  const cellW = (pageW - margin * 2 - gutter * (cellsPerRow - 1)) / cellsPerRow;
  const availableH = pageH - gridStartY - 14;
  const cellH = (availableH - gutter * (rowsPerPage - 1)) / rowsPerPage;
  const captionH = 14;
  const imgH = cellH - captionH;

  const drawPhoto = (
    idx: number,
    col: number,
    row: number,
    baseY: number,
  ) => {
    const foto = fotos[idx];
    const img = imagens[idx];
    const x = margin + col * (cellW + gutter);
    const yy = baseY + row * (cellH + gutter);

    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.rect(x, yy, cellW, cellH);

    if (img && img.w > 0) {
      const ratio = img.w / img.h;
      let iw = cellW - 2;
      let ih = iw / ratio;
      if (ih > imgH - 2) {
        ih = imgH - 2;
        iw = ih * ratio;
      }
      const ix = x + (cellW - iw) / 2;
      const iy = yy + 1 + (imgH - ih) / 2;
      try {
        doc.addImage(img.dataUrl, img.format, ix, iy, iw, ih);
      } catch {
        // se falhar, ignora
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text("(imagem indisponível)", x + cellW / 2, yy + imgH / 2, {
        align: "center",
      });
    }

    // Caption
    const cy = yy + imgH + 3;
    const caption =
      foto.observacao?.trim() ||
      `${TIPO_LABEL[foto.tipo] || "Foto"}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40);
    const cLines = doc.splitTextToSize(caption, cellW - 4);
    doc.text(cLines.slice(0, 2), x + 2, cy);

    // Data
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    const dataUpload = new Date(foto.data_upload);
    const dtFmt = format(dataUpload, "dd 'de' MMM. 'de' yyyy HH:mm:ss", {
      locale: ptBR,
    });
    doc.text(dtFmt, x + 2, yy + cellH - 2);
  };

  const perPage = cellsPerRow * rowsPerPage;
  let idx = 0;
  let currentBaseY = gridStartY;

  // Página 1: coloca até `perPage` fotos abaixo do cabeçalho/tabela
  const firstPageAvailH = pageH - currentBaseY - 14;
  const firstPageCellH =
    (firstPageAvailH - gutter * (rowsPerPage - 1)) / rowsPerPage;
  const firstImgH = firstPageCellH - captionH;

  const drawPhotoOn = (
    i: number,
    col: number,
    row: number,
    baseY: number,
    localCellH: number,
    localImgH: number,
  ) => {
    const foto = fotos[i];
    const img = imagens[i];
    const x = margin + col * (cellW + gutter);
    const yy = baseY + row * (localCellH + gutter);

    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.rect(x, yy, cellW, localCellH);

    if (img && img.w > 0) {
      const ratio = img.w / img.h;
      let iw = cellW - 2;
      let ih = iw / ratio;
      if (ih > localImgH - 2) {
        ih = localImgH - 2;
        iw = ih * ratio;
      }
      const ix = x + (cellW - iw) / 2;
      const iy = yy + 1 + (localImgH - ih) / 2;
      try {
        doc.addImage(img.dataUrl, img.format, ix, iy, iw, ih);
      } catch {
        // ignore
      }
    }

    const cy = yy + localImgH + 3;
    const caption =
      foto.observacao?.trim() || TIPO_LABEL[foto.tipo] || "Foto";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40);
    const cLines = doc.splitTextToSize(caption, cellW - 4);
    doc.text(cLines.slice(0, 2), x + 2, cy);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    const dataUpload = new Date(foto.data_upload);
    const dtFmt = format(dataUpload, "dd 'de' MMM. 'de' yyyy HH:mm:ss", {
      locale: ptBR,
    });
    doc.text(dtFmt, x + 2, yy + localCellH - 2);
  };

  // Página 1
  for (let i = 0; i < perPage && idx < fotos.length; i++, idx++) {
    const col = i % cellsPerRow;
    const row = Math.floor(i / cellsPerRow);
    drawPhotoOn(idx, col, row, currentBaseY, firstPageCellH, firstImgH);
  }

  // Páginas seguintes: 4 fotos por página, área cheia
  while (idx < fotos.length) {
    doc.addPage();
    drawHeader();
    const pageBaseY = 20;
    const pageAvailH = pageH - pageBaseY - 14;
    const pCellH = (pageAvailH - gutter * (rowsPerPage - 1)) / rowsPerPage;
    const pImgH = pCellH - captionH;
    for (let i = 0; i < perPage && idx < fotos.length; i++, idx++) {
      const col = i % cellsPerRow;
      const row = Math.floor(i / cellsPerRow);
      drawPhotoOn(idx, col, row, pageBaseY, pCellH, pImgH);
    }
  }

  // Assinaturas na última página (se couber, senão nova página)
  const lastY = pageH - 20;
  doc.setDrawColor(80);
  doc.setLineWidth(0.3);
  const sigW = 70;
  const sig1X = margin + 10;
  const sig2X = pageW - margin - sigW - 10;
  doc.line(sig1X, lastY, sig1X + sigW, lastY);
  doc.line(sig2X, lastY, sig2X + sigW, lastY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("Assinatura", sig1X + sigW / 2, lastY + 4, { align: "center" });
  doc.text("Assinatura", sig2X + sigW / 2, lastY + 4, { align: "center" });

  // Numeração de páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(p, total);
  }

  const fileName = `Relatorio-${obra.codigo_chamado}-${format(opts.dataRelatorio, "dd-MM-yyyy")}.pdf`;
  doc.save(fileName);
}
