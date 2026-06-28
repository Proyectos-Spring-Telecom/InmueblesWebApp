import {
  formatearFecha,
  formatearFechaHora,
  formatearMoneda,
  nombreArrendador,
} from '../inmuebles/inmuebles-list.mapper';

/** Fila principal del grid + objeto API para master-detail. */
export interface ArrendatarioGridRow {
  id: number;
  arrendatario: string;
  tipoPersonaLabel: string;
  rfc: string;
  rentaFmt: string;
  fechaInicioFmt: string;
  fechaFinFmt: string;
  tiempoRentaTexto: string;
  representanteNombre: string;
  telefonoRepresentante: string;
  correoRepresentante: string;
  arrendadorNombre: string;
  inmuebleVinculado: string;
  direccionInmuebleVinculado: string;
  estatusLabel: string;
  estatusClass: string;
  fhRegistroFmt: string;
  numServicios: number;
  numArchivos: number;
  numSocios: number;
  numContratos: number;
  tieneMapa: boolean;
  lat: number | null;
  lng: number | null;
  etiquetaBusqueda: string;
  /** Objeto API enriquecido con ``id`` para rutas y vistas. */
  detalle: Record<string, unknown>;
}

function numOpt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function resolverIdArrendatarioApi(item: Record<string, unknown>): number | null {
  const keys = ['id', 'idArrendatario', 'id_arrendatario'] as const;
  for (const k of keys) {
    const n = Number(item[k]);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }

  const archivos = item['archivos'];
  if (Array.isArray(archivos)) {
    for (const a of archivos) {
      if (a != null && typeof a === 'object') {
        const n = Number((a as Record<string, unknown>)['idArrendatario']);
        if (Number.isFinite(n) && n > 0) return Math.trunc(n);
      }
    }
  }

  const contratos = item['contratos'];
  if (Array.isArray(contratos)) {
    for (const c of contratos) {
      if (c != null && typeof c === 'object') {
        const n = Number((c as Record<string, unknown>)['idArrendatario']);
        if (Number.isFinite(n) && n > 0) return Math.trunc(n);
      }
    }
  }

  return null;
}

/** Filas de respuestas paginadas `{ data: [], paginated: {} }`. */
export function extraerFilasPaginadasApi(resp: unknown): Record<string, unknown>[] {
  if (resp == null) return [];
  if (Array.isArray(resp)) {
    return resp.filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  if (typeof resp !== 'object') return [];
  const r = resp as Record<string, unknown>;
  let rows: unknown = r['data'];
  if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
    const bag = rows as Record<string, unknown>;
    rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (x): x is Record<string, unknown> =>
      x != null && typeof x === 'object' && !Array.isArray(x),
  );
}

/** Nombre visible: campo `arrendatario` (string u objeto), `nombre` o `razonSocial`. */
export function nombreArrendatarioDesdeApi(item: Record<string, unknown>): string {
  const raw = item['arrendatario'];
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s) return s;
  }
  if (raw != null && typeof raw === 'object') {
    const a = raw as Record<string, unknown>;
    const s = String(a['arrendatario'] ?? a['nombre'] ?? a['razonSocial'] ?? '').trim();
    if (s) return s;
  }
  const alt = String(
    item['nombre'] ?? item['razonSocial'] ?? item['nombreArrendatario'] ?? '',
  ).trim();
  if (alt) return alt;
  const id = resolverIdArrendatarioApi(item);
  return id != null ? `Arrendatario #${id}` : '';
}

