/** Mensajes del API cuando no hay clientes pero responde como error. */
const MENSAJES_LISTADO_CLIENTES_VACIO = [
  'ocurrio un error al obtener listado de los clientes',
];

function normalizarMensajeApi(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) return '';
  return message
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** El backend a veces responde error HTTP o `{ message }` cuando el listado está vacío. */
export function mensajeIndicaListadoClientesVacio(message: unknown): boolean {
  const norm = normalizarMensajeApi(message);
  if (!norm) return false;
  return MENSAJES_LISTADO_CLIENTES_VACIO.some((fragmento) => norm.includes(fragmento));
}

export function esClienteListadoVacioEnApi(resp: unknown): boolean {
  if (resp == null) return false;
  if (Array.isArray(resp)) return resp.length === 0;
  if (typeof resp !== 'object') return false;

  const body = resp as Record<string, unknown>;
  if (Array.isArray(body['data'])) {
    return body['data'].length === 0;
  }
  return mensajeIndicaListadoClientesVacio(body['message']);
}

export function esErrorHttpListadoClientesVacio(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;

  const e = err as Record<string, unknown>;
  if (mensajeIndicaListadoClientesVacio(e['message'])) return true;

  const nested = e['error'];
  if (nested != null && typeof nested === 'object') {
    return mensajeIndicaListadoClientesVacio(
      (nested as Record<string, unknown>)['message'],
    );
  }
  if (typeof nested === 'string') {
    return mensajeIndicaListadoClientesVacio(nested);
  }
  return false;
}

/** Respuesta GET `/clientes/{id}` (con o sin envoltorio `data`). */
export function extraerClienteDetalleApi(resp: unknown): Record<string, unknown> {
  if (resp == null || typeof resp !== 'object') return {};
  const r = resp as Record<string, unknown>;
  const envuelto = r['data'];
  if (envuelto != null && typeof envuelto === 'object' && !Array.isArray(envuelto)) {
    return envuelto as Record<string, unknown>;
  }
  if (r['id'] != null || r['rfc'] != null) {
    return r;
  }
  return {};
}

export function urlOCadenaDeArchivoApi(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const u = o['url'] ?? o['Url'];
    if (typeof u === 'string') return u.trim();
  }
  return '';
}

export function nombreDeArchivoApi(v: unknown, fallback: string): string {
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const n = o['nombre'] ?? o['name'];
    if (typeof n === 'string' && n.trim()) return n.trim();
  }
  const url = urlOCadenaDeArchivoApi(v);
  if (url) {
    const seg = url.split('/').pop()?.split('?')[0] ?? '';
    if (seg) return seg;
  }
  return fallback;
}

export function urlLogotipoCliente(item: Record<string, unknown>): string {
  return urlOCadenaDeArchivoApi(item['logotipo']);
}

/** Archivos planos en GET lista/detalle cliente (`string` URL), sin logotipo. */
const CAMPOS_ARCHIVO_CLIENTE: { key: string; etiqueta: string }[] = [
  { key: 'constanciaSituacionFiscal', etiqueta: 'Constancia situación fiscal' },
  { key: 'comprobanteDomicilio', etiqueta: 'Comprobante domicilio' },
  { key: 'actaConstitutiva', etiqueta: 'Acta constitutiva' },
  { key: 'licenciaFuncionamiento', etiqueta: 'Licencia de funcionamiento' },
  { key: 'constanciaProteccionCivil', etiqueta: 'Constancia protección civil' },
  { key: 'usoSuelo', etiqueta: 'Uso de suelo' },
  { key: 'planoCatastral', etiqueta: 'Plano catastral' },
  { key: 'poderRepresentanteLegal', etiqueta: 'Poder representante legal' },
  { key: 'ineRepresentanteLegal', etiqueta: 'INE representante legal' },
];

export interface ClienteArchivoItem {
  url: string;
  nombre: string;
}

/** Construye la lista de documentos para tarjetas tipo inmuebles/arrendatarios. */
export function construirArchivosListadoCliente(
  item: Record<string, unknown>,
): ClienteArchivoItem[] {
  const out: ClienteArchivoItem[] = [];
  for (const { key, etiqueta } of CAMPOS_ARCHIVO_CLIENTE) {
    const url = urlOCadenaDeArchivoApi(item[key]);
    if (!url) continue;
    out.push({
      url,
      nombre: etiqueta,
    });
  }
  return out;
}

export interface ClienteGridRow {
  id: number;
  NombreCompleto: string;
  nombre: string;
  telefono: string;
  rfc: string;
  correo: string;
  tipoPersona: string;
  nombreEncargado: string;
  telefonoEncargado: string;
  correoEncargado: string;
  direccionCompleta: string;
  /** 1 activo, 0 inactivo (alinea con filas previas del grid). */
  estatus: number;
  estatusCliente: number;
  numArchivos: number;
  numSocios: number;
  logotipo: string;
  etiquetaBusqueda: string;
  /** Incluye `archivos` (derivados) y `sociosArrendadores` del API. */
  detalle: Record<string, unknown>;
}

