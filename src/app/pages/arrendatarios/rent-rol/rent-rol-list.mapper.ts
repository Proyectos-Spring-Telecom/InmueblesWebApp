import { formatearFechaHora } from '../../inmuebles/inmuebles-list.mapper';
import { nombreArrendatarioDesdeApi } from '../arrendatarios-list.mapper';
import { extraerFilasRentasActualApi } from '../pagos-renta/lista-rentas-actuales/renta-actual-list.mapper';

export interface RentRolConceptoVm {
  subTotal: number;
  iva: number;
  total: number;
  montoFinal: number;
}

export interface RentRolRow {
  id: number;
  nombre: string;
  representanteLegal: string;
  telefonoRepresentante: string;
  inmueble: string;
  zona: string;
  modulo: string;
  metrosRentados: number;
  costoM2: number;
  inicioContrato: string;
  finContrato: string;
  pagada: boolean;
  pagadaLabel: string;
  tieneIncrementoRenta: boolean;
  tieneIncrementoMantenimiento: boolean;
  renta: RentRolConceptoVm;
  mantenimiento: RentRolConceptoVm;
}

/** Fila del grid DevExtreme (2 por registro histórico: Renta + Mantto). */
export interface RentRolGridLine {
  gridKey: string;
  parentId: number;
  tipoConcepto: 'Renta' | 'Mantto';
  esLineaRenta: boolean;
  claseEstatusRenta: string;
  claseEstatusMantenimiento: string;
  nombre: string;
  representanteLegal: string;
  telefonoRepresentante: string;
  inmueble: string;
  zona: string;
  modulo: string;
  metrosRentados: number;
  costoM2: number;
  inicioContrato: string;
  finContrato: string;
  pagada: boolean;
  pagadaLabel: string;
  subTotal: number;
  iva: number;
  montoFinal: number;
}

export const RENT_ROL_COLUMNAS_ROWSPAN: readonly string[] = [
  'nombre',
  'inmueble',
  'modulo',
  'metrosRentados',
  'costoM2',
  'inicioContrato',
  'finContrato',
  'pagadaLabel',
];

export const RENT_ROL_REGISTROS_POR_PAGINA = 20;

export const RENT_ROL_FILAS_GRID_POR_PAGINA = RENT_ROL_REGISTROS_POR_PAGINA * 2;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

function esPagada(row: Record<string, unknown>): boolean {
  if (typeof row['pagada'] === 'boolean') return row['pagada'];
  return row['pagada'] === 1 || row['pagada'] === '1';
}

function tieneIncrementoEnObj(obj: unknown): boolean {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Object.values(obj as Record<string, unknown>).some(
    (v) => v === true || v === 1 || v === '1',
  );
}

function formatearFechaCorta(raw: unknown): string {
  const texto = str(raw);
  if (!texto) return '—';
  const fmt = formatearFechaHora(texto);
  if (!fmt || fmt === '—') return texto.slice(0, 10);
  return fmt.split(' ')[0] ?? fmt;
}

function etiquetaLocales(contrato: Record<string, unknown> | null): string {
  const locales = contrato?.['contratoLocales'];
  if (!Array.isArray(locales) || locales.length === 0) return '—';
  const nombres = locales
    .map((item) => {
      if (item == null || typeof item !== 'object') return '';
      const cl = item as Record<string, unknown>;
      const local = cl['local'];
      if (local != null && typeof local === 'object' && !Array.isArray(local)) {
        return str((local as Record<string, unknown>)['nombre']);
      }
      return '';
    })
    .filter(Boolean);
  return nombres.length ? nombres.join(', ') : '—';
}

function zonaDesdeLocal(
  local: Record<string, unknown>,
  inmueble: Record<string, unknown> | null,
): string {
  const zonaObj = local['zona'];
  const zonaRec =
    zonaObj != null && typeof zonaObj === 'object' && !Array.isArray(zonaObj)
      ? (zonaObj as Record<string, unknown>)
      : null;
  const directo = str(
    zonaRec?.['zonaPrincipal'] ?? local['zonaPrincipal'] ?? local['nombreZona'],
  );
  if (directo) return directo;

  const idZona = Number(local['idZona'] ?? zonaRec?.['id']);
  if (!Number.isFinite(idZona) || idZona <= 0) return '';

  const zonas = inmueble?.['zonas'];
  if (Array.isArray(zonas)) {
    for (const z of zonas) {
      if (z == null || typeof z !== 'object') continue;
      const zona = z as Record<string, unknown>;
      const id = Number(zona['id'] ?? zona['idZona']);
      if (id === idZona) {
        const nombre = str(zona['zonaPrincipal'] ?? zona['nombre'] ?? zona['nombreZona']);
        if (nombre) return nombre;
      }
    }
  }

  const numeroZona = Number(zonaRec?.['numeroZona']);
  if (Number.isFinite(numeroZona) && numeroZona > 0) {
    return `Zona ${numeroZona}`;
  }
  return `Zona #${Math.floor(idZona)}`;
}

