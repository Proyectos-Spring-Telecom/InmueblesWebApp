import type { RentRolRow } from './rent-rol-list.mapper';

/** Colores de marca / sistema + estatus del grid rent-rol. */
const BRAND = {
  azul: 'FF001C6A',
  vino: 'FF681330',
  blanco: 'FFFFFFFF',
  negro: 'FF0F172A',
  muted: 'FF64748B',
  border: 'FFCBD5E1',
  /** Pagada — tinte del grid (#4ade80 / rgba 127,226,163) */
  pagada: 'FFE6F7EC',
  pagadaTexto: 'FF16A34A',
  /** Incremento — tinte del grid (#fa8072) */
  incremento: 'FFFDECEA',
  incrementoTexto: 'FFE11D48',
} as const;

const FONT_XLS = 'Calibri';
/** Solo celdas de la tabla (encabezados + filas de datos). */
const FONT_COLS = 'Arial';
const MONEY_FMT = '_-"$"* #,##0.00_-;-"$"* #,##0.00_-;_-"$"* "-"??_-;_-@_-';

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** Margen lateral único del PDF (mm) — header Spring / cards / tabla. */
const PDF_MARGIN = 14;
const PDF_HEADER_H = 40;
const PDF_HEADER_GAP = 8;
const PDF_LOGO_PATH = 'assets/images/logos/spring_white.png';

const PDF_BRAND = {
  ink: [15, 23, 42] as [number, number, number], // #0f172a
  primary: [139, 26, 61] as [number, number, number], // #8b1a3d
  soft: [252, 231, 243] as [number, number, number], // #fce7f3
  white: [255, 255, 255] as [number, number, number],
};

export interface RentRolExportInput {
  rows: RentRolRow[];
  fechaInicio: string;
  fechaFin: string;
  titulo?: string;
}

type EstatusExport = 'pagada' | 'incremento' | 'neutral';

