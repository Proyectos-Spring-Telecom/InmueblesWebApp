import { formatearFecha } from '../inmuebles/inmuebles-list.mapper';

/** Fila cruda de GET `/pago/paginated` y GET `/pago/{id}`. */
export interface PagoApiItem {
  id?: number;
  idInmueble?: number;
  idServicioInmueble?: number;
  /** Pagos del arrendatario (`/pagos-arrendatarios/...`). */
  idArrendatario?: number;
  idServicioArrendatario?: number;
  servicioArrendatario?: {
    numeroContrato?: string;
    tipoServicio?: { id?: number; nombre?: string };
  };
  concepto?: string;
  fechaPago?: string;
  fechaLimitePago?: string;
  ultimoDiaPago?: string;
  monto?: number | string;
  idMetodoPago?: number;
  estatus?: number;
  /** URL del comprobante en S3 (GET `/pago/{id}`). */
  comprobantePago?: string;
  urlComprobante?: string;
  metodoPago?: { nombre?: string };
  catMetodoPago?: { nombre?: string };
  servicioInmueble?: { nombre?: string; servicio?: string };
  [key: string]: unknown;
}

export type PagoEstatusUi = 'Pagado' | 'Pendiente' | 'Cancelado';

export interface PagoGridRow {
  id: number;
  concepto: string;
  fechaPago: string;
  fechaLimitePago: string;
  monto: number;
  metodo: string;
  estatus: PagoEstatusUi;
  urlComprobante?: string;
}

/** Vista de solo lectura para el modal GET `/pago/{id}`. */
export interface VistaPagoDetalleModal {
  id: string;
  concepto: string;
  servicio: string;
  fechaPago: string;
  monto: string;
  metodo: string;
  estatus: PagoEstatusUi;
  urlComprobante: string;
  tieneComprobante: boolean;
}

export function extraerPagoDetalleApi(res: unknown): PagoApiItem | null {
  if (res == null || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const data = r['data'];
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as PagoApiItem;
  }
  if (r['id'] != null) return res as PagoApiItem;
  return null;
}

export function extraerFilasPagosApi(res: unknown): PagoApiItem[] {
  const r = res as { data?: unknown } | unknown[] | null;
  if (r == null) return [];
  let rows: unknown = Array.isArray(r) ? r : (r as { data?: unknown }).data;
  if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
    const bag = rows as Record<string, unknown>;
    rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
  }
  if (!Array.isArray(rows)) return [];
  return rows as PagoApiItem[];
}

/** API: 1 Pagado, 2 Pendiente, 0 Cancelado. */
export function estatusPagoDesdeApi(raw: unknown): PagoEstatusUi {
  const n = Number(raw);
  if (n === 1) return 'Pagado';
  if (n === 2) return 'Pendiente';
  if (n === 0) return 'Cancelado';
  return 'Pendiente';
}

function urlComprobanteDesdePagoApi(item: PagoApiItem): string {
  return String(
    item.comprobantePago ??
      item.urlComprobante ??
      item['urlComprobantePago'] ??
      item['comprobanteUrl'] ??
      item['rutaComprobante'] ??
      '',
  ).trim();
}