function construirTextoBusquedaCliente(
  item: Record<string, unknown>,
  NombreCompleto: string,
  direccionCompleta: string,
): string {
  const parts: string[] = [];
  const push = (v: unknown): void => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) parts.push(s.toLowerCase());
  };

  push(NombreCompleto);
  push(direccionCompleta);
  push(item['rfc']);
  push(item['correo']);
  push(item['telefono']);
  push(item['nombreEncargado']);
  push(item['municipio']);
  push(item['estado']);

  const socios = item['sociosArrendadores'];
  if (Array.isArray(socios)) {
    for (const s of socios) {
      if (s != null && typeof s === 'object') {
        const o = s as Record<string, unknown>;
        push(o['nombre']);
        push(o['rfc']);
      }
    }
  }

  for (const { key } of CAMPOS_ARCHIVO_CLIENTE) {
    push(urlOCadenaDeArchivoApi(item[key]));
  }
  push(urlLogotipoCliente(item));

  return parts.join(' ');
}

function strCelda(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Texto para celdas del grid: null, '' o solo espacios → em dash. */
function celda(v: unknown): string {
  const s = strCelda(v);
  return s !== '' ? s : '—';
}

function nombreCompletoCliente(item: Record<string, unknown>): string {
  const tipo = Number(item['tipoPersona']);
  const nombre = strCelda(item['nombre']);
  if (tipo === 2) return nombre || '—';
  const partes = [
    nombre,
    strCelda(item['apellidoPaterno']),
    strCelda(item['apellidoMaterno']),
  ].filter(Boolean);
  return partes.join(' ') || '—';
}

function direccionCompletaCliente(item: Record<string, unknown>): string {
  const calle = strCelda(item['calle']);
  const numExt = strCelda(item['numeroExterior']);
  const numInt = strCelda(item['numeroInterior']);
  const cp = strCelda(item['cp']);
  const entre = strCelda(item['entreCalles']);
  const joined = [
    calle ? `Calle ${calle}` : '',
    numExt ? `#${numExt}` : '',
    numInt ? `Int. ${numInt}` : '',
    strCelda(item['colonia']),
    strCelda(item['municipio']),
    strCelda(item['estado']),
    cp ? `CP ${cp}` : '',
    entre ? `(Entre calles: ${entre})` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return joined || '—';
}

export function mapClientesApiToGridRows(items: unknown[]): ClienteGridRow[] {
  if (!Array.isArray(items)) return [];

  return items.map((raw, index) => {
    const item =
      raw != null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    const id = Number(item['id']);
    const idFinal = Number.isFinite(id) ? id : index + 1;

    const NombreCompleto = nombreCompletoCliente(item);
    const direccionCompleta = direccionCompletaCliente(item);
    const nombre = strCelda(item['nombre']);

    const estatusRaw = item['estatusCliente'] ?? item['estatus'] ?? 0;
    const estatus = Number(estatusRaw);

    const archivos = construirArchivosListadoCliente(item);
    const socios = Array.isArray(item['sociosArrendadores'])
      ? item['sociosArrendadores']
      : [];

    const detalle: Record<string, unknown> = {
      ...item,
      id: idFinal,
      archivos,
    };

    const tipoPersona =
      item['tipoPersona'] == 1
        ? 'Físico'
        : item['tipoPersona'] == 2
          ? 'Moral'
          : '—';

    const busqueda = construirTextoBusquedaCliente(
      item,
      NombreCompleto === '—' ? '' : NombreCompleto,
      direccionCompleta === '—' ? '' : direccionCompleta,
    );

    return {
      id: idFinal,
      nombre: nombre || (NombreCompleto !== '—' ? NombreCompleto : '') || '—',
      NombreCompleto,
      telefono: celda(item['telefono']),
      rfc: celda(item['rfc']),
      correo: celda(item['correo']),
      tipoPersona,
      nombreEncargado: celda(item['nombreEncargado']),
      telefonoEncargado: celda(item['telefonoEncargado']),
      correoEncargado: celda(item['correoEncargado']),
      direccionCompleta,
      estatus: Number.isFinite(estatus) ? estatus : 0,
      estatusCliente: Number.isFinite(estatus) ? estatus : 0,
      numArchivos: archivos.length,
      numSocios: Array.isArray(socios) ? socios.length : 0,
      logotipo: urlLogotipoCliente(item),
      etiquetaBusqueda: busqueda,
      detalle,
    };
  });
}
