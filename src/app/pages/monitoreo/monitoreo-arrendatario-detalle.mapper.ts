import {
  esImagenArchivo,
  esPdfArchivo,
  formatearMoneda,
  urlArchivoNavegador,
} from '../inmuebles/inmuebles-list.mapper';
import {
  MonitoreoExpedienteDoc,
  MonitoreoServicioFila,
} from './monitoreo-inmueble.mapper';
import { urlFachadaDesdeArchivos } from './monitoreo-locales.mapper';

export interface ArrendatarioApiItem {
  id?: number;
  arrendatario?: string;
  idArrendador?: number;
  renta?: number | string;
  fechaInicio?: string;
  fechaFin?: string;
  tiempoRenta?: string;
  representanteLegal?: string;
  telefonoRepresentante?: string;
  correoRepresentante?: string;
  lat?: number;
  lng?: number;
  estatus?: number;
  arrendador?: {
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    [key: string]: unknown;
  };
  servicios?: ArrendatarioServicioApi[];
  archivos?: ArrendatarioArchivoApi[];
  contratos?: ArrendatarioContratoApi[];
  [key: string]: unknown;
}

export interface ArrendatarioArchivoApi {
  id?: number;
  url?: string;
  nombre?: string;
  fhRegistro?: string;
  estatus?: number;
}

