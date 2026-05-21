import {
  esImagenArchivo,
  esPdfArchivo,
  extraerInmuebleDetalleApi,
  urlPdfMiniatura,
  formatearFecha,
  formatearFechaHora,
  formatearMoneda,
  InmuebleApiItem,
  InmuebleArchivoApi,
  InmuebleLocalApi,
  InmuebleZonaApi,
  nombreArrendador,
  nombreServicio,
  separarArchivosInmueble,
} from '../inmuebles/inmuebles-list.mapper';

export { extraerInmuebleDetalleApi };

export interface MonitoreoExpedienteDoc {
  etiqueta: string;
  detalle: string;
  url?: string;
  nombreArchivo?: string;
}

export interface MonitoreoLocalFila {
  nombre: string;
  areaM2: string;
  estatusLabel: string;
  estatusClass: string;
  mensualidad: string;
  giro: string;
  fhRegistro: string;
}

export interface MonitoreoZonaFila {
  zonaPrincipal: string;
  superficieZonaM2: string;
  superficieDisponibleM2: string;
  locales: MonitoreoLocalFila[];
}

export interface MonitoreoServicioFila {
  concepto: string;
  contrato: string;
  fechaPago: string;
  fechaLimitePago: string;
  urlComprobante?: string;
  /** Id de servicio del inmueble (solo si viene del API). */
  idServicioInmueble?: number;
}

/** Estatus de local en monitoreo: 0 Baja, 1 Disponible, 2 Ocupado, 3 Apartado. */
export function etiquetaEstatusLocalMonitoreo(estatus: unknown): string {
  const n = Number(estatus);
  if (n === 0) return 'Baja';
  if (n === 1) return 'Disponible';
  if (n === 2) return 'Ocupado';
  if (n === 3) return 'Apartado';
  return '—';
}

export function claseEstatusLocalMonitoreo(estatus: unknown): string {
  const n = Number(estatus);
  if (n === 0) return 'mono-local-estatus mono-local-estatus--baja';
  if (n === 1) return 'mono-local-estatus mono-local-estatus--disponible';
  if (n === 2) return 'mono-local-estatus mono-local-estatus--ocupado';
  if (n === 3) return 'mono-local-estatus mono-local-estatus--apartado';
  return 'mono-local-estatus';
}

function fechaGridDesdeApi(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Todos los archivos del GET `/inmuebles/{id}` (sin filtrar por checklist). */
export function buildArchivosInmuebleLista(
  item: InmuebleApiItem,
): MonitoreoExpedienteDoc[] {
  const todos: InmuebleArchivoApi[] = [
    ...(Array.isArray(item.archivos) ? item.archivos : []),
    ...(Array.isArray(item.imagenes) ? item.imagenes : []),
  ];

  return todos
    .filter((a) => String(a?.url ?? '').trim() || String(a?.nombre ?? '').trim())
    .sort((a, b) => {
      const fa = String((a as Record<string, unknown>)['fhRegistro'] ?? '');
      const fb = String((b as Record<string, unknown>)['fhRegistro'] ?? '');
      return fb.localeCompare(fa);
    })
    .map((a) => {
      const nombre = String(a.nombre ?? '').trim() || 'Documento';
      const url = String(a.url ?? '').trim();
      return {
        etiqueta: nombre,
        detalle: nombre,
        url: url || undefined,
        nombreArchivo: nombre,
      };
    });
}

function textoSuperficieM2(raw: unknown): string {
  const n = Number(raw);
  if (Number.isFinite(n)) {
    return `${n % 1 === 0 ? n : n.toFixed(2)} m²`;
  }
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  return s.includes('m²') ? s : `${s} m²`;
}

function mapLocalMonitoreo(local: InmuebleLocalApi): MonitoreoLocalFila {
  const est = local.estatus;
  const mensualidadFmt = formatearMoneda(local.mensualidad);
  const fh = (local as Record<string, unknown>)['fhRegistro'];
  return {
    nombre: String(local.nombre ?? '').trim() || 'Sin nombre',
    areaM2: textoSuperficieM2(local.areaM2),
    estatusLabel: etiquetaEstatusLocalMonitoreo(est),
    estatusClass: claseEstatusLocalMonitoreo(est),
    mensualidad: mensualidadFmt !== '—' ? mensualidadFmt : '—',
    giro: String(local.giro ?? '').trim() || '—',
    fhRegistro: formatearFechaHora(String(fh ?? '')) || '—',
  };
}

export function buildZonasMonitoreoInmueble(
  item: InmuebleApiItem,
): MonitoreoZonaFila[] {
  const zonas = Array.isArray(item.zonas) ? item.zonas : [];
  return [...zonas]
    .sort((a, b) => {
      const na = Number(a.numeroZona);
      const nb = Number(b.numeroZona);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
        return na - nb;
      }
      return String(a.zonaPrincipal ?? '').localeCompare(
        String(b.zonaPrincipal ?? ''),
        'es',
      );
    })
    .map((z) => {
      const localesRaw = Array.isArray(z.locales) ? z.locales : [];
      const locales = localesRaw.map((loc) => mapLocalMonitoreo(loc));
      return {
        zonaPrincipal:
          String(z.zonaPrincipal ?? 'Sin nombre').trim() || 'Sin nombre',
        superficieZonaM2: textoSuperficieM2(z.superficieZonaM2),
        superficieDisponibleM2: textoSuperficieM2(z.superficieDisponibleM2),
        locales,
      };
    });
}