function thinBorder(color: string = BRAND.border): {
  top: { style: 'thin'; color: { argb: string } };
  left: { style: 'thin'; color: { argb: string } };
  bottom: { style: 'thin'; color: { argb: string } };
  right: { style: 'thin'; color: { argb: string } };
} {
  const side = { style: 'thin' as const, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function redondear(n: number): number {
  return Math.round((n || 0) * 100) / 100;
}

function mesPeriodoLabel(fechaInicio: string, fechaFin: string): string {
  const base = (fechaFin || fechaInicio || '').trim();
  const m = /^(\d{4})-(\d{2})/.exec(base);
  if (!m) return 'Periodo';
  const idx = Number(m[2]) - 1;
  const anio = m[1];
  return `${MESES_ES[idx] ?? 'Periodo'} ${anio}`;
}

function nombreHoja(fechaInicio: string, fechaFin: string): string {
  return mesPeriodoLabel(fechaInicio, fechaFin).toUpperCase().slice(0, 31);
}

function formatearFechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || '').trim());
  if (!m) return iso || '—';
  const meses = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}`;
}

function formatearFechaSlash(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso || '').trim());
  if (!m) return iso || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fitImage(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const ratio = naturalW / Math.max(naturalH, 0.0001);
  let width = maxW;
  let height = width / ratio;
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return { width, height };
}

async function loadImageDataUrl(
  path: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`No se pudo cargar ${path}`));
      el.src = path;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      w: canvas.width,
      h: canvas.height,
    };
  } catch {
    return null;
  }
}

function estatusDeFila(row: RentRolRow): EstatusExport {
  if (row.tieneIncrementoRenta || row.tieneIncrementoMantenimiento) return 'incremento';
  if (row.pagada) return 'pagada';
  return 'neutral';
}

function fillArgb(estatus: EstatusExport): string {
  if (estatus === 'pagada') return BRAND.pagada;
  if (estatus === 'incremento') return BRAND.incremento;
  return BRAND.blanco;
}

function pisoDeFila(row: RentRolRow): string {
  return (row.zona || row.inmueble || '—').trim() || '—';
}

function rgbFromArgb(argb: string): [number, number, number] {
  const hex = argb.replace(/^FF/i, '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function totalesDesdeRows(rows: RentRolRow[]) {
  let subRenta = 0;
  let ivaRenta = 0;
  let totRenta = 0;
  let subMant = 0;
  let ivaMant = 0;
  let totMant = 0;
  for (const row of rows) {
    subRenta += row.renta.subTotal;
    ivaRenta += row.renta.iva;
    totRenta += row.renta.montoFinal;
    subMant += row.mantenimiento.subTotal;
    ivaMant += row.mantenimiento.iva;
    totMant += row.mantenimiento.montoFinal;
  }
  return {
    subRenta: redondear(subRenta),
    ivaRenta: redondear(ivaRenta),
    totRenta: redondear(totRenta),
    subMant: redondear(subMant),
    ivaMant: redondear(ivaMant),
    totMant: redondear(totMant),
    granTotal: redondear(totRenta + totMant),
    subCombinado: redondear(subRenta + subMant),
    ivaCombinado: redondear(ivaRenta + ivaMant),
  };
}

function moneyMx(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function fmtNum(n: number): string {
  return (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Tres cards del mismo ancho en PNG (no altera anchos de columna del sheet). */
function renderKpiCardsPng(
  cards: Array<{ label: string; value: string; hint: string; fill: string; accent: string }>,
): { base64: string; width: number; height: number } {
  const scale = 2;
  const gap = 14;
  const cardW = 300;
  const cardH = 78;
  const pad = 14;
  const totalW = cardW * 3 + gap * 2;
  const canvas = document.createElement('canvas');
  canvas.width = totalW * scale;
  canvas.height = cardH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { base64: '', width: totalW, height: cardH };
  }
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, totalW, cardH);

  const hex = (argb: string) => `#${argb.replace(/^FF/i, '').slice(0, 6)}`;

  cards.forEach((card, i) => {
    const x = i * (cardW + gap);
    const r = 6;
    ctx.fillStyle = hex(card.fill);
    ctx.strokeStyle = hex(card.accent);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x + r, 0.5);
    ctx.arcTo(x + cardW - 0.5, 0.5, x + cardW - 0.5, cardH - 0.5, r);
    ctx.arcTo(x + cardW - 0.5, cardH - 0.5, x + 0.5, cardH - 0.5, r);
    ctx.arcTo(x + 0.5, cardH - 0.5, x + 0.5, 0.5, r);
    ctx.arcTo(x + 0.5, 0.5, x + cardW - 0.5, 0.5, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hex(card.accent);
    ctx.fillRect(x + 1, 8, 4, cardH - 16);

    ctx.fillStyle = hex(card.accent);
    ctx.font = 'bold 11px Calibri, Arial, sans-serif';
    ctx.fillText(card.label.toUpperCase(), x + pad, 22);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 20px Calibri, Arial, sans-serif';
    ctx.fillText(card.value, x + pad, 48);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px Calibri, Arial, sans-serif';
    ctx.fillText(card.hint, x + pad, 66);
  });

  const dataUrl = canvas.toDataURL('image/png');
  return {
    base64: dataUrl.replace(/^data:image\/png;base64,/, ''),
    width: totalW,
    height: cardH,
  };
}

// ═══════════════════════════════════════════════════════════════
//  EXCEL
// ═══════════════════════════════════════════════════════════════

