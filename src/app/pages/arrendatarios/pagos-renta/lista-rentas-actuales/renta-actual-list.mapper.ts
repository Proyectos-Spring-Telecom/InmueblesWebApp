import { formatMonedaDesdeNumero } from 'src/app/shared/valor-miles-format';
import { formatearFechaHora } from '../../../inmuebles/inmuebles-list.mapper';
import { nombreArrendatarioDesdeApi } from '../../arrendatarios-list.mapper';

const MESES_PERIODO_ES = [
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

export interface RentaActualDesgloseVm {
  rentaFmt: string;
  mantenimientoFmt: string;
  muestraRenta: boolean;
  muestraMantenimiento: boolean;
}

export interface RentaActualGridRow {
  id: number;
  idArrendatario: number | null;
  idContrato: number | null;
  idFormula: number | null;
  arrendatarioLabel: string;
  contratoLabel: string;
  formulaLabel: string;
  total: number | null;
  totalFmt: string;
  montoFinal: number | null;
  montoFinalFmt: string;
  desgloseVm: RentaActualDesgloseVm;
  factorVariable: number | null;
  factorVariableFmt: string;
  ocupoFormula: number;
  ocupoFormulaLabel: string;
  pagada: boolean;
  pagadaLabel: string;
  mesLabel: string;
  fhRegistroFmt: string;
  detalle: Record<string, unknown>;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

function moneyFmt(v: unknown): string {
  const n = num(v);
  return n != null ? formatMonedaDesdeNumero(n) : '—';
}

function extraerFilasPaginadas(resp: unknown): unknown[] {
  if (resp == null) return [];
  const r = resp as Record<string, unknown>;
  if (Array.isArray(resp)) return resp;
  let rows: unknown = r['data'];
  if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
    const bag = rows as Record<string, unknown>;
    rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
  }
  return Array.isArray(rows) ? rows : [];
}

export function extraerFilasRentasActualApi(resp: unknown): unknown[] {
  return extraerFilasPaginadas(resp);
}

function etiquetaArrendatario(row: Record<string, unknown>): string {
  const nombre = nombreArrendatarioDesdeApi(row);
  if (nombre) return nombre;
  const directo = str(row['arrendatarioNombre'] ?? row['nombreArrendatario']);
  if (directo) return directo;
  const id = num(row['idArrendatario']);
  return id != null ? `Arrendatario #${id}` : '—';
}

function etiquetaContrato(row: Record<string, unknown>): string {
  const nested = row['contrato'];
  if (nested != null && typeof nested === 'object') {
    const c = nested as Record<string, unknown>;
    const numC = str(c['numeroContrato'] ?? c['numero']);
    if (numC) return numC;
  }
  const directo = str(row['numeroContrato'] ?? row['contratoNumero']);
  if (directo) return directo;
  const id = num(row['idContrato']);
  return id != null ? `Contrato #${id}` : '—';
}

function etiquetaFormula(row: Record<string, unknown>): string {
  const directo = str(row['nombreFormula'] ?? row['formulaNombre'] ?? row['nombre']);
  if (directo) return directo;
  const nested = row['formula'];
  if (nested != null && typeof nested === 'object') {
    const f = nested as Record<string, unknown>;
    const nombre = str(f['nombre']);
    if (nombre) return nombre;
  }
  const id = num(row['idFormula']);
  return id != null ? `Fórmula #${id}` : '—';
}

function esPagada(row: Record<string, unknown>): boolean {
  if (typeof row['pagada'] === 'boolean') return row['pagada'];
  if (row['pagada'] === 1 || row['pagada'] === '1') return true;
  const est = str(row['estatus'] ?? row['estatusPago']).toLowerCase();
  return est === 'pagada' || est === 'pagado' || est === '1';
}

function etiquetaPeriodoMes(row: Record<string, unknown>): string {
  const raw = row['mes'] ?? row['mesRenta'] ?? row['periodo'];
  if (raw == null || String(raw).trim() === '') return '—';

  const texto = String(raw).trim();
  const fecha = new Date(texto);
  if (!Number.isNaN(fecha.getTime())) {
    const nombreMes = MESES_PERIODO_ES[fecha.getMonth()] ?? '';
    const anio = fecha.getFullYear();
    return nombreMes ? `${nombreMes} ${anio}` : '—';
  }

  const partes = texto.match(/^(\d{4})-(\d{2})/);
  if (partes) {
    const anio = partes[1];
    const idx = Number(partes[2]) - 1;
    const nombreMes = MESES_PERIODO_ES[idx];
    return nombreMes ? `${nombreMes} ${anio}` : texto;
  }

  const mesNombre = str(row['mesNombre'] ?? row['nombreMes']);
  const anio = row['anio'] ?? row['year'];
  if (mesNombre && anio != null) return `${mesNombre} ${anio}`;
  return texto || '—';
}

function extraerMontosFinalesDesglose(row: Record<string, unknown>): {
  montoFinalRenta: number | null;
  montoFinalMantenimiento: number | null;
} {
  let montoFinalRenta: number | null = null;
  let montoFinalMantenimiento: number | null = null;

  const desglose = row['desglose'];
  if (desglose != null && typeof desglose === 'object' && !Array.isArray(desglose)) {
    const d = desglose as Record<string, unknown>;
    const renta = d['renta'];
    if (renta != null && typeof renta === 'object' && !Array.isArray(renta)) {
      const r = renta as Record<string, unknown>;
      montoFinalRenta = num(r['montoFinal'] ?? r['monto_final']);
    }
    const mantenimiento = d['mantenimiento'];
    if (mantenimiento != null && typeof mantenimiento === 'object' && !Array.isArray(mantenimiento)) {
      const m = mantenimiento as Record<string, unknown>;
      montoFinalMantenimiento = num(m['montoFinalMantenimiento'] ?? m['monto_final_mantenimiento']);
    }
  }

  if (montoFinalRenta == null) {
    montoFinalRenta = num(row['montoFinal'] ?? row['monto_final']);
  }
  if (montoFinalMantenimiento == null) {
    montoFinalMantenimiento = num(row['montoFinalMantenimiento'] ?? row['monto_final_mantenimiento']);
  }

  return { montoFinalRenta, montoFinalMantenimiento };
}

/** Columna Monto final: renta + mantenimiento si hay mantenimiento; si no, solo renta. */
function resolverMontoFinalColumna(row: Record<string, unknown>): number | null {
  const { montoFinalRenta, montoFinalMantenimiento } = extraerMontosFinalesDesglose(row);
  if (montoFinalRenta == null && montoFinalMantenimiento == null) return null;

  const renta = montoFinalRenta ?? 0;
  const tieneMantenimiento = montoFinalMantenimiento != null && montoFinalMantenimiento > 0;
  if (!tieneMantenimiento) {
    return montoFinalRenta;
  }

  return Math.round((renta + (montoFinalMantenimiento ?? 0)) * 100) / 100;
}

function extraerDesglose(row: Record<string, unknown>): RentaActualDesgloseVm {
  const { montoFinalRenta, montoFinalMantenimiento } = extraerMontosFinalesDesglose(row);
  const muestraMantenimiento = montoFinalMantenimiento != null && montoFinalMantenimiento > 0;

  return {
    rentaFmt: moneyFmt(montoFinalRenta),
    mantenimientoFmt: moneyFmt(montoFinalMantenimiento),
    muestraRenta: montoFinalRenta != null,
    muestraMantenimiento,
  };
}

export function mapRentaActualApiToGridRow(item: unknown): RentaActualGridRow | null {
  const row = item as Record<string, unknown>;
  const id = num(row['id'] ?? row['idRentaActual']);
  if (id == null || id <= 0) return null;

  const total = num(row['total']);
  const montoFinal = resolverMontoFinalColumna(row);
  const factorVariable = num(row['factorVariable'] ?? row['factor_variable']);
  const ocupoRaw = row['ocupoFormula'] ?? row['ocupo_formula'];
  const ocupoFormula =
    ocupoRaw === true || ocupoRaw === 1 || ocupoRaw === '1' ? 1 : 0;
  const pagada = esPagada(row);

  return {
    id: Math.floor(id),
    idArrendatario: num(row['idArrendatario']),
    idContrato: num(row['idContrato']),
    idFormula: num(row['idFormula']),
    arrendatarioLabel: etiquetaArrendatario(row),
    contratoLabel: etiquetaContrato(row),
    formulaLabel: etiquetaFormula(row),
    total,
    totalFmt: moneyFmt(total),
    montoFinal,
    montoFinalFmt: moneyFmt(montoFinal),
    desgloseVm: extraerDesglose(row),
    factorVariable,
    factorVariableFmt:
      factorVariable != null ? String(factorVariable) : '—',
    ocupoFormula,
    ocupoFormulaLabel: ocupoFormula === 1 ? 'Sí' : 'No',
    pagada,
    pagadaLabel: pagada ? 'Pagada' : 'Pendiente',
    mesLabel: etiquetaPeriodoMes(row),
    fhRegistroFmt: formatearFechaHora(String(row['fhRegistro'] ?? '')) || '—',
    detalle: row,
  };
}

/** Valores del formulario de edición a partir del registro del listado paginado. */
export function extraerRentaActualParaEdicion(det: Record<string, unknown>): {
  idArrendatario: number | null;
  idContrato: number | null;
  total: number | null;
  idFormula: number | null;
  montoFinal: number | null;
  totalMantenimiento: number | null;
  montoFinalMantenimiento: number | null;
  factorVariable: number | null;
  ocupoFormula: number;
} {
  const { montoFinalRenta, montoFinalMantenimiento } = extraerMontosFinalesDesglose(det);
  const ocupoRaw = det['ocupoFormula'] ?? det['ocupo_formula'];
  const totalMttoRaw = num(det['totalMantenimiento'] ?? det['total_mantenimiento']);
  const montoFinalMttoRaw =
    montoFinalMantenimiento ??
    num(det['montoFinalMantenimiento'] ?? det['monto_final_mantenimiento']);

  return {
    idArrendatario: num(det['idArrendatario']),
    idContrato: num(det['idContrato']),
    total: num(det['total']),
    idFormula: num(det['idFormula']),
    montoFinal: montoFinalRenta ?? num(det['montoFinal'] ?? det['monto_final']),
    totalMantenimiento: totalMttoRaw,
    montoFinalMantenimiento: montoFinalMttoRaw,
    factorVariable: num(det['factorVariable'] ?? det['factor_variable']),
    ocupoFormula: ocupoRaw === true || ocupoRaw === 1 || ocupoRaw === '1' ? 1 : 0,
  };
}

export function extraerRentaActualDetalleApi(resp: unknown): Record<string, unknown> | null {
  if (resp == null) return null;
  if (typeof resp === 'object' && !Array.isArray(resp)) {
    const r = resp as Record<string, unknown>;
    const data = r['data'];
    if (data != null && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    if (r['id'] != null || r['idRentaActual'] != null) return r;
  }
  return null;
}