export function superficieDisponiblePredioTexto(item: InmuebleApiItem): string {
  const zonas = Array.isArray(item.zonas) ? item.zonas : [];
  const total = zonas.reduce(
    (s, z) => s + (Number(z.superficieDisponibleM2) || 0),
    0,
  );
  if (!Number.isFinite(total) || total <= 0) return '0.00 m²';
  return `${total % 1 === 0 ? total : total.toFixed(2)} m²`;
}

export function buildServiciosMonitoreoInmueble(
  item: InmuebleApiItem,
): MonitoreoServicioFila[] {
  const servicios = Array.isArray(item.servicios) ? item.servicios : [];
  return servicios.map((s) => {
    const id = Number(s.id);
    const idOk = Number.isFinite(id) && id > 0;
    return {
      concepto: nombreServicio(s),
      contrato: String(s.numeroContrato ?? '').trim(),
      fechaPago: fechaGridDesdeApi(s.fechaPago),
      fechaLimitePago: fechaGridDesdeApi(s.ultimoDiaPago),
      urlComprobante: String(s.urlComprobante ?? '').trim() || undefined,
      ...(idOk ? { idServicioInmueble: Math.floor(id) } : {}),
    };
  });
}

export function urlsGaleriaInmueble(item: InmuebleApiItem): string[] {
  const { galeria } = separarArchivosInmueble(item.archivos, item.imagenes);
  return galeria
    .map((a) => String(a.url ?? '').trim())
    .filter((u) => u.length > 0);
}

export function urlFachadaInmueble(item: InmuebleApiItem): string {
  const { documentos } = separarArchivosInmueble(item.archivos, item.imagenes);
  return String(documentos.fachada?.url ?? '').trim();
}

/** Archivo con nombre «Plano» en `archivos`. */
export function urlPlanoInmueble(item: InmuebleApiItem): string {
  const { documentos } = separarArchivosInmueble(item.archivos, item.imagenes);
  return String(documentos.plano?.url ?? '').trim();
}

/** Archivo con nombre «Licencia o uso de suelo» en `archivos`. */
export function urlLicenciaInmueble(item: InmuebleApiItem): string {
  const { documentos } = separarArchivosInmueble(item.archivos, item.imagenes);
  return String(documentos.licencia?.url ?? '').trim();
}

export function esRentaDesdeEstatusInmueble(estatus: unknown): boolean {
  return Number(estatus) === 1;
}

export function tituloInmuebleDesdeApi(item: InmuebleApiItem): string {
  return String(item.inmueble ?? '').trim() || 'Inmueble';
}

export function arrendadorNombreDesdeApi(item: InmuebleApiItem): string {
  return nombreArrendador(item.arrendador) || '—';
}

export function coordenadasInmuebleDesdeApi(
  item: InmuebleApiItem,
  fallbackLat: number,
  fallbackLng: number,
): { lat: number; lng: number } {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  return {
    lat: Number.isFinite(lat) ? lat : fallbackLat,
    lng: Number.isFinite(lng) ? lng : fallbackLng,
  };
}

/** URL apta para `<img [src]>` en tarjetas de plano / licencia. */
export function urlImagenTarjetaInmueble(url: string, nombre = ''): string | null {
  const u = String(url ?? '').trim();
  if (!u) return null;
  if (esImagenArchivo(u, nombre || u)) return u;
  return null;
}

export function urlPdfTarjetaInmueble(url: string, nombre = ''): string | null {
  const u = String(url ?? '').trim();
  if (!u || !esPdfArchivo(u, nombre)) return null;
  return urlPdfMiniatura(u);
}