export async function exportarRentRolExcel(input: RentRolExportInput): Promise<void> {
  const ExcelJS = await import('exceljs');
  const { saveAs } = await import('file-saver');

  const rows = input.rows;
  const titulo = (input.titulo || 'Rent Rol').trim();
  const periodo = mesPeriodoLabel(input.fechaInicio, input.fechaFin);
  const tot = totalesDesdeRows(rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'InmueblesWebApp';
  const ws = wb.addWorksheet(nombreHoja(input.fechaInicio, input.fechaFin), {
    views: [{ state: 'normal', showGridLines: false, zoomScale: 85, activeCell: 'B13' }],
    properties: { defaultRowHeight: 16 },
  });

  // A = margen; B–L = header, cards y grid (mismo borde). Sin tocar anchos de más.
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 46;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 20;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 14;
  ws.getColumn(7).width = 14;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 12;
  ws.getColumn(10).width = 14;
  ws.getColumn(11).width = 16;
  ws.getColumn(12).width = 16;

  const paintRange = (r1: number, c1: number, r2: number, c2: number, argb: string) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        ws.getRow(r).getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb },
        };
      }
    }
  };

  // ── Banner marca ─────────────────────────────────────────────
  paintRange(1, 2, 1, 12, BRAND.azul);
  ws.getRow(1).height = 8;
  paintRange(2, 2, 3, 12, BRAND.azul);
  ws.mergeCells('B2:H3');
  const titleCell = ws.getCell('B2');
  titleCell.value = titulo.toUpperCase();
  titleCell.font = { name: FONT_XLS, size: 18, bold: true, color: { argb: BRAND.blanco } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('I2:L3');
  const periodCell = ws.getCell('I2');
  periodCell.value = periodo;
  periodCell.font = { name: FONT_XLS, size: 12, bold: true, color: { argb: BRAND.blanco } };
  periodCell.alignment = { horizontal: 'right', vertical: 'middle' };

  paintRange(4, 2, 4, 12, BRAND.vino);
  ws.getRow(4).height = 6;

  // ── Meta ─────────────────────────────────────────────────────
  ws.mergeCells('B5:L5');
  const meta = ws.getCell('B5');
  meta.value = `Periodo del ${formatearFechaLarga(input.fechaInicio)} al ${formatearFechaLarga(input.fechaFin)}  ·  ${rows.length} registro${rows.length === 1 ? '' : 's'}  ·  Generado ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  meta.font = { name: FONT_XLS, size: 9, color: { argb: BRAND.muted } };
  meta.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(5).height = 18;

  // ── KPIs: imagen con 3 cards del mismo ancho (no toca anchos de columna) ──
  const kpiPng = renderKpiCardsPng([
    {
      label: 'Sub-total renta',
      value: moneyMx(tot.subRenta),
      hint: `IVA ${moneyMx(tot.ivaRenta)}  ·  Total ${moneyMx(tot.totRenta)}`,
      fill: 'FFE8EEF8',
      accent: BRAND.azul,
    },
    {
      label: 'Sub-total mantenimiento',
      value: moneyMx(tot.subMant),
      hint: `IVA ${moneyMx(tot.ivaMant)}  ·  Total ${moneyMx(tot.totMant)}`,
      fill: 'FFF8E8EE',
      accent: BRAND.vino,
    },
    {
      label: 'Gran total del periodo',
      value: moneyMx(tot.granTotal),
      hint: `Sub-total ${moneyMx(tot.subCombinado)}  ·  IVA ${moneyMx(tot.ivaCombinado)}`,
      fill: 'FFE8F4F2',
      accent: 'FF0F766E',
    },
  ]);
  ws.getRow(6).height = 18;
  ws.getRow(7).height = 28;
  ws.getRow(8).height = 18;
  if (kpiPng.base64) {
    const kpiImgId = wb.addImage({ base64: kpiPng.base64, extension: 'png' });
    ws.addImage(kpiImgId, 'B6:L8');
  }

  // ── Etiquetas de estatus a la derecha (Pagada / Incremento) ──
  ws.getCell('K9').value = 'Pagada';
  ws.getCell('K9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.pagada } };
  ws.getCell('K9').font = { name: FONT_XLS, size: 8, bold: true, color: { argb: BRAND.pagadaTexto } };
  ws.getCell('K9').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('L9').value = 'Incremento';
  ws.getCell('L9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.incremento } };
  ws.getCell('L9').font = { name: FONT_XLS, size: 8, bold: true, color: { argb: BRAND.incrementoTexto } };
  ws.getCell('L9').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(9).height = 18;

  // ── Encabezados tabla (azul sistema) ─────────────────────────
  const headerPairs: Array<{ col: number; r10: string; r11: string; merge: boolean }> = [
    { col: 2, r10: 'NOMBRE DE LA EMPRESA', r11: 'NOMBRE DE LA EMPRESA', merge: true },
    { col: 3, r10: 'PISO', r11: 'PISO', merge: true },
    { col: 4, r10: 'MÓDULO', r11: 'MÓDULO', merge: true },
    { col: 5, r10: 'METROS', r11: 'CUADRADOS', merge: false },
    { col: 6, r10: 'PRECIO', r11: 'M²', merge: false },
    { col: 7, r10: 'CONCEPTO', r11: 'CONCEPTO', merge: true },
    { col: 8, r10: 'SUB-TOTAL', r11: 'SUB-TOTAL', merge: true },
    { col: 9, r10: 'IVA', r11: 'IVA', merge: true },
    { col: 10, r10: 'TOTAL', r11: 'TOTAL', merge: true },
    { col: 11, r10: 'INICIO DE', r11: 'CONTRATO', merge: false },
    { col: 12, r10: 'FIN DE', r11: 'CONTRATO', merge: false },
  ];

  for (const h of headerPairs) {
    const c10 = ws.getRow(10).getCell(h.col);
    const c11 = ws.getRow(11).getCell(h.col);
    c10.value = h.r10;
    c11.value = h.r11;
    for (const cell of [c10, c11]) {
      cell.font = { name: FONT_COLS, size: 9, bold: true, color: { argb: BRAND.blanco } };
      cell.alignment = {
        horizontal: h.col === 2 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.azul } };
      cell.border = thinBorder(BRAND.azul);
    }
    if (h.merge) ws.mergeCells(10, h.col, 11, h.col);
  }
  ws.getRow(10).height = 16;
  ws.getRow(11).height = 16;

  // ── Filas (mismo orden: RENTA + MANTTO por registro) ─────────
  let r = 12;
  for (const row of rows) {
    const estatus = estatusDeFila(row);
    const fill = fillArgb(estatus);
    const r2 = r + 1;

    const applyIdentity = (col: number, value: string | number, opts?: { money?: boolean; date?: boolean }) => {
      const c1 = ws.getRow(r).getCell(col);
      const c2 = ws.getRow(r2).getCell(col);
      c1.value = value;
      for (const cell of [c1, c2]) {
        cell.font = {
          name: FONT_COLS,
          size: opts?.date ? 8 : 9,
          bold: col === 2,
          color: { argb: BRAND.negro },
        };
        cell.alignment = {
          horizontal: col === 2 ? 'left' : 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = thinBorder();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        if (opts?.money) cell.numFmt = MONEY_FMT;
      }
      ws.mergeCells(r, col, r2, col);
    };

    const applyConcepto = (rowNum: number, concepto: string, sub: number, iva: number, total: number) => {
      const vals: Array<[number, string | number, boolean]> = [
        [7, concepto, false],
        [8, redondear(sub), true],
        [9, redondear(iva), true],
        [10, redondear(total), true],
      ];
      for (const [col, value, money] of vals) {
        const cell = ws.getRow(rowNum).getCell(col);
        cell.value = value;
        cell.font = {
          name: FONT_COLS,
          size: 9,
          bold: col === 7 || col === 10,
          color: { argb: col === 7 && concepto === 'RENTA' ? BRAND.azul : col === 7 ? BRAND.vino : BRAND.negro },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder();
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        if (money) cell.numFmt = MONEY_FMT;
      }
    };

    applyIdentity(2, row.nombre || '—');
    applyIdentity(3, pisoDeFila(row));
    applyIdentity(4, row.modulo || '—');
    applyIdentity(5, redondear(row.metrosRentados));
    applyIdentity(6, redondear(row.costoM2), { money: true });
    applyIdentity(11, row.inicioContrato || '—', { date: true });
    applyIdentity(12, row.finContrato || '—', { date: true });
    applyConcepto(r, 'RENTA', row.renta.subTotal, row.renta.iva, row.renta.montoFinal);
    applyConcepto(r2, 'MANTTO', row.mantenimiento.subTotal, row.mantenimiento.iva, row.mantenimiento.montoFinal);
    r += 2;
  }

  // ── Totales pie ──────────────────────────────────────────────
  const foot = r + 1;
  paintRange(foot, 2, foot + 2, 12, 'FFF8FAFC');

  const writeFoot = (rowNum: number, label: string, sub: number, iva: number, total: number, strong = false) => {
    ws.mergeCells(rowNum, 2, rowNum, 7);
    const lab = ws.getRow(rowNum).getCell(2);
    lab.value = label;
    lab.font = { name: FONT_XLS, size: 10, bold: true, color: { argb: strong ? BRAND.vino : BRAND.azul } };
    lab.alignment = { horizontal: 'right', vertical: 'middle' };
    lab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    ([
      [8, sub],
      [9, iva],
      [10, total],
    ] as const).forEach(([col, value]) => {
      const cell = ws.getRow(rowNum).getCell(col);
      cell.value = value;
      cell.numFmt = MONEY_FMT;
      cell.font = {
        name: FONT_XLS,
        size: strong ? 11 : 10,
        bold: true,
        color: { argb: BRAND.negro },
      };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: strong ? 'medium' : 'thin', color: { argb: BRAND.border } },
        bottom: { style: strong ? 'medium' : 'thin', color: { argb: BRAND.border } },
        left: { style: 'thin', color: { argb: BRAND.border } },
        right: { style: 'thin', color: { argb: BRAND.border } },
      };
    });
    ws.getRow(rowNum).height = 20;
  };

  writeFoot(foot, 'Ingreso renta', tot.subRenta, tot.ivaRenta, tot.totRenta);
  writeFoot(foot + 1, 'Ingreso mantto', tot.subMant, tot.ivaMant, tot.totMant);
  writeFoot(foot + 2, 'Gran total', tot.subCombinado, tot.ivaCombinado, tot.granTotal, true);

  const buffer = await wb.xlsx.writeBuffer();
  const slug = mesPeriodoLabel(input.fechaInicio, input.fechaFin).toLowerCase().replace(/\s+/g, '-');
  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `rent-rol-${slug}.xlsx`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  PDF
// ═══════════════════════════════════════════════════════════════

export async function exportarRentRolPdf(input: RentRolExportInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const rows = input.rows;
  const titulo = (input.titulo || 'Rent Rol').trim();
  const tot = totalesDesdeRows(rows);
  const azul = rgbFromArgb(BRAND.azul);
  const vino = rgbFromArgb(BRAND.vino);
  const pagadaRgb = rgbFromArgb(BRAND.pagada);
  const incrementoRgb = rgbFromArgb(BRAND.incremento);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PDF_MARGIN * 2;

  const logo = await loadImageDataUrl(PDF_LOGO_PATH);

  const drawSpringHeader = (opts?: { continuation?: boolean; pageNumber?: number }): number => {
    const headerH = PDF_HEADER_H;

    doc.setFillColor(...PDF_BRAND.ink);
    doc.rect(0, 0, pageW, headerH, 'F');

    doc.setFillColor(...PDF_BRAND.primary);
    doc.rect(0, headerH - 2.5, pageW, 2.5, 'F');

    if (logo) {
      const fitted = fitImage(logo.w, logo.h, 44, 34);
      const logoX = pageW - PDF_MARGIN - fitted.width;
      const logoY = (headerH - fitted.height) / 2;
      doc.addImage(logo.dataUrl, 'PNG', logoX, logoY, fitted.width, fitted.height, undefined, 'FAST');
    }

    doc.setTextColor(...PDF_BRAND.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(titulo, PDF_MARGIN, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_BRAND.soft);
    const sub = opts?.continuation
      ? `Continuación  ·  ${mesPeriodoLabel(input.fechaInicio, input.fechaFin)}`
      : `Inicio: ${formatearFechaSlash(input.fechaInicio)}  ·  Fin: ${formatearFechaSlash(input.fechaFin)}`;
    doc.text(sub, PDF_MARGIN, 21);

    doc.setFontSize(8.5);
    const meta = opts?.continuation
      ? `Página ${opts.pageNumber ?? ''}`
      : `${rows.length} registro${rows.length === 1 ? '' : 's'}  ·  Montos en MXN con IVA desglosado`;
    doc.text(meta, PDF_MARGIN, 27);

    return headerH + PDF_HEADER_GAP;
  };

  const drawFooter = (pageNumber: number) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(PDF_MARGIN, pageH - 8, pageW - PDF_MARGIN, pageH - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Rent Rol · documento generado por el sistema', PDF_MARGIN, pageH - 4);
    doc.text(`Pág. ${pageNumber}`, pageW - PDF_MARGIN, pageH - 4, { align: 'right' });
  };

  const drawKpiCards = (startY: number): number => {
    const gap = 4;
    const cardW = (contentW - gap * 2) / 3;
    const cardH = 22;
    const cards = [
      {
        title: 'Sub-total renta',
        value: moneyMx(tot.subRenta),
        hint: `IVA ${moneyMx(tot.ivaRenta)}  ·  Total ${moneyMx(tot.totRenta)}`,
        accent: azul,
        soft: [232, 238, 248] as [number, number, number],
      },
      {
        title: 'Sub-total mantenimiento',
        value: moneyMx(tot.subMant),
        hint: `IVA ${moneyMx(tot.ivaMant)}  ·  Total ${moneyMx(tot.totMant)}`,
        accent: vino,
        soft: [248, 232, 238] as [number, number, number],
      },
      {
        title: 'Gran total del periodo',
        value: moneyMx(tot.granTotal),
        hint: `Sub-total ${moneyMx(tot.subCombinado)}  ·  IVA ${moneyMx(tot.ivaCombinado)}`,
        accent: [15, 118, 110] as [number, number, number],
        soft: [232, 244, 242] as [number, number, number],
      },
    ];

    cards.forEach((card, i) => {
      const x = PDF_MARGIN + i * (cardW + gap);

      doc.setFillColor(...card.soft);
      doc.setDrawColor(...card.accent);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, startY, cardW, cardH, 1.2, 1.2, 'FD');

      doc.setFillColor(...card.accent);
      doc.rect(x, startY + 1.2, 1.6, cardH - 2.4, 'F');

      doc.setTextColor(...card.accent);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(card.title.toUpperCase(), x + 5, startY + 6);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text(card.value, x + 5, startY + 13.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(card.hint, x + 5, startY + 18.5);
    });

    return startY + cardH + 5;
  };

  // Anchos de columna proporcionales al contentW (misma caja que las cards)
  const colWeights = [46, 16, 20, 15, 16, 16, 22, 18, 22, 20, 20];
  const weightSum = colWeights.reduce((a, b) => a + b, 0);
  const colWidths = colWeights.map((w) => (w / weightSum) * contentW);

  // Página 1
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, 'F');
  let y = drawSpringHeader();
  drawFooter(1);

  y = drawKpiCards(y);

  // Etiquetas de estatus (alineadas a la derecha)
  const legends = [
    { label: 'Pagada', fill: pagadaRgb, ink: rgbFromArgb(BRAND.pagadaTexto) },
    { label: 'Incremento', fill: incrementoRgb, ink: rgbFromArgb(BRAND.incrementoTexto) },
  ];
  const chipW = 30;
  const chipGap = 3;
  const chipsTotalW = legends.length * chipW + (legends.length - 1) * chipGap;
  let lx = pageW - PDF_MARGIN - chipsTotalW;
  for (const leg of legends) {
    doc.setFillColor(...leg.fill);
    doc.setDrawColor(...leg.ink);
    doc.setLineWidth(0.2);
    doc.roundedRect(lx, y, chipW, 5.8, 1, 1, 'FD');
    doc.setTextColor(...leg.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(leg.label, lx + chipW / 2, y + 3.9, { align: 'center' });
    lx += chipW + chipGap;
  }
  y += 10;

  type BodyCell =
    | string
    | { content: string; rowSpan?: number; styles?: Record<string, unknown> };

  const body: BodyCell[][] = [];
  const rowMeta: EstatusExport[] = [];

  for (const row of rows) {
    const estatus = estatusDeFila(row);
    const shared = (content: string): BodyCell => ({
      content,
      rowSpan: 2,
      styles: { valign: 'middle' },
    });

    body.push([
      shared(row.nombre || '—'),
      shared(pisoDeFila(row)),
      shared(row.modulo || '—'),
      shared(fmtNum(row.metrosRentados)),
      shared(moneyMx(row.costoM2)),
      'RENTA',
      moneyMx(row.renta.subTotal),
      moneyMx(row.renta.iva),
      moneyMx(row.renta.montoFinal),
      shared(row.inicioContrato || '—'),
      shared(row.finContrato || '—'),
    ]);
    rowMeta.push(estatus);

    body.push([
      'MANTTO',
      moneyMx(row.mantenimiento.subTotal),
      moneyMx(row.mantenimiento.iva),
      moneyMx(row.mantenimiento.montoFinal),
    ]);
    rowMeta.push(estatus);
  }

  autoTable(doc, {
    startY: y,
    head: [
      [
        'NOMBRE DE LA EMPRESA',
        'PISO',
        'MÓDULO',
        'METROS\nCUADRADOS',
        'PRECIO\nM²',
        'CONCEPTO',
        'SUB-TOTAL',
        'IVA',
        'TOTAL',
        'INICIO DE\nCONTRATO',
        'FIN DE\nCONTRATO',
      ],
    ],
    body,
    theme: 'grid',
    tableWidth: contentW,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.12,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: azul,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: colWidths[0], halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: colWidths[1], halign: 'center' },
      2: { cellWidth: colWidths[2], halign: 'center' },
      3: { cellWidth: colWidths[3], halign: 'center' },
      4: { cellWidth: colWidths[4], halign: 'center' },
      5: { cellWidth: colWidths[5], halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: colWidths[6], halign: 'right' },
      7: { cellWidth: colWidths[7], halign: 'right' },
      8: { cellWidth: colWidths[8], halign: 'right', fontStyle: 'bold' },
      9: { cellWidth: colWidths[9], halign: 'center', fontSize: 7.2 },
      10: { cellWidth: colWidths[10], halign: 'center', fontSize: 7.2 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const estatus = rowMeta[data.row.index];
      data.cell.styles['fillColor'] = rgbFromArgb(fillArgb(estatus));

      const raw = String(data.cell.raw ?? '');
      if (raw === 'RENTA') data.cell.styles['textColor'] = azul;
      if (raw === 'MANTTO') data.cell.styles['textColor'] = vino;
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageW, pageH, 'F');
        drawSpringHeader({ continuation: true, pageNumber: data.pageNumber });
      }
    },
    didDrawPage: (data) => {
      drawFooter(data.pageNumber);
    },
    margin: {
      top: PDF_HEADER_H + PDF_HEADER_GAP,
      left: PDF_MARGIN,
      right: PDF_MARGIN,
      bottom: 12,
    },
  });

  const slug = mesPeriodoLabel(input.fechaInicio, input.fechaFin).toLowerCase().replace(/\s+/g, '-');
  doc.save(`rent-rol-${slug}.pdf`);
}