function etiquetaZona(
  contrato: Record<string, unknown> | null,
  inmueble: Record<string, unknown> | null,
): string {
  const locales = contrato?.['contratoLocales'];
  if (!Array.isArray(locales) || locales.length === 0) return '';

  const zonas = new Set<string>();
  for (const item of locales) {
    if (item == null || typeof item !== 'object') continue;
    const cl = item as Record<string, unknown>;
    const local = cl['local'];
    if (local == null || typeof local !== 'object' || Array.isArray(local)) continue;
    const etiqueta = zonaDesdeLocal(local as Record<string, unknown>, inmueble);
    if (etiqueta) zonas.add(etiqueta);
  }

  return zonas.size ? [...zonas].join(', ') : '';
}

function extraerContrato(row: Record<string, unknown>): Record<string, unknown> | null {
  const nested = row['contrato'];
  if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return null;
}

function extraerInmueble(contrato: Record<string, unknown> | null): Record<string, unknown> | null {
  const nested = contrato?.['inmueble'];
  if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return null;
}

function extraerConceptoRenta(row: Record<string, unknown>, contrato: Record<string, unknown> | null): RentRolConceptoVm {
  let montoFinal = num(row['montoFinal'] ?? row['monto_final']);

  const desglose = row['desglose'];
  if (desglose != null && typeof desglose === 'object' && !Array.isArray(desglose)) {
    const renta = (desglose as Record<string, unknown>)['renta'];
    if (renta != null && typeof renta === 'object' && !Array.isArray(renta)) {
      const r = renta as Record<string, unknown>;
      const finalDesglose = num(r['montoFinal'] ?? r['monto_final']);
      if (finalDesglose > 0) montoFinal = finalDesglose;
    }
  }

  const subTotal = num(contrato?.['subTotalRenta']);
  const iva = num(contrato?.['ivaRenta']);

  return { subTotal, iva, total: montoFinal, montoFinal };
}

function extraerConceptoMantenimiento(
  row: Record<string, unknown>,
  contrato: Record<string, unknown> | null,
): RentRolConceptoVm {
  let montoFinal = num(row['montoFinalMantenimiento'] ?? row['monto_final_mantenimiento']);

  const desglose = row['desglose'];
  if (desglose != null && typeof desglose === 'object' && !Array.isArray(desglose)) {
    const mant = (desglose as Record<string, unknown>)['mantenimiento'];
    if (mant != null && typeof mant === 'object' && !Array.isArray(mant)) {
      const m = mant as Record<string, unknown>;
      const finalDesglose = num(m['montoFinalMantenimiento'] ?? m['monto_final_mantenimiento']);
      if (finalDesglose >= 0 && (m['montoFinalMantenimiento'] != null || m['monto_final_mantenimiento'] != null)) {
        montoFinal = finalDesglose;
      }
    }
  }

  const subTotal = num(contrato?.['subTotalMantenimiento']);
  const iva = num(contrato?.['ivaMantenimiento']);

  return { subTotal, iva, total: montoFinal, montoFinal };
}

function claseEstatusRentaRow(row: RentRolRow): string {
  if (row.tieneIncrementoRenta) return 'row-estatus--incremento';
  if (row.pagada) return 'row-estatus--pagada';
  return 'row-estatus--neutral';
}

function claseEstatusMantenimientoRow(row: RentRolRow): string {
  if (row.tieneIncrementoMantenimiento) return 'row-estatus--incremento';
  if (row.pagada) return 'row-estatus--pagada';
  return 'row-estatus--neutral';
}

function baseGridLineDesdeRow(row: RentRolRow): Omit<
  RentRolGridLine,
  'gridKey' | 'tipoConcepto' | 'esLineaRenta' | 'subTotal' | 'iva' | 'montoFinal'
> {
  return {
    parentId: row.id,
    claseEstatusRenta: claseEstatusRentaRow(row),
    claseEstatusMantenimiento: claseEstatusMantenimientoRow(row),
    nombre: row.nombre,
    representanteLegal: row.representanteLegal,
    telefonoRepresentante: row.telefonoRepresentante,
    inmueble: row.inmueble,
    zona: row.zona,
    modulo: row.modulo,
    metrosRentados: row.metrosRentados,
    costoM2: row.costoM2,
    inicioContrato: row.inicioContrato,
    finContrato: row.finContrato,
    pagada: row.pagada,
    pagadaLabel: row.pagadaLabel,
  };
}

