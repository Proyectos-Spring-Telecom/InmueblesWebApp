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
  vigenciaAnios?: number | string;
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

export interface InmuebleLocalApi {
  id?: number;
  nombre?: string;
  areaM2?: string | number;
  estatus?: number;
  mensualidad?: string | number;
  giro?: string;
  idZona?: number;
  urlFachada?: string;
  fachadaUrl?: string;
  imagenFachada?: string;
  fachada?: string | InmuebleArchivoApi;
}

export interface InmuebleZonaApi {
  id?: number;
  idInmueble?: number;
  zonaPrincipal?: string;
  superficieZonaM2?: string | number;
  superficieDisponibleM2?: string | number;
  numeroZona?: number;
  locales?: InmuebleLocalApi[];
}

export interface InmuebleArchivoApi {
  id?: number;
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
  numLocales: number;
  numServicios: number;
  numArchivos: number;
  tieneMapa: boolean;
  lat: number | null;
  lng: number | null;
  /** Datos completos para master-detail */
  detalle: InmuebleApiItem;
}

function esObjetoRecordo(val: unknown): val is Record<string, unknown> {
  return val != null && typeof val === 'object' && !Array.isArray(val);
}

function leerArreglo(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

function valorTextoONumero(val: unknown): string | number | undefined {
  if (val == null || val === '') return undefined;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') return val;
  return String(val);
}

/** Giro legible desde variantes del API (string, id o objeto catálogo). */
export function resolverGiroLocalApi(raw: unknown): string | undefined {
  if (!esObjetoRecordo(raw)) return undefined;
  const l = raw;
  const candidatos = [
    l['giro'],
    l['giroActividad'],
    l['giroComercial'],
    l['rubro'],
    l['actividad'],
    l['tipoNegocio'],
    l['descripcionGiro'],
  ];
  for (const c of candidatos) {
    if (c == null || c === '') continue;
    if (esObjetoRecordo(c)) {
      const anidado = c as Record<string, unknown>;
      const s = String(
        anidado['nombre'] ?? anidado['giro'] ?? anidado['descripcion'] ?? '',
      ).trim();
      if (s) return s;
      continue;
    }
    const s = String(c).trim();
    if (s && s !== '[object Object]') return s;
  }
  return undefined;
}

function normalizarLocalApi(raw: unknown): InmuebleLocalApi | null {
  if (!esObjetoRecordo(raw)) return null;
  const l = raw;
  const fachadaObj = l['fachada'];
  const fachadaUrl = String(
    l['fachadaUrl'] ??
      l['urlFachada'] ??
      l['imagenFachada'] ??
      (esObjetoRecordo(fachadaObj) ? fachadaObj['url'] : fachadaObj) ??
      '',
  ).trim();
  return {
    id: l['id'] != null ? Number(l['id']) : undefined,
    nombre: l['nombre'] != null ? String(l['nombre']) : undefined,
    areaM2:
      valorTextoONumero(l['areaM2']) ?? valorTextoONumero(l['superficieM2']),
    estatus: l['estatus'] != null ? Number(l['estatus']) : undefined,
    mensualidad:
      valorTextoONumero(l['mensualidad']) ??
      valorTextoONumero(l['mensualidadMxn']),
    giro: resolverGiroLocalApi(l),
    idZona: l['idZona'] != null ? Number(l['idZona']) : undefined,
    fachadaUrl: fachadaUrl || undefined,
    urlFachada: fachadaUrl || undefined,
    imagenFachada: fachadaUrl || undefined,
  };
}

function normalizarZonaApi(raw: unknown): InmuebleZonaApi | null {
  if (!esObjetoRecordo(raw)) return null;
  const z = raw;
  const localesRaw = leerArreglo(z['locales'] ?? z['Locales']);
  return {
    id: z['id'] != null ? Number(z['id']) : undefined,
    idInmueble: z['idInmueble'] != null ? Number(z['idInmueble']) : undefined,
    zonaPrincipal: z['zonaPrincipal'] != null ? String(z['zonaPrincipal']) : undefined,
    superficieZonaM2:
      valorTextoONumero(z['superficieZonaM2']) ??
      valorTextoONumero(z['zonaSuperficieM2']),
    superficieDisponibleM2:
      valorTextoONumero(z['superficieDisponibleM2']) ??
      valorTextoONumero(z['superficieDisponiblePredioM2']),
    numeroZona: z['numeroZona'] != null ? Number(z['numeroZona']) : undefined,
    locales: localesRaw
      .map(normalizarLocalApi)
      .filter((x): x is InmuebleLocalApi => x != null),
  };
}

function normalizarServicioApi(raw: unknown): InmuebleServicioApi | null {
  if (!esObjetoRecordo(raw)) return null;
  const s = raw;
  const urlComprobante = String(
    s['urlComprobante'] ?? s['comprobanteUrl'] ?? s['urlComprobantePago'] ?? '',
  ).trim();
  return {
    id: s['id'] != null ? Number(s['id']) : undefined,
    idServicioInmueble:
      s['idServicioInmueble'] != null ? Number(s['idServicioInmueble']) : undefined,
    idTipoServicio:
      s['idTipoServicio'] != null ? Number(s['idTipoServicio']) : undefined,
    numeroContrato:
      s['numeroContrato'] != null ? String(s['numeroContrato']) : undefined,
    fechaPago: s['fechaPago'] != null ? String(s['fechaPago']) : undefined,
    ultimoDiaPago:
      s['ultimoDiaPago'] != null ? String(s['ultimoDiaPago']) : undefined,
    urlComprobante: urlComprobante || undefined,
    tipoServicio: esObjetoRecordo(s['tipoServicio'])
      ? (s['tipoServicio'] as InmuebleServicioApi['tipoServicio'])
      : undefined,
  };
}

function normalizarArchivoApi(raw: unknown): InmuebleArchivoApi | null {
  if (!esObjetoRecordo(raw)) return null;
  const a = raw;
  const url = urlArchivoNavegador(String(a['url'] ?? a['archivoUrl'] ?? '').trim());
  const nombre = a['nombre'] != null ? String(a['nombre']).trim() : '';
  if (!url && !nombre) return null;
  return {
    id: a['id'] != null ? Number(a['id']) : undefined,
    url: url || undefined,
    nombre: nombre || undefined,
  };
}

/** Une listas de archivos del API sin duplicar por id o url. */
export function fusionarArchivosInmuebleApi(
  ...fuentes: unknown[]
): InmuebleArchivoApi[] {
  const vistos = new Set<string>();
  const out: InmuebleArchivoApi[] = [];

  for (const fuente of fuentes) {
    for (const raw of leerArreglo(fuente)) {
      const archivo = normalizarArchivoApi(raw);
      if (!archivo) continue;
      const clave =
        archivo.id != null && Number.isFinite(archivo.id)
          ? `id:${archivo.id}`
          : String(archivo.url ?? archivo.nombre ?? '').trim().toLowerCase();
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(archivo);
    }
  }

  return out;
}

function archivosDesdeRecordoApi(r: Record<string, unknown>): InmuebleArchivoApi[] {
  return fusionarArchivosInmuebleApi(
    r['archivos'],
    r['Archivos'],
    r['archivosInmueble'],
    r['inmuebleArchivos'],
    r['imagenes'],
    r['Imagenes'],
  );
}

/** Normaliza arreglos anidados del GET `/inmuebles/{id}`. */
export function normalizarInmuebleDetalleApi(raw: unknown): InmuebleApiItem {
  if (!esObjetoRecordo(raw)) return {};
  const r = raw;
  const servicios = leerArreglo(r['servicios'] ?? r['Servicios'])
    .map(normalizarServicioApi)
    .filter((x): x is InmuebleServicioApi => x != null);
  const zonas = leerArreglo(r['zonas'] ?? r['Zonas'])
    .map(normalizarZonaApi)
    .filter((x): x is InmuebleZonaApi => x != null);
  const archivos = archivosDesdeRecordoApi(r);
  const imagenes = fusionarArchivosInmuebleApi(r['imagenes'], r['Imagenes']).filter(
    (a) => !archivos.some((x) => x.id === a.id && a.id != null) &&
      !archivos.some((x) => x.url === a.url && !!a.url),
  );

  return {
    ...(r as InmuebleApiItem),
    servicios,
    zonas,
    archivos,
    imagenes: imagenes.length ? imagenes : undefined,
  };
}

/** Respuesta de GET `/inmuebles/{id}` (con o sin envoltorio `data`). */
export function extraerInmuebleDetalleApi(resp: unknown): InmuebleApiItem {
  if (resp == null || typeof resp !== 'object') return {};
  const r = resp as Record<string, unknown>;
  const envuelto = r['data'] ?? r['result'];

  let cuerpo: Record<string, unknown> | null = null;
  if (esObjetoRecordo(envuelto)) {
    if (envuelto['id'] != null || envuelto['direccionFiscal'] != null) {
      cuerpo = envuelto;
    } else if (esObjetoRecordo(envuelto['inmueble'])) {
      cuerpo = { ...(envuelto['inmueble'] as Record<string, unknown>), ...envuelto };
    }
  } else if (r['id'] != null || r['direccionFiscal'] != null) {
    cuerpo = r;
  }

  if (!cuerpo) return {};

  const archivosFusionados = fusionarArchivosInmuebleApi(
    cuerpo['archivos'],
    cuerpo['Archivos'],
    cuerpo['archivosInmueble'],
    cuerpo['inmuebleArchivos'],
    esObjetoRecordo(envuelto) ? archivosDesdeRecordoApi(envuelto) : [],
    archivosDesdeRecordoApi(r),
  );

  const item = normalizarInmuebleDetalleApi({
    ...cuerpo,
    archivos: archivosFusionados,
  });

  if (archivosFusionados.length > 0) {
    item.archivos = archivosFusionados;
  }

  return item;
}

/** URL de fachada de un local (GET detalle). */
export function urlFachadaLocal(loc: InmuebleLocalApi): string {
  const raw = loc as Record<string, unknown>;
  return String(
    loc.fachadaUrl ?? loc.urlFachada ?? loc.imagenFachada ?? raw['fachadaUrl'] ?? '',
  ).trim();
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
  | 'licenciaFuncionamiento'
  | 'usoSuelo'
  | 'fachada'
  | 'plano'
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
  if (n.includes('uso de suelo')) return 'usoSuelo';
  if (n.includes('licencia')) return 'licenciaFuncionamiento';
  if (n === 'fachada' || n.startsWith('fachada')) return 'fachada';
  if (n === 'plano' || n.startsWith('plano')) return 'plano';
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
  const todos = fusionarArchivosInmuebleApi(archivos, imagenes);

  for (const a of todos) {
    const url = String(a.url ?? '').trim();
    const nombre = String(a.nombre ?? '').trim();
    if (!url && !nombre) continue;
    const tipo = clasificarDocumentoInmueble(nombre, url);
    if (tipo === 'galeria') {
      galeria.push(a);
      continue;
    }
    if (tipo === 'otro') continue;
    if (!documentos[tipo]) {
      documentos[tipo] = a;
      continue;
    }
    if (esImagenArchivo(url, nombre)) {
      galeria.push(a);
    }
  }

  return { documentos, galeria };
}

/** Imágenes adicionales para la galería del formulario (duplicados de slot o sin slot). */
export function archivosImagenGaleriaInmueble(item: InmuebleApiItem): InmuebleArchivoApi[] {
  return separarArchivosInmueble(item.archivos, item.imagenes).galeria;
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
      numLocales: contarLocalesInmueble(item),
      numServicios: Array.isArray(item.servicios) ? item.servicios.length : 0,
      numArchivos: archivos.length,
      tieneMapa: item.lat != null && item.lng != null && Number.isFinite(Number(item.lat)),
      lat: item.lat != null ? Number(item.lat) : null,
      lng: item.lng != null ? Number(item.lng) : null,
      detalle: normalizarInmuebleDetalleApi({ ...item, id: idFinal, archivos }),
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

export function localesDeZona(zona: InmuebleZonaApi): InmuebleLocalApi[] {
  const locales = zona.locales;
  return Array.isArray(locales) ? locales : [];
}

export function contarLocalesInmueble(item: InmuebleApiItem): number {
  if (!Array.isArray(item.zonas)) return 0;
  return item.zonas.reduce((sum, z) => sum + localesDeZona(z).length, 0);
}

export const OPCIONES_ESTATUS_LOCAL: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 0, label: 'Fuera de servicio' },
  { value: 1, label: 'Disponible para renta' },
  { value: 2, label: 'Ocupado' },
  { value: 3, label: 'Apartado' },
];

