import { formatearMoneda } from '../../inmuebles/inmuebles-list.mapper';
import {
  mapPagoApiItemToGridRow,
  PagoApiItem,
  PagoEstatusUi,
  PagoGridRow,
} from '../../monitoreo/monitoreo-pagos.mapper';

export interface PagoServicioHubGridRow extends PagoGridRow {
  idArrendatario: number | null;
  arrendatarioLabel: string;
  servicioLabel: string;
  montoFmt: string;
  mesClave: string;
}

function etiquetaArrendatarioPago(
  item: PagoApiItem,
  resolver?: (id: number) => string,
): string {
  const nested = item.arrendatario;
  if (nested != null && typeof nested === 'object') {
    const nombre = String(
      nested.nombre ?? nested.arrendatario ?? nested.razonSocial ?? '',
    ).trim();
    if (nombre) return nombre;
  }
  const id = Number(item.idArrendatario);
  if (resolver && Number.isFinite(id) && id > 0) {
    const etiqueta = resolver(id);
    if (etiqueta.trim()) return etiqueta.trim();
  }
  return id > 0 ? `Arrendatario #${Math.floor(id)}` : '—';
}

function etiquetaServicioPago(item: PagoApiItem): string {
  const tipoArr = item.servicioArrendatario?.tipoServicio?.nombre;
  if (String(tipoArr ?? '').trim()) return String(tipoArr).trim();
  const c = String(item.concepto ?? '').trim();
  if (c) return c;
  return '—';
}

function claveMesDesdeFecha(fechaIso: string): string {
  const s = String(fechaIso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  return s.slice(0, 7);
}

/** Tipos ya cubiertos por las pestañas Rentas y Mantenimientos del hub. */
const TIPOS_SERVICIO_EXCLUIDOS_HUB = ['renta', 'mantenimiento'];

function normalizarTipoServicio(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Excluye pagos cuyo tipo de servicio es Renta o Mantenimiento. */
export function esPagoRentaOMantenimiento(item: PagoApiItem): boolean {
  const tipo = etiquetaServicioPago(item);
  const norm = normalizarTipoServicio(tipo);
  return TIPOS_SERVICIO_EXCLUIDOS_HUB.includes(norm);
}

export function esServicioArrendatarioExcluidoHub(etiquetaTipoServicio: string): boolean {
  const norm = normalizarTipoServicio(etiquetaTipoServicio);
  return TIPOS_SERVICIO_EXCLUIDOS_HUB.includes(norm);
}

export function mapPagoServicioHubGridRow(
  item: PagoApiItem,
  opts?: {
    resolverMetodo?: (id: number) => string;
    resolverArrendatario?: (id: number) => string;
  },
): PagoServicioHubGridRow | null {
  const base = mapPagoApiItemToGridRow(item, opts?.resolverMetodo);
  if (!base) return null;

  const idArrendatarioRaw = Number(item.idArrendatario);
  const idArrendatario =
    Number.isFinite(idArrendatarioRaw) && idArrendatarioRaw > 0
      ? Math.floor(idArrendatarioRaw)
      : null;

  return {
    ...base,
    idArrendatario,
    arrendatarioLabel: etiquetaArrendatarioPago(item, opts?.resolverArrendatario),
    servicioLabel: etiquetaServicioPago(item),
    montoFmt: formatearMoneda(base.monto),
    mesClave: claveMesDesdeFecha(base.fechaPago),
  };
}

export function mapPagosServiciosHubGridRows(
  items: PagoApiItem[],
  opts?: {
    resolverMetodo?: (id: number) => string;
    resolverArrendatario?: (id: number) => string;
  },
): PagoServicioHubGridRow[] {
  return items
    .filter((item) => !esPagoRentaOMantenimiento(item))
    .map((item) => mapPagoServicioHubGridRow(item, opts))
    .filter((r): r is PagoServicioHubGridRow => r != null)
    .sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago)));
}

export function claveMesActual(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatearEtiquetaMesPago(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [yy, mm] = ym.split('-');
  const m = Number(mm);
  const meses = [
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
  ];
  const nombreMes = meses[m - 1] ?? mm;
  return `${nombreMes} ${yy}`;
}

export type { PagoEstatusUi };
