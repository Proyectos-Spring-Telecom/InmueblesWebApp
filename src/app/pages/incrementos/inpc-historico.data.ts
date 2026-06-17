import { formatValorMilesParaLista } from 'src/app/shared/valor-miles-format';

/** Fila de histórico INPC (grid + formulario). */
export interface InpcHistoricoItem {
  id: number;
  anio: number;
  mes: string;
  valorInpc: number;
  /** INPC con separador de miles (coma), igual que en el formulario de alta */
  valorInpcFmt: string;
  porcentajeAnual: number | null;
  estatus: number;
}

/** Fila del grid de consulta paginada `/inpc/paginated`. */
export interface InpcPaginatedGridRow {
  id: string;
  fecha: string;
  anio: number;
  mes: number;
  isBanxico: boolean;
  origenLabel: string;
  origenClass: string;
  inpc: number;
  inpcFmt: string;
  porcentajeAnual: number | null;
  porcentajeAnualFmt: string;
  porcAcumAnual: number | null;
  porcAcumAnualFmt: string;
  fhRegistro?: string;
  estatus?: number;
}

export const MESES_INPC = [
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

export function mesNombreANumero(mes: string): number {
  const i = MESES_INPC.indexOf(mes as (typeof MESES_INPC)[number]);
  return i >= 0 ? i + 1 : 1;
}

export function mesNumeroANombre(mes: number): string {
  if (mes >= 1 && mes <= 12) return MESES_INPC[mes - 1];
  return '';
}

const CELDA_VACIA = '-';

/** Texto de celda cuando el valor es null, undefined o cadena vacía. */
export function textoCeldaInpc(valor: unknown): string {
  if (valor == null) return CELDA_VACIA;
  const s = String(valor).trim();
  return s ? s : CELDA_VACIA;
}

export function etiquetaOrigenInpc(isBanxico: boolean): string {
  return isBanxico ? 'Banxico' : 'Propio';
}

export function claseOrigenInpc(isBanxico: boolean): string {
  return isBanxico ? 'estatus estatus-instalado' : 'estatus estatus-activo';
}

/** Normaliza respuesta de `/inpc/paginated` o `/inpc/{id}` hacia la forma del grid/formulario. */
export function mapInpcApiItemToRow(item: any): InpcHistoricoItem {
  const id = Number(item?.Id ?? item?.id);
  const anio = Number(item?.anio ?? item?.Anio ?? 0);
  const mesRaw = item?.mes ?? item?.Mes;
  let mes: string;
  if (typeof mesRaw === 'number' && Number.isFinite(mesRaw)) {
    mes = mesNumeroANombre(mesRaw) || String(mesRaw);
  } else {
    mes = String(mesRaw ?? '').trim();
  }
  const fuenteInpc =
    item?.inpc ??
    item?.Inpc ??
    item?.valorInpc ??
    item?.ValorInpc ??
    item?.porcentaje ??
    item?.Porcentaje ??
    null;

  const valorInpc = Number(String(fuenteInpc ?? '').replace(/,/g, '').trim());
  const valorInpcSafe = Number.isFinite(valorInpc) ? valorInpc : 0;
  const valorInpcFmt = formatValorMilesParaLista(fuenteInpc);

  const porcentajeAnualRaw =
    item?.porcentajeAnual ??
    item?.PorcentajeAnual ??
    null;
  const porcentajeAnualNum = Number(
    String(porcentajeAnualRaw ?? '').replace(/,/g, '').trim(),
  );
  const porcentajeAnual =
    porcentajeAnualRaw != null &&
    porcentajeAnualRaw !== '' &&
    Number.isFinite(porcentajeAnualNum)
      ? porcentajeAnualNum
      : null;

  const estatus = Number(item?.estatus ?? item?.Estatus ?? 1);
  return {
    id,
    anio,
    mes,
    valorInpc: valorInpcSafe,
    valorInpcFmt,
    porcentajeAnual,
    estatus: Number.isFinite(estatus) ? estatus : 1,
  };
}

function parseNumeroInpc(valor: unknown): number {
  const n = Number(String(valor ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseNumeroOpcional(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(String(valor).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Normaliza un elemento de `data[]` de `/inpc/paginated` hacia la forma del grid. */
export function mapInpcPaginatedItemToRow(item: any): InpcPaginatedGridRow | null {
  const anio = Number(item?.anio ?? 0);
  const mes = Number(item?.mes ?? 0);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return null;
  }

  const isBanxico = item?.isBanxico === true;
  const mesNombre = mesNumeroANombre(mes);
  const fecha = textoCeldaInpc(mesNombre ? `${mesNombre} ${anio}` : '');
  const id = isBanxico
    ? `b-${anio}-${String(mes).padStart(2, '0')}`
    : String(item?.id ?? `p-${anio}-${mes}`);

  const inpcRaw = item?.inpc;
  const porcentajeAnualRaw = item?.porcentajeAnual;
  const porcAcumAnualRaw = item?.porcAcumAnual;

  return {
    id,
    fecha,
    anio,
    mes,
    isBanxico,
    origenLabel: etiquetaOrigenInpc(isBanxico),
    origenClass: claseOrigenInpc(isBanxico),
    inpc: parseNumeroInpc(inpcRaw),
    inpcFmt: textoCeldaInpc(formatValorMilesParaLista(inpcRaw) || null),
    porcentajeAnual: parseNumeroOpcional(porcentajeAnualRaw),
    porcentajeAnualFmt: textoCeldaInpc(porcentajeAnualRaw),
    porcAcumAnual: parseNumeroOpcional(porcAcumAnualRaw),
    porcAcumAnualFmt: textoCeldaInpc(porcAcumAnualRaw),
    fhRegistro: item?.fhRegistro,
    estatus: item?.estatus != null ? Number(item.estatus) : undefined,
  };
}

export { formatValorMilesParaLista as formatInpcValorParaLista } from 'src/app/shared/valor-miles-format';