export function mapRentRolRowToGridLines(row: RentRolRow): RentRolGridLine[] {
  const base = baseGridLineDesdeRow(row);
  return [
    {
      ...base,
      gridKey: `${row.id}-renta`,
      tipoConcepto: 'Renta',
      esLineaRenta: true,
      subTotal: row.renta.subTotal,
      iva: row.renta.iva,
      montoFinal: row.renta.montoFinal,
    },
    {
      ...base,
      gridKey: `${row.id}-mant`,
      tipoConcepto: 'Mantto',
      esLineaRenta: false,
      subTotal: row.mantenimiento.subTotal,
      iva: row.mantenimiento.iva,
      montoFinal: row.mantenimiento.montoFinal,
    },
  ];
}

export function flattenRentRolRowsToGridLines(rows: RentRolRow[]): RentRolGridLine[] {
  return rows.flatMap((row) => mapRentRolRowToGridLines(row));
}

function normalizarTextoBusqueda(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function textoBusquedaDesdeRentRolRow(row: RentRolRow): string {
  const fmtMoneda = (n: number): string =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
  return [
    row.nombre,
    row.representanteLegal,
    row.telefonoRepresentante,
    row.inmueble,
    row.zona,
    row.modulo,
    String(row.metrosRentados),
    fmtMoneda(row.costoM2),
    row.inicioContrato,
    row.finContrato,
    row.pagadaLabel,
    row.pagada ? 'pagada' : 'pendiente',
    'renta',
    'mantto',
    'mantenimiento',
    fmtMoneda(row.renta.subTotal),
    fmtMoneda(row.renta.iva),
    fmtMoneda(row.renta.montoFinal),
    fmtMoneda(row.mantenimiento.subTotal),
    fmtMoneda(row.mantenimiento.iva),
    fmtMoneda(row.mantenimiento.montoFinal),
    String(row.id),
  ]
    .filter(Boolean)
    .join(' ');
}

export function rentRolRowCoincideBusqueda(row: RentRolRow, texto: string): boolean {
  const needle = normalizarTextoBusqueda(texto);
  if (!needle) return true;
  return normalizarTextoBusqueda(textoBusquedaDesdeRentRolRow(row)).includes(needle);
}

export function filtrarRegistrosRentRol(rows: RentRolRow[], texto: string): RentRolRow[] {
  const needle = normalizarTextoBusqueda(texto);
  if (!needle) return rows;
  return rows.filter((row) => rentRolRowCoincideBusqueda(row, texto));
}

function extraerArrendatario(row: Record<string, unknown>): Record<string, unknown> | null {
  const nested = row['arrendatario'];
  if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return null;
}

export function extraerFilasRentRolApi(resp: unknown): unknown[] {
  return extraerFilasRentasActualApi(resp);
}

export function extraerMetaPaginacionRentRol(
  resp: unknown,
  page: number,
  limit: number,
): { total: number; page: number; totalPaginas: number } {
  if (resp == null || typeof resp !== 'object') {
    return { total: 0, page, totalPaginas: 1 };
  }
  const r = resp as Record<string, unknown>;
  const meta =
    r['paginated'] != null && typeof r['paginated'] === 'object'
      ? (r['paginated'] as Record<string, unknown>)
      : r;
  const total = num(meta['total']) || num(r['total']);
  const pagina = num(meta['page']) || num(r['page']) || page;
  const totalPaginas =
    num(meta['lastPage']) ||
    num(meta['pages']) ||
    num(r['pages']) ||
    Math.max(1, Math.ceil((total || 0) / limit));
  return { total, page: pagina, totalPaginas };
}

export function mapHistoricoPagoRentaToRentRolRow(item: unknown): RentRolRow | null {
  if (item == null || typeof item !== 'object' || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = num(row['id']);
  if (id <= 0) return null;

  const contrato = extraerContrato(row);
  const inmueble = extraerInmueble(contrato);
  const arrendatario = extraerArrendatario(row);
  const pagada = esPagada(row);
  const nombre = nombreArrendatarioDesdeApi(row) || str(row['arrendatarioNombre']) || '—';

  return {
    id: Math.floor(id),
    nombre,
    representanteLegal: str(arrendatario?.['representanteLegal']),
    telefonoRepresentante: str(
      arrendatario?.['telefonoRepresentante'] ?? arrendatario?.['telefono'],
    ),
    inmueble: str(inmueble?.['inmueble']) || '—',
    zona: etiquetaZona(contrato, inmueble),
    modulo: etiquetaLocales(contrato),
    metrosRentados: num(contrato?.['metrosRentados']),
    costoM2: num(contrato?.['costoM2']),
    inicioContrato: formatearFechaCorta(contrato?.['fechaInicioContrato']),
    finContrato: formatearFechaCorta(contrato?.['fechaTerminoContrato']),
    pagada,
    pagadaLabel: pagada ? 'Pagada' : 'Pendiente',
    tieneIncrementoRenta: tieneIncrementoEnObj(row['incrementoRenta']),
    tieneIncrementoMantenimiento: tieneIncrementoEnObj(row['incrementoMantenimiento']),
    renta: extraerConceptoRenta(row, contrato),
    mantenimiento: extraerConceptoMantenimiento(row, contrato),
  };
}