function fechaIsoDesdeApi(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function etiquetaMetodoPago(item: PagoApiItem): string {
  const nested =
    item.metodoPago?.nombre ??
    item.catMetodoPago?.nombre ??
    (item['metodo'] != null ? String(item['metodo']) : '');
  if (String(nested).trim()) return String(nested).trim();
  const id = Number(item.idMetodoPago);
  return Number.isFinite(id) && id > 0 ? `Método ${id}` : '—';
}

function etiquetaConceptoPago(item: PagoApiItem): string {
  const c = String(item.concepto ?? '').trim();
  if (c) return c;
  const srvArr = item.servicioArrendatario?.tipoServicio?.nombre;
  if (String(srvArr ?? '').trim()) return String(srvArr).trim();
  const srv = item.servicioInmueble;
  const nombre =
    srv?.nombre ?? srv?.servicio ?? (item['nombreServicio'] != null ? String(item['nombreServicio']) : '');
  if (String(nombre).trim()) return String(nombre).trim();
  return 'Pago';
}

export function mapPagoApiItemToGridRow(
  item: PagoApiItem,
  resolverMetodo?: (id: number) => string,
): PagoGridRow | null {
  const id = Number(item.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const montoN = Number(item.monto);
  const monto = Number.isFinite(montoN) ? montoN : 0;

  const idMetodo = Number(item.idMetodoPago);
  let metodo = etiquetaMetodoPago(item);
  if (
    metodo === '—' &&
    resolverMetodo &&
    Number.isFinite(idMetodo) &&
    idMetodo > 0
  ) {
    const resuelto = resolverMetodo(idMetodo);
    if (resuelto.trim()) metodo = resuelto;
  }

  const fechaLimiteRaw =
    item.fechaLimitePago ?? item.ultimoDiaPago ?? item['fechaLimite'] ?? item['ultimoDia'];

  const urlComprobante = urlComprobanteDesdePagoApi(item);

  return {
    id: Math.floor(id),
    concepto: etiquetaConceptoPago(item),
    fechaPago: fechaIsoDesdeApi(item.fechaPago),
    fechaLimitePago: fechaIsoDesdeApi(fechaLimiteRaw),
    monto,
    metodo,
    estatus: estatusPagoDesdeApi(item.estatus),
    urlComprobante: urlComprobante || undefined,
  };
}

function textoServicioPago(
  item: PagoApiItem,
  resolverServicio?: (id: number) => string,
): string {
  const tipoArr = item.servicioArrendatario?.tipoServicio?.nombre;
  if (String(tipoArr ?? '').trim()) return String(tipoArr).trim();
  const srv = item.servicioInmueble;
  const nested =
    srv?.nombre ??
    srv?.servicio ??
    (item['nombreServicio'] != null ? String(item['nombreServicio']) : '');
  if (String(nested).trim()) return String(nested).trim();
  const idSrvArr = Number(item.idServicioArrendatario);
  if (resolverServicio && Number.isFinite(idSrvArr) && idSrvArr > 0) {
    const etiquetaArr = resolverServicio(idSrvArr);
    if (etiquetaArr.trim()) return etiquetaArr;
  }
  const id = Number(item.idServicioInmueble);
  if (resolverServicio && Number.isFinite(id) && id > 0) {
    const etiqueta = resolverServicio(id);
    if (etiqueta.trim()) return etiqueta;
  }
  return '—';
}

function montoTextoPago(monto: number): string {
  return (
    '$' +
    monto.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function mapPagoApiToVistaDetalle(
  item: PagoApiItem,
  opts?: {
    resolverMetodo?: (id: number) => string;
    resolverServicio?: (id: number) => string;
  },
): VistaPagoDetalleModal | null {
  const base = mapPagoApiItemToGridRow(item, opts?.resolverMetodo);
  if (!base) return null;

  const urlComprobante = urlComprobanteDesdePagoApi(item);

  return {
    id: String(base.id),
    concepto: base.concepto,
    servicio: textoServicioPago(item, opts?.resolverServicio),
    fechaPago: formatearFecha(String(item.fechaPago ?? '')) || base.fechaPago || '—',
    monto: montoTextoPago(base.monto),
    metodo: base.metodo,
    estatus: estatusPagoDesdeApi(item.estatus),
    urlComprobante: urlComprobante || base.urlComprobante || '',
    tieneComprobante: !!urlComprobante || !!base.urlComprobante,
  };
}

export function mapPagosApiToGridRows(
  items: PagoApiItem[],
  filtro:
    | {
        modo: 'inmueble';
        idInmueble: number | null;
      }
    | {
        modo: 'arrendatario';
        idArrendatario: number | null;
      },
  resolverMetodo?: (id: number) => string,
): PagoGridRow[] {
  let filtrados: PagoApiItem[];
  if (filtro.modo === 'arrendatario') {
    const idArr = filtro.idArrendatario;
    filtrados =
      idArr != null && Number.isFinite(idArr) && idArr > 0
        ? items.filter((p) => Number(p.idArrendatario) === idArr)
        : [];
  } else {
    const idInmueble = filtro.idInmueble;
    filtrados =
      idInmueble != null
        ? items.filter((p) => {
            const id = Number(p.idInmueble);
            return !Number.isFinite(id) || id <= 0 || id === idInmueble;
          })
        : items;
  }

  return filtrados
    .map((p) => mapPagoApiItemToGridRow(p, resolverMetodo))
    .filter((r): r is PagoGridRow => r != null)
    .sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago)));
}

/** Opciones de estatus (API): 2 Pendiente, 1 Pagado, 0 Cancelado. */
export const OPCIONES_ESTATUS_PAGO_API = [
  { value: 1, label: 'Pagado' },
  { value: 2, label: 'Pendiente' },
  { value: 0, label: 'Cancelado' },
] as const;