export function etiquetaEstatusLocal(estatus: unknown): string {
  const n = Number(estatus);
  const op = OPCIONES_ESTATUS_LOCAL.find((o) => o.value === n);
  return op?.label ?? '—';
}

export function claseChipEstatusLocal(estatus: unknown): string {
  const n = Number(estatus);
  if (n === 0) return 'inm-estatus-chip inm-estatus-chip--baja';
  if (n === 1) return 'inm-estatus-chip inm-estatus-chip--disponible';
  if (n === 2) return 'inm-estatus-chip inm-estatus-chip--ocupado';
  if (n === 3) return 'inm-estatus-chip inm-estatus-chip--apartado';
  return 'inm-estatus-chip';
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

/** Codifica espacios y caracteres especiales en rutas S3/API para `<img src>` y enlaces. */
export function urlArchivoNavegador(url?: string | null): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      parsed.pathname = parsed.pathname
        .split('/')
        .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
        .join('/');
      return parsed.toString();
    } catch {
      return encodeURI(raw);
    }
  }
  return encodeURI(raw);
}

export function urlDesdeArchivoApi(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return urlArchivoNavegador(raw);
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const u = String(o['url'] ?? o['archivoUrl'] ?? o['Url'] ?? '').trim();
    return urlArchivoNavegador(u);
  }
  return '';
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
  const base = urlArchivoNavegador(url.trim().split('#')[0]);
  return `${base}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}
