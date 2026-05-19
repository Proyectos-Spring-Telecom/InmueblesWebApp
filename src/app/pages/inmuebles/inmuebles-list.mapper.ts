export interface InmuebleApiItem {
  id?: number;
  inmueble?: string;
  direccionFiscal?: string;
  estatusInmueble?: number;
  fechaInicio?: string;
  fechaFin?: string;
  nombreRepresentante?: string;
  telefonoRepresentante?: string;
  correoRepresentante?: string;
  fhRegistro?: string;
  estatus?: number;
  lat?: number;
  lng?: number;
  idArrendador?: number;
  rentaMxn?: number | string;
  renta?: number | string;
  tiempoRentaAnios?: number | string;
  tiempoRenta?: number | string;
  arrendador?: Record<string, unknown>;
  servicios?: InmuebleServicioApi[];
  zonas?: InmuebleZonaApi[];
  archivos?: InmuebleArchivoApi[];
  imagenes?: InmuebleArchivoApi[];
}

export interface InmuebleServicioApi {
  id?: number;
  idServicioInmueble?: number;
  idTipoServicio?: number;
  numeroContrato?: string;
  fechaPago?: string;
  ultimoDiaPago?: string;
  urlComprobante?: string;
  tipoServicio?: { nombre?: string; servicio?: string };
}

export interface InmuebleZonaApi {
  zonaPrincipal?: string;
  superficieZonaM2?: string | number;
  superficieDisponibleM2?: string | number;
  numeroZona?: number;
}

export interface InmuebleArchivoApi {
  url?: string;
  nombre?: string;
}

export interface InmuebleGridRow {
  id: number;
  inmueble: string;
  direccionFiscal: string;
  arrendadorNombre: string;
  representanteNombre: string;
  vigenciaTexto: string;
  estatusInmueble: number | null;
  estatusLabel: string;
  estatusClass: string;
  fechaInicioFmt: string;
  fechaFinFmt: string;
  telefonoRepresentante: string;
  correoRepresentante: string;
  fhRegistroFmt: string;
  estatusRegistroLabel: string;
  estatusRegistroClass: string;
  numZonas: number;
  numServicios: number;
  numArchivos: number;
  tieneMapa: boolean;
  lat: number | null;
  lng: number | null;
  /** Datos completos para master-detail */
  detalle: InmuebleApiItem;
}

/** Respuesta de GET `/inmuebles/{id}` (con o sin envoltorio `data`). */
export function extraerInmuebleDetalleApi(resp: unknown): InmuebleApiItem {
  if (resp == null || typeof resp !== 'object') return {};
  const r = resp as Record<string, unknown>;

  const envuelto = r['data'];
  if (envuelto != null && typeof envuelto === 'object' && !Array.isArray(envuelto)) {
    return envuelto as InmuebleApiItem;
  }

  // El cuerpo ya es el inmueble ({ id, inmueble: "nombre", direccionFiscal, ... }).
  // No usar r['inmueble'] aquí: ese campo es el nombre (string), no el objeto.
  if (r['id'] != null || r['direccionFiscal'] != null) {
    return r as InmuebleApiItem;
  }

  return {};
}

export function estatusInmuebleDesdeApi(estatus: unknown): string | null {
  const n = Number(estatus);
  if (n === 1) return 'RENTADO';
  if (n === 2) return 'PROPIO';
  return null;
}