export interface ArrendatarioServicioApi {
  id?: number;
  numeroContrato?: string;
  fechaPago?: string;
  ultimoDiaPago?: string;
  urlComprobante?: string | null;
  tipoServicio?: { nombre?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface ArrendatarioContratoApi {
  id?: number;
  idInmueble?: number;
  idLocal?: number;
  fechaInicioContrato?: string;
  fechaTerminoContrato?: string;
  moneda?: string;
  metrosRentados?: number | string;
  costoM2?: number | string;
  porcentajeMantenimiento?: number | string;
  mesesDeposito?: number | string;
  montoDeposito?: number | string;
  mesesAdelanto?: number | string;
  montoAdelanto?: number | string;
  aniosForzososArrendador?: number;
  aniosForzososArrendatario?: number;
  subTotalRenta?: number | string;
  ivaRenta?: number | string;
  rentaTotal?: number | string;
  subTotalMantenimiento?: number | string;
  ivaMantenimiento?: number | string;
  mantenimientoTotal?: number | string;
  observaciones?: string;
  inmueble?: { inmueble?: string; id?: number; [key: string]: unknown };
  local?: {
    id?: number;
    nombre?: string;
    estatus?: number;
    areaM2?: number | string;
    giro?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ServicioArrendatarioPagoOpcion {
  id: number;
  nombre: string;
}

function fechaGridDesdeApi(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function extraerArrendatarioDetalleApi(res: unknown): ArrendatarioApiItem | null {
  if (res == null || typeof res !== 'object') return null;
  const r = res as Record<string, unknown>;
  const data = r['data'];
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    return data as ArrendatarioApiItem;
  }
  if (r['id'] != null) return res as ArrendatarioApiItem;
  return null;
}

export function nombreArrendadorDesdeArrendatarioApi(
  item: ArrendatarioApiItem,
): string {
  const a = item.arrendador;
  if (!a) return '—';
  const t = [a.nombre, a.apellidoPaterno, a.apellidoMaterno]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return t || '—';
}

function textoInmuebleDesdeRef(inmRef: unknown): string {
  if (inmRef == null || typeof inmRef !== 'object' || Array.isArray(inmRef)) {
    return '';
  }
  return String((inmRef as Record<string, unknown>)['inmueble'] ?? '').trim();
}

export function nombreInmuebleDesdeContratoApi(
  contrato: ArrendatarioContratoApi | null | undefined,
): string {
  if (!contrato) return '';
  return textoInmuebleDesdeRef(contrato.inmueble);
}

export function nombreInmuebleDesdeArrendatarioApi(
  item: ArrendatarioApiItem,
  contrato?: ArrendatarioContratoApi | null,
): string {
  const desdeContrato = nombreInmuebleDesdeContratoApi(contrato ?? undefined);
  if (desdeContrato) return desdeContrato;
  return textoInmuebleDesdeRef(item['inmueble']);
}

export function buildExpedienteArrendatarioLista(
  item: ArrendatarioApiItem,
): MonitoreoExpedienteDoc[] {
  const archivos = Array.isArray(item.archivos) ? item.archivos : [];
  return archivos
    .filter((a) => String(a?.url ?? '').trim() || String(a?.nombre ?? '').trim())
    .sort((a, b) =>
      String(b.fhRegistro ?? '').localeCompare(String(a.fhRegistro ?? '')),
    )
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

export function buildServiciosMonitoreoArrendatario(
  item: ArrendatarioApiItem,
): MonitoreoServicioFila[] {
  const servicios = Array.isArray(item.servicios) ? item.servicios : [];
  return servicios.map((s) => {
    const tipo = s.tipoServicio;
    const concepto =
      String(tipo?.nombre ?? '').trim() ||
      String(s['nombre'] ?? '').trim() ||
      'Servicio';
    return {
      concepto,
      contrato: String(s.numeroContrato ?? '').trim() || '—',
      fechaPago: fechaGridDesdeApi(s.fechaPago),
      fechaLimitePago: fechaGridDesdeApi(s.ultimoDiaPago),
      urlComprobante: String(s.urlComprobante ?? '').trim() || undefined,
    };
  });
}

export function serviciosArrendatarioPagoOpciones(
  item: ArrendatarioApiItem,
): ServicioArrendatarioPagoOpcion[] {
  const servicios = Array.isArray(item.servicios) ? item.servicios : [];
  return servicios
    .map((s) => {
      const id = Number(s.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const tipo = s.tipoServicio;
      const nombre =
        String(tipo?.nombre ?? '').trim() || `Servicio ${id}`;
      return { id: Math.floor(id), nombre };
    })
    .filter((x): x is ServicioArrendatarioPagoOpcion => x != null);
}

export function urlsGaleriaArrendatario(item: ArrendatarioApiItem): string[] {
  const archivos = Array.isArray(item.archivos) ? item.archivos : [];
  const vistos = new Set<string>();
  return archivos
    .filter((a) => {
      const url = String(
        a.url ?? (a as Record<string, unknown>)['archivoUrl'] ?? '',
      ).trim();
      const nombre = String(a.nombre ?? '').trim();
      if (!url || !esImagenArchivo(url, nombre)) return false;
      const clave = url.toLowerCase();
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .map((a) => urlArchivoNavegador(String(a.url ?? '').trim()))
    .filter((u) => u.length > 0);
}

/** Archivo «Contrato de renta» en `archivos` (tarjeta Documentación del local). */
export function archivoContratoRentaArrendatario(
  item: ArrendatarioApiItem,
): { url: string; nombre: string } | null {
  const archivos = Array.isArray(item.archivos) ? item.archivos : [];
  for (const a of archivos) {
    const nombre = String(a.nombre ?? '').trim();
    const url = String(a.url ?? '').trim();
    if (!url) continue;
    const key = nombre.toLowerCase();
    if (key === 'contrato de renta' || (key.includes('contrato') && key.includes('renta'))) {
      return { url, nombre: nombre || 'Contrato de renta' };
    }
  }
  const fallback = urlContratoRentaArrendatario(item);
  if (fallback) {
    return { url: fallback, nombre: 'Contrato de renta' };
  }
  return null;
}

export function urlDocumentacionArrendatario(item: ArrendatarioApiItem): string {
  const contrato = archivoContratoRentaArrendatario(item);
  if (contrato?.url) return contrato.url;
  const fachada = urlFachadaDesdeArchivos(item as Record<string, unknown>);
  if (fachada) return fachada;
  const galeria = urlsGaleriaArrendatario(item);
  return galeria[0] ?? '';
}

export function documentacionLocalEsPdf(url: string, nombre: string): boolean {
  return esPdfArchivo(url, nombre);
}

function importeNumericoContrato(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function importesContratoCoinciden(
  c: ArrendatarioContratoApi,
  monto: number,
): boolean {
  const tolerancia = 0.01;
  const candidatos = [c.rentaTotal, c.subTotalRenta, c.montoAdelanto];
  return candidatos.some((raw) => {
    const n = importeNumericoContrato(raw);
    return n != null && Math.abs(n - monto) <= tolerancia;
  });
}

/** IDs de local asociados al contrato en la respuesta del API. */
export function idLocalesDesdeContratoApi(
  c: ArrendatarioContratoApi,
): number[] {
  const ids = new Set<number>();

  const rawIdLocales = c['idLocales'];
  if (Array.isArray(rawIdLocales)) {
    for (const x of rawIdLocales) {
      const n = Number(x);
      if (Number.isFinite(n) && n > 0) ids.add(Math.trunc(n));
    }
  }

  const direct = Number(c.idLocal);
  if (Number.isFinite(direct) && direct > 0) ids.add(Math.trunc(direct));

  const loc = c.local;
  if (loc != null && typeof loc === 'object') {
    const idLoc = Number(loc.id ?? (loc as Record<string, unknown>)['idLocal']);
    if (Number.isFinite(idLoc) && idLoc > 0) ids.add(Math.trunc(idLoc));
  }

  const filas = c['contratoLocales'];
  if (Array.isArray(filas)) {
    for (const raw of filas) {
      if (raw == null || typeof raw !== 'object') continue;
      const fila = raw as Record<string, unknown>;
      const idFila = Number(fila['idLocal']);
      if (Number.isFinite(idFila) && idFila > 0) {
        ids.add(Math.trunc(idFila));
        continue;
      }
      const locFila = fila['local'];
      if (locFila != null && typeof locFila === 'object' && !Array.isArray(locFila)) {
        const idLoc = Number((locFila as Record<string, unknown>)['id']);
        if (Number.isFinite(idLoc) && idLoc > 0) ids.add(Math.trunc(idLoc));
      }
    }
  }

  return [...ids];
}

function contratoTieneVinculoLocalExplicito(
  c: ArrendatarioContratoApi,
  idLocal: number,
): boolean {
  return idLocalesDesdeContratoApi(c).includes(idLocal);
}

function fhRegistroContrato(c: ArrendatarioContratoApi): string {
  return String(c['fhRegistro'] ?? '').trim();
}

function ordenarContratosPorRegistro(
  contratos: ArrendatarioContratoApi[],
): ArrendatarioContratoApi[] {
  return [...contratos].sort((a, b) =>
    fhRegistroContrato(b).localeCompare(fhRegistroContrato(a)),
  );
}

function vigenciaTextoContratoLocal(c: ArrendatarioContratoApi): string {
  const ini = fechaGridDesdeApi(c.fechaInicioContrato);
  const fin = fechaGridDesdeApi(c.fechaTerminoContrato);
  if (ini && fin) return `${ini} — ${fin}`;
  return ini || fin || '—';
}

function etiquetaMonedaContrato(c: ArrendatarioContratoApi): string {
  const m = String(c.moneda ?? '').trim();
  return m || 'MXN';
}

/** Tarjeta resumida de un contrato en el detalle del local. */
export interface ContratoLocalResumen {
  id: number;
  titulo: string;
  fechaRegistroTexto: string;
  vigenciaTexto: string;
  /** Total renta del contrato (`rentaTotal`). */
  rentaContratoFmt: string;
  /** Total mantenimiento del contrato (`mantenimientoTotal`). */
  mantenimientoContratoFmt: string;
  metrosRentadosTexto: string;
  moneda: string;
  observacionesCorta: string;
  esVigente: boolean;
  vinculoLocal: 'explicito' | 'inmueble' | 'renta';
}

function importeContratoFormateado(v: unknown): string {
  const r = formatearMoneda(v);
  return r !== '—' ? r : '';
}

function truncarObservaciones(texto: string, max = 72): string {
  const s = texto.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function buildResumenContratoLocal(
  c: ArrendatarioContratoApi,
  esVigente: boolean,
  vinculoLocal: ContratoLocalResumen['vinculoLocal'],
): ContratoLocalResumen | null {
  const id = Number(c.id);
  if (!Number.isFinite(id) || id <= 0) return null;

  const moneda = etiquetaMonedaContrato(c);
  const rentaContratoFmt = importeContratoFormateado(c.rentaTotal);
  const mantenimientoContratoFmt = importeContratoFormateado(
    c.mantenimientoTotal,
  );
  const metros = Number(c.metrosRentados);
  const metrosTexto =
    Number.isFinite(metros) && metros > 0
      ? `${metros % 1 === 0 ? metros : metros.toFixed(2)} m²`
      : '—';
  const obs = truncarObservaciones(String(c.observaciones ?? ''));
  const fh = fhRegistroContrato(c);
  let fechaRegistroTexto = '—';
  if (fh) {
    const d = new Date(fh);
    fechaRegistroTexto = Number.isNaN(d.getTime())
      ? fh.slice(0, 10)
      : d.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
  }

  return {
    id: Math.trunc(id),
    titulo: `Contrato #${Math.trunc(id)}`,
    fechaRegistroTexto,
    vigenciaTexto: vigenciaTextoContratoLocal(c),
    rentaContratoFmt,
    mantenimientoContratoFmt,
    metrosRentadosTexto: metrosTexto,
    moneda,
    observacionesCorta: obs || 'Sin observaciones',
    esVigente,
    vinculoLocal,
  };
}

/**
 * Contratos del arrendatario aplicables al local en contexto.
 * Prioriza vínculo explícito (`contratoLocales`, `idLocal`); si el API no lo trae,
 * filtra por inmueble y renta/mensualidad.
 */
export function contratosParaLocalEnArrendatario(
  item: ArrendatarioApiItem,
  idLocal: number | null,
  idInmueble: number | null,
  mensualidadLocal?: number | null,
): ArrendatarioContratoApi[] {
  const contratos = Array.isArray(item.contratos) ? item.contratos : [];
  if (!contratos.length) return [];

  if (idLocal != null && idLocal > 0) {
    const explicitos = contratos.filter((c) =>
      contratoTieneVinculoLocalExplicito(c, idLocal),
    );
    if (explicitos.length) return ordenarContratosPorRegistro(explicitos);
  }

  let candidatos = contratos;
  if (idInmueble != null && idInmueble > 0) {
    candidatos = candidatos.filter((c) => Number(c.idInmueble) === idInmueble);
  }

  const rentaArr = importeNumericoContrato(item.renta);
  const montoRef =
    mensualidadLocal != null && Number.isFinite(mensualidadLocal)
      ? mensualidadLocal
      : rentaArr;

  if (montoRef != null) {
    const porRenta = candidatos.filter((c) =>
      importesContratoCoinciden(c, montoRef),
    );
    if (porRenta.length) return ordenarContratosPorRegistro(porRenta);
  }

  return ordenarContratosPorRegistro(candidatos);
}

export function buildContratosLocalResumenLista(
  item: ArrendatarioApiItem,
  idLocal: number | null,
  idInmueble: number | null,
  mensualidadLocal?: number | null,
): ContratoLocalResumen[] {
  const filtrados = contratosParaLocalEnArrendatario(
    item,
    idLocal,
    idInmueble,
    mensualidadLocal,
  );
  const tieneExplicito =
    idLocal != null &&
    idLocal > 0 &&
    filtrados.some((c) => contratoTieneVinculoLocalExplicito(c, idLocal));

  return filtrados
    .map((c, index) => {
      let vinculo: ContratoLocalResumen['vinculoLocal'] = 'inmueble';
      if (
        idLocal != null &&
        idLocal > 0 &&
        contratoTieneVinculoLocalExplicito(c, idLocal)
      ) {
        vinculo = 'explicito';
      } else if (!tieneExplicito) {
        vinculo = 'renta';
      }
      return buildResumenContratoLocal(c, index === 0, vinculo);
    })
    .filter((x): x is ContratoLocalResumen => x != null);
}

export function seleccionarContratoArrendatario(
  item: ArrendatarioApiItem,
  idContrato: number | null,
  idLocal: number | null,
  idInmueble?: number | null,
  mensualidadLocal?: number | null,
): ArrendatarioContratoApi | null {
  const lista = contratosParaLocalEnArrendatario(
    item,
    idLocal,
    idInmueble ?? null,
    mensualidadLocal,
  );
  if (!lista.length) return null;

  if (idContrato != null && idContrato > 0) {
    const hit = lista.find((c) => Number(c.id) === idContrato);
    if (hit) return hit;
  }

  return lista[0] ?? null;
}

export function urlContratoRentaArrendatario(
  item: ArrendatarioApiItem,
): string | null {
  const archivos = Array.isArray(item.archivos) ? item.archivos : [];
  for (const a of archivos) {
    const nombre = String(a.nombre ?? '').trim().toLowerCase();
    const url = String(a.url ?? '').trim();
    if (!url) continue;
    if (nombre.includes('contrato') && nombre.includes('renta')) {
      return url;
    }
  }
  const contrato = seleccionarContratoArrendatario(item, null, null);
  const doc = contrato?.['documentoUrl'] ?? contrato?.['documento'];
  if (doc != null && String(doc).trim()) return String(doc).trim();
  return null;
}

export function estatusLocalDesdeArrendatario(
  item: ArrendatarioApiItem,
  idContrato: number | null,
  idLocal: number | null,
): 'ocupado' | 'libre' {
  const contrato = seleccionarContratoArrendatario(item, idContrato, idLocal);
  const est = Number(contrato?.local?.estatus);
  if (est === 1) return 'libre';
  return 'ocupado';
}

export function tituloLocalDesdeArrendatario(
  item: ArrendatarioApiItem,
  idContrato: number | null,
  idLocal: number | null,
  fallback: string,
): string {
  const contrato = seleccionarContratoArrendatario(item, idContrato, idLocal);
  const nombre = String(contrato?.local?.nombre ?? '').trim();
  return nombre || fallback;
}

/** Fila de GET `/arrendatarios/servicios/{id}` — opciones para alta de pagos del arrendatario. */
export interface ServicioArrendatarioListaPago {
  id: number;
  etiquetaTipoServicio: string;
  numeroContrato?: string;
}

export function extraerServiciosArrendatarioListaPago(resp: unknown): ServicioArrendatarioListaPago[] {
  let rows: unknown = resp;
  if (resp != null && typeof resp === 'object' && !Array.isArray(resp)) {
    const r = resp as Record<string, unknown>;
    rows = r['data'] ?? r['items'];
  }
  if (!Array.isArray(rows)) return [];
  const out: ServicioArrendatarioListaPago[] = [];
  for (const item of rows) {
    const row = item as Record<string, unknown>;
    const id = Number(row['id']);
    if (!Number.isFinite(id) || id <= 0) continue;
    const tipoObj = row['tipoServicio'];
    let nombreTipo = '';
    if (tipoObj != null && typeof tipoObj === 'object') {
      nombreTipo = String((tipoObj as Record<string, unknown>)['nombre'] ?? '').trim();
    }
    if (!nombreTipo) nombreTipo = `Servicio ${id}`;
    const numeroContrato =
      row['numeroContrato'] != null ? String(row['numeroContrato']).trim() : '';
    out.push({
      id: Math.floor(id),
      etiquetaTipoServicio: nombreTipo,
      numeroContrato: numeroContrato || undefined,
    });
  }
  return out;
}