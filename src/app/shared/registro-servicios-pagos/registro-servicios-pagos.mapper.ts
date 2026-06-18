import { formatearFecha } from '../../pages/inmuebles/inmuebles-list.mapper';
import { esPagoRentaOMantenimiento } from '../../pages/arrendatarios/pagos-servicios/pago-servicio-actual-list.mapper';
import {
  extraerFilasPagosApi,
  mapPagoApiItemToGridRow,
  PagoApiItem,
  PagoGridRow,
} from '../../pages/monitoreo/monitoreo-pagos.mapper';

export interface RegistroServicioPagoGridRow extends PagoGridRow {
  entidadLabel: string;
  montoFmt: string;
  fechaPagoFmt: string;
}

export function rangoFechasRegistroPorDefecto(): { inicio: string; fin: string } {
  const hoy = new Date();
  const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
  return {
    inicio: toIsoFechaRegistro(inicioAnio),
    fin: toIsoFechaRegistro(hoy),
  };
}

export function toIsoFechaRegistro(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extraerMetaPaginadaRegistroServicios(resp: unknown): {
  total: number;
  page: number;
  lastPage: number;
} {
  const r = (resp ?? {}) as Record<string, unknown>;
  const meta =
    r['paginated'] != null && typeof r['paginated'] === 'object'
      ? (r['paginated'] as Record<string, unknown>)
      : r;
  const total = toNum(meta['total']) ?? toNum(r['total']) ?? 0;
  const page = toNum(meta['page']) ?? toNum(r['page']) ?? 1;
  const lastPage = toNum(meta['lastPage']) ?? toNum(r['pages']) ?? 1;
  return { total, page, lastPage };
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatearMontoRegistro(monto: number): string {
  return (
    '$' +
    monto.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function etiquetaInmuebleDesdePago(item: PagoApiItem): string {
  const inmuebleObj = item['inmueble'];
  if (inmuebleObj != null && typeof inmuebleObj === 'object') {
    const nombre = String((inmuebleObj as Record<string, unknown>)['inmueble'] ?? '').trim();
    if (nombre) return nombre;
  }
  const directo = String(item['nombreInmueble'] ?? '').trim();
  return directo || '—';
}

function etiquetaArrendatarioDesdePago(item: PagoApiItem): string {
  const arr = item.arrendatario;
  if (arr != null && typeof arr === 'object') {
    const nombre = String(
      arr.nombre ?? arr.arrendatario ?? arr.razonSocial ?? '',
    ).trim();
    if (nombre) return nombre;
  }
  const directo = String(item['nombreArrendatario'] ?? item['nombreArrendador'] ?? '').trim();
  return directo || '—';
}

export function mapRegistroServiciosPagosApi(
  res: unknown,
  modo: 'inmueble' | 'arrendatario',
  resolverMetodo?: (id: number) => string,
): RegistroServicioPagoGridRow[] {
  return extraerFilasPagosApi(res)
    .filter((item) => !esPagoRentaOMantenimiento(item))
    .map((item) => {
      const base = mapPagoApiItemToGridRow(item, resolverMetodo);
      if (!base) return null;
      const entidadLabel =
        modo === 'inmueble'
          ? etiquetaInmuebleDesdePago(item)
          : etiquetaArrendatarioDesdePago(item);
      return {
        ...base,
        entidadLabel,
        montoFmt: formatearMontoRegistro(base.monto),
        fechaPagoFmt: formatearFecha(base.fechaPago) || base.fechaPago || '—',
      };
    })
    .filter((r): r is RegistroServicioPagoGridRow => r != null)
    .sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago)));
}