export function fechaParaInputDate(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function idArrendadorDesdeApi(item: InmuebleApiItem): number | null {
  const directo = Number(item.idArrendador);
  if (Number.isFinite(directo) && directo > 0) return directo;
  const arr = item.arrendador as Record<string, unknown> | undefined;
  const id = Number(arr?.['id']);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export type SlotDocumentoInmueble =
  | 'licencia'
  | 'fachada'
  | 'contratoRenta'
  | 'constanciaFiscal'
  | 'comprobanteDomicilio'
  | 'escritura'
  | 'boletaPredial'
  | 'constanciaRepLegal'
  | 'ineRepresentante';

export interface ArchivosInmuebleSeparados {
  documentos: Partial<Record<SlotDocumentoInmueble, InmuebleArchivoApi>>;
  galeria: InmuebleArchivoApi[];
}

function normalizarNombreArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Clasifica por `nombre` del API (GET `/inmuebles/{id}`). */
export function clasificarDocumentoInmueble(
  nombre: string,
  url = '',
): SlotDocumentoInmueble | 'galeria' | 'otro' {
  const n = normalizarNombreArchivo(nombre);
  if (n.includes('contrato') && n.includes('renta')) return 'contratoRenta';
  if (n.includes('representante') && (n.includes('identificacion') || n.includes('oficial'))) {
    return 'ineRepresentante';
  }
  if (n.includes('representante') && n.includes('fiscal')) return 'constanciaRepLegal';
  if (n.includes('licencia') || n.includes('uso de suelo')) return 'licencia';
  if (n === 'fachada' || n.startsWith('fachada')) return 'fachada';
  if (n.includes('comprobante') && n.includes('domicilio')) return 'comprobanteDomicilio';
  if (n.includes('escritura') || (n.includes('titulo') && n.includes('propiedad'))) return 'escritura';
  if (n.includes('boleta') && n.includes('predial')) return 'boletaPredial';
  if (n.includes('constancia') && n.includes('fiscal')) return 'constanciaFiscal';
  if (esImagenArchivo(url, nombre)) return 'galeria';
  return 'otro';
}

/** Separa `archivos` (y opcional `imagenes`) en documentos fijos y galería adicional. */
export function separarArchivosInmueble(
  archivos?: InmuebleArchivoApi[],
  imagenes?: InmuebleArchivoApi[],
): ArchivosInmuebleSeparados {
  const documentos: Partial<Record<SlotDocumentoInmueble, InmuebleArchivoApi>> = {};
  const galeria: InmuebleArchivoApi[] = [];
  const todos = [...(Array.isArray(archivos) ? archivos : []), ...(Array.isArray(imagenes) ? imagenes : [])];

  for (const a of todos) {
    if (!a?.url?.trim() && !a?.nombre?.trim()) continue;
    const tipo = clasificarDocumentoInmueble(a.nombre ?? '', a.url ?? '');
    if (tipo === 'galeria') {
      galeria.push(a);
      continue;
    }
    if (tipo === 'otro') continue;
    if (!documentos[tipo]) documentos[tipo] = a;
  }

  return { documentos, galeria };
}

export function mapInmueblesApiToGridRows(items: unknown[]): InmuebleGridRow[] {
  if (!Array.isArray(items)) return [];

  return items.map((raw, index) => {
    const item = (raw ?? {}) as InmuebleApiItem;
    const id = Number(item.id);
    const idFinal = Number.isFinite(id) ? id : index + 1;
    const estatus = item.estatusInmueble != null ? Number(item.estatusInmueble) : null;
    const archivos = [
      ...(Array.isArray(item.archivos) ? item.archivos : []),
      ...(Array.isArray(item.imagenes) ? item.imagenes : []),
    ];

    return {
      id: idFinal,
      inmueble: String(item.inmueble ?? 'Sin nombre').trim(),
      direccionFiscal: String(item.direccionFiscal ?? '—').trim(),
      arrendadorNombre: nombreArrendador(item.arrendador),
      representanteNombre: String(item.nombreRepresentante ?? '—').trim(),
      vigenciaTexto: textoVigencia(item),
      estatusInmueble: Number.isFinite(estatus as number) ? (estatus as number) : null,
      estatusLabel: etiquetaEstatusInmueble(estatus),
      estatusClass: claseEstatusInmueble(estatus),
      fechaInicioFmt: formatearFecha(item.fechaInicio) || '—',
      fechaFinFmt: formatearFecha(item.fechaFin) || '—',
      telefonoRepresentante: String(item.telefonoRepresentante ?? '—').trim(),
      correoRepresentante: String(item.correoRepresentante ?? '—').trim(),
      fhRegistroFmt: formatearFechaHora(item.fhRegistro) || '—',
      estatusRegistroLabel: etiquetaEstatusRegistro(item.estatus),
      estatusRegistroClass: claseEstatusRegistro(item.estatus),
      numZonas: Array.isArray(item.zonas) ? item.zonas.length : 0,
      numServicios: Array.isArray(item.servicios) ? item.servicios.length : 0,
      numArchivos: archivos.length,
      tieneMapa: item.lat != null && item.lng != null && Number.isFinite(Number(item.lat)),
      lat: item.lat != null ? Number(item.lat) : null,
      lng: item.lng != null ? Number(item.lng) : null,
      detalle: { ...item, id: idFinal, archivos },
    };
  });
}

export function nombreArrendador(arrendador?: Record<string, unknown>): string {
  if (!arrendador) return '—';
  const compuesto = [
    arrendador['nombre'],
    arrendador['apellidoPaterno'],
    arrendador['apellidoMaterno'],
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return compuesto || String(arrendador['razonSocial'] ?? '—');
}

export function etiquetaEstatusInmueble(estatus: number | null): string {
  if (estatus === 1) return 'Rentado';
  if (estatus === 2) return 'Propio';
  return 'Sin estatus';
}

export function claseEstatusInmueble(estatus: number | null): string {
  if (estatus === 1) return 'estatus estatus-activo';
  if (estatus === 2) return 'estatus estatus-disponible';
  return 'estatus';
}

export function textoVigencia(item: InmuebleApiItem): string {
  const fi = formatearFecha(item.fechaInicio);
  const ff = formatearFecha(item.fechaFin);
  if (fi && ff) return `${fi} → ${ff}`;
  return '—';
}

export function formatearFecha(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatearFechaHora(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 16);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}

export function etiquetaEstatusRegistro(estatus: unknown): string {
  const n = Number(estatus);
  if (n === 1) return 'Activo';
  if (n === 0) return 'Inactivo';
  return '—';
}

export function claseEstatusRegistro(estatus: unknown): string {
  const n = Number(estatus);
  if (n === 1) return 'estatus estatus-activo';
  if (n === 0) return 'estatus estatus-inactivo';
  return 'estatus';
}

export function formatearMoneda(val: unknown): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function nombreServicio(s: InmuebleServicioApi): string {
  return (
    s.tipoServicio?.nombre ??
    s.tipoServicio?.servicio ??
    (s.idTipoServicio != null ? `Servicio #${s.idTipoServicio}` : 'Servicio')
  );
}

export function esImagenUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url ?? '');
}

export function esImagenArchivo(url?: string, nombre?: string): boolean {
  const ref = `${url ?? ''} ${nombre ?? ''}`;
  return (
    esImagenUrl(ref) ||
    /\.(png|jpe?g|gif|webp|jfif)(\?|$|#)/i.test(ref) ||
    /\.(png|jpe?g|gif|webp|jfif)/i.test(ref)
  );
}

export function esPdfArchivo(url?: string, nombre?: string): boolean {
  if (!url?.trim()) return false;
  const ref = `${url} ${nombre ?? ''}`.toLowerCase();
  return /\.pdf(\?|$|#)/i.test(ref) || ref.includes('pdf');
}

/** URL del PDF sin barra de herramientas, para miniatura en card */
export function urlPdfMiniatura(url: string): string {
  const base = url.trim().split('#')[0];
  return `${base}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}