function truncarEtiquetaContrato(texto: string, max = 48): string {
  const s = texto.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function nombresLocalesContratoApi(c: Record<string, unknown>): string[] {
  const filas = c['contratoLocales'];
  if (!Array.isArray(filas)) return [];
  const out: string[] = [];
  for (const fila of filas) {
    if (fila == null || typeof fila !== 'object') continue;
    const loc = (fila as Record<string, unknown>)['local'];
    if (loc == null || typeof loc !== 'object') continue;
    const nombre = String((loc as Record<string, unknown>)['nombre'] ?? '').trim();
    if (nombre && !out.includes(nombre)) out.push(nombre);
  }
  return out;
}

function resumenLocalesContratoApi(locales: string[]): string {
  return locales[0] ?? '';
}

/** Etiqueta corta del select: título identificable + inmueble + descripción si aporta contexto. */
export function etiquetaContratoArrendatarioApi(c: Record<string, unknown>): string {
  const id = Number(c['id'] ?? c['idContrato']);
  const num = String(c['numeroContrato'] ?? c['numero'] ?? '').trim();
  const descripcion = String(c['descripcion'] ?? c['observaciones'] ?? '').trim();
  const locales = resumenLocalesContratoApi(nombresLocalesContratoApi(c));

  const inm = c['inmueble'];
  const inmueble =
    inm != null && typeof inm === 'object'
      ? String((inm as Record<string, unknown>)['inmueble'] ?? '').trim()
      : '';

  let titulo = num || locales;
  if (!titulo && Number.isFinite(id) && id > 0) {
    titulo = `Contrato ${Math.trunc(id)}`;
  }
  if (!titulo) titulo = 'Contrato';

  if (
    inmueble &&
    !titulo.toLowerCase().includes(inmueble.toLowerCase())
  ) {
    titulo = `${titulo} — ${inmueble}`;
  }

  if (
    descripcion &&
    !titulo.toLowerCase().includes(descripcion.toLowerCase())
  ) {
    titulo = `${titulo} · ${descripcion}`;
  }

  return truncarEtiquetaContrato(titulo, 72);
}

export function etiquetaTipoPersonaArrendatario(raw: unknown): string {
  const n = Number(raw);
  if (n === 1) return 'Persona física';
  if (n === 2) return 'Persona moral';
  return '—';
}

export function etiquetaEstatusArrendatarioRegistro(raw: unknown): string {
  const n = Number(raw);
  if (n === 1) return 'Activo';
  if (n === 0) return 'Inactivo';
  return '—';
}

export function claseEstatusArrendatarioRegistro(raw: unknown): string {
  const n = Number(raw);
  if (n === 1) return 'estatus estatus-activo';
  if (n === 0) return 'estatus estatus-inactivo';
  return 'estatus';
}

function fhContratoArrendatario(c: Record<string, unknown>): string {
  return String(c['fhRegistro'] ?? c['fh_registro'] ?? '').trim();
}

/** Renta total del contrato principal; fallback al campo legacy `renta` del arrendatario. */
export function rentaTotalArrendatarioApi(item: Record<string, unknown>): unknown {
  const contrato = contratoPrincipalArrendatarioApi(item);
  const rentaContrato = contrato?.['rentaTotal'];
  if (rentaContrato != null && String(rentaContrato).trim() !== '') {
    return rentaContrato;
  }
  return item['renta'];
}

/** Contrato principal: el más reciente por `fhRegistro`; si empatan, el primero en el arreglo. */
export function contratoPrincipalArrendatarioApi(
  item: Record<string, unknown>,
): Record<string, unknown> | null {
  const contratos = item['contratos'];
  if (!Array.isArray(contratos) || contratos.length === 0) return null;

  const validos = contratos.filter(
    (x): x is Record<string, unknown> =>
      x != null && typeof x === 'object' && !Array.isArray(x),
  );
  if (validos.length === 0) return null;

  return [...validos].sort((a, b) =>
    fhContratoArrendatario(b).localeCompare(fhContratoArrendatario(a)),
  )[0];
}

function fechaIsoVigenciaContrato(
  contrato: Record<string, unknown> | null,
  keysContrato: readonly string[],
  keyLegacyItem: string,
  item: Record<string, unknown>,
): string {
  if (contrato) {
    for (const k of keysContrato) {
      const v = contrato[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  const legacy = item[keyLegacyItem];
  if (legacy != null && String(legacy).trim()) return String(legacy).trim();
  return '';
}

/** Fechas de vigencia desde el contrato principal o campos legacy del arrendatario. */
export function fechasVigenciaArrendatarioApi(item: Record<string, unknown>): {
  inicio: string;
  fin: string;
} {
  const contrato = contratoPrincipalArrendatarioApi(item);
  return {
    inicio: fechaIsoVigenciaContrato(
      contrato,
      ['fechaInicioContrato', 'fecha_inicio_contrato'],
      'fechaInicio',
      item,
    ),
    fin: fechaIsoVigenciaContrato(
      contrato,
      ['fechaTerminoContrato', 'fecha_termino_contrato'],
      'fechaFin',
      item,
    ),
  };
}

function parseFechaUtc(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Duración legible entre inicio y fin de contrato (años, meses o días). */
export function textoDuracionContratoApi(inicioRaw: string, finRaw: string): string {
  const inicio = parseFechaUtc(inicioRaw);
  const fin = parseFechaUtc(finRaw);
  if (!inicio || !fin || fin < inicio) return '—';

  const utcDia = (d: Date): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diffDays = Math.round((utcDia(fin) - utcDia(inicio)) / 86400000);
  if (diffDays <= 0) return '1 día';

  let years =
    fin.getUTCFullYear() -
    inicio.getUTCFullYear() -
    (fin.getUTCMonth() < inicio.getUTCMonth() ||
    (fin.getUTCMonth() === inicio.getUTCMonth() && fin.getUTCDate() < inicio.getUTCDate())
      ? 1
      : 0);
  if (years >= 1) return years === 1 ? '1 año' : `${years} años`;

  let months =
    (fin.getUTCFullYear() - inicio.getUTCFullYear()) * 12 +
    (fin.getUTCMonth() - inicio.getUTCMonth());
  if (fin.getUTCDate() < inicio.getUTCDate()) months -= 1;
  if (months >= 1) return months === 1 ? '1 mes' : `${months} meses`;

  return diffDays === 1 ? '1 día' : `${diffDays} días`;
}

function textoTiempoRentaLegacy(item: Record<string, unknown>): string {
  const legacy = item['tiempoRenta'];
  if (legacy == null || String(legacy).trim() === '') return '—';
  const tr = String(legacy).trim();
  if (/^\d+$/.test(tr)) return `${tr} ${tr === '1' ? 'año' : 'años'}`;
  return tr;
}

export function textoTiempoRentaArrendatarioApi(item: Record<string, unknown>): string {
  const { inicio, fin } = fechasVigenciaArrendatarioApi(item);
  if (inicio && fin) return textoDuracionContratoApi(inicio, fin);
  return textoTiempoRentaLegacy(item);
}

export function primerInmuebleContrato(item: Record<string, unknown>): {
  nombre: string;
  direccion: string;
} {
  const contratos = item['contratos'];
  if (!Array.isArray(contratos) || contratos.length === 0) {
    return { nombre: '—', direccion: '—' };
  }
  const c0 = contratos[0];
  if (c0 == null || typeof c0 !== 'object') return { nombre: '—', direccion: '—' };
  const inm = (c0 as Record<string, unknown>)['inmueble'];
  if (inm == null || typeof inm !== 'object') return { nombre: '—', direccion: '—' };
  const im = inm as Record<string, unknown>;
  return {
    nombre: String(im['inmueble'] ?? '—').trim() || '—',
    direccion: String(im['direccionFiscal'] ?? '—').trim() || '—',
  };
}

export function construirTextoBusquedaArrendatario(item: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown): void => {
    if (v == null) return;
    const s = String(v).trim();
    if (s) parts.push(s.toLowerCase());
  };

  push(item['arrendatario']);
  push(item['nombre']);
  push(item['rfc']);
  push(item['representanteLegal']);
  push(item['correoRepresentante']);
  push(item['telefonoRepresentante']);
  push(nombreArrendador(item['arrendador'] as Record<string, unknown> | undefined));

  const { nombre, direccion } = primerInmuebleContrato(item);
  push(nombre);
  push(direccion);

  const contratos = item['contratos'];
  if (Array.isArray(contratos)) {
    for (const c of contratos) {
      if (c == null || typeof c !== 'object') continue;
      const contrato = c as Record<string, unknown>;
      const filas = contrato['contratoLocales'];
      if (!Array.isArray(filas)) continue;
      for (const fila of filas) {
        if (fila == null || typeof fila !== 'object') continue;
        const loc = (fila as Record<string, unknown>)['local'];
        if (loc != null && typeof loc === 'object') {
          const l = loc as Record<string, unknown>;
          push(l['nombre']);
          push(l['giro']);
        }
      }
    }
  }

  for (const k of Object.keys(item)) {
    const v = item[k];
    if (typeof v === 'string') push(v);
  }

  return parts.join(' ');
}

/** Respuesta GET `/arrendatarios/{id}` (con o sin envoltorio `data`). */
export function extraerArrendatarioDetalleApi(resp: unknown): Record<string, unknown> {
  if (resp == null || typeof resp !== 'object') return {};
  const r = resp as Record<string, unknown>;
  const envuelto = r['data'];
  if (envuelto != null && typeof envuelto === 'object' && !Array.isArray(envuelto)) {
    return envuelto as Record<string, unknown>;
  }
  if (r['id'] != null || r['arrendatario'] != null) {
    return r;
  }
  return {};
}

export function mapArrendatariosApiToGridRows(rows: unknown[]): ArrendatarioGridRow[] {
  const out: ArrendatarioGridRow[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const raw = rows[idx];
    const item =
      raw != null && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    let id = resolverIdArrendatarioApi(item);
    if (id == null) {
      console.warn('[lista-arrendatarios] Registro sin id válido; se usa índice temporal', item);
      id = idx + 1;
    }

    const lat = numOpt(item['lat']);
    const lng = numOpt(item['lng']);
    const tieneMapa =
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      (lat !== 0 || lng !== 0);

    const inv = primerInmuebleContrato(item);
    const vigencia = fechasVigenciaArrendatarioApi(item);
    const estatusRaw = item['estatus'];
    const servicios = Array.isArray(item['servicios']) ? item['servicios'] : [];
    const archivos = Array.isArray(item['archivos']) ? item['archivos'] : [];
    const socios = Array.isArray(item['socios']) ? item['socios'] : [];
    const contratos = Array.isArray(item['contratos']) ? item['contratos'] : [];

    const detalle: Record<string, unknown> = { ...item, id };

    out.push({
      id,
      arrendatario: String(item['arrendatario'] ?? 'Sin nombre').trim() || 'Sin nombre',
      tipoPersonaLabel: etiquetaTipoPersonaArrendatario(item['tipoPersona']),
      rfc: String(item['rfc'] ?? '').trim() || '—',
      rentaFmt: formatearMoneda(rentaTotalArrendatarioApi(item)),
      fechaInicioFmt: formatearFecha(vigencia.inicio) || '—',
      fechaFinFmt: formatearFecha(vigencia.fin) || '—',
      tiempoRentaTexto:
        vigencia.inicio && vigencia.fin
          ? textoDuracionContratoApi(vigencia.inicio, vigencia.fin)
          : textoTiempoRentaLegacy(item),
      representanteNombre: String(item['representanteLegal'] ?? '—').trim() || '—',
      telefonoRepresentante: String(item['telefonoRepresentante'] ?? '—').trim() || '—',
      correoRepresentante: String(item['correoRepresentante'] ?? '—').trim() || '—',
      arrendadorNombre: nombreArrendador(item['arrendador'] as Record<string, unknown> | undefined),
      inmuebleVinculado: inv.nombre,
      direccionInmuebleVinculado: inv.direccion,
      estatusLabel: etiquetaEstatusArrendatarioRegistro(estatusRaw),
      estatusClass: claseEstatusArrendatarioRegistro(estatusRaw),
      fhRegistroFmt: formatearFechaHora(String(item['fhRegistro'] ?? '')) || '—',
      numServicios: servicios.length,
      numArchivos: archivos.length,
      numSocios: socios.length,
      numContratos: contratos.length,
      tieneMapa,
      lat,
      lng,
      etiquetaBusqueda: construirTextoBusquedaArrendatario(item),
      detalle,
    });
  }

  return out;
}
