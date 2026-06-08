import { formatValorMilesParaLista } from 'src/app/shared/valor-miles-format';

/** Fila de histórico INPC (grid + formulario). */
export interface InpcHistoricoItem {
  id: number;
  anio: number;
  mes: string;
  valorInpc: number;
  /** INPC con separador de miles (coma), igual que en el formulario de alta */
  valorInpcFmt: string;
  estatus: number;
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

  const estatus = Number(item?.estatus ?? item?.Estatus ?? 1);
  return {
    id,
    anio,
    mes,
    valorInpc: valorInpcSafe,
    valorInpcFmt,
    estatus: Number.isFinite(estatus) ? estatus : 1,
  };
}

/** Fila del grid de consulta Banxico (serie SP1). */
export interface InpcBanxicoGridRow {
  id: string;
  fecha: string;
  anio: number;
  mes: string;
  indice: number;
  indiceFmt: string;
  porcAnual: number;
  porcAnualFmt: string;
  porcAcumAnual: number;
  porcAcumAnualFmt: string;
}

function parseNumeroBanxico(valor: unknown): number {
  const n = Number(String(valor ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza un elemento de `datos[]` de `/inpc/banxico/datos` hacia la forma del grid. */
export function mapBanxicoDatoToRow(item: any): InpcBanxicoGridRow | null {
  const fecha = String(item?.fecha ?? '').trim();
  if (!fecha) return null;

  const partes = fecha.split('/');
  const mesNum = partes.length >= 2 ? Number(partes[1]) : 0;
  const anio = partes.length >= 3 ? Number(partes[2]) : 0;
  const mes = mesNumeroANombre(mesNum) || '';
  const mesClave = Number.isFinite(mesNum) && mesNum >= 1 && mesNum <= 12
    ? String(mesNum).padStart(2, '0')
    : '00';

  return {
    id: `${anio}-${mesClave}`,
    fecha,
    anio: Number.isFinite(anio) ? anio : 0,
    mes,
    indice: parseNumeroBanxico(item?.indice),
    indiceFmt: formatValorMilesParaLista(item?.indice),
    porcAnual: parseNumeroBanxico(item?.porcAnual),
    porcAnualFmt: String(item?.porcAnual ?? '').trim(),
    porcAcumAnual: parseNumeroBanxico(item?.porcAcumAnual),
    porcAcumAnualFmt: String(item?.porcAcumAnual ?? '').trim(),
  };
}

export { formatValorMilesParaLista as formatInpcValorParaLista } from 'src/app/shared/valor-miles-format';
