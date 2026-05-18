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
  push(item['representanteLegal']);
  push(item['correoRepresentante']);
  push(item['telefonoRepresentante']);
  push(nombreArrendador(item['arrendador'] as Record<string, unknown> | undefined));

  const { nombre, direccion } = primerInmuebleContrato(item);
  push(nombre);
  push(direccion);

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
      rentaFmt: formatearMoneda(item['renta']),
      fechaInicioFmt: formatearFecha(String(item['fechaInicio'] ?? '')) || '—',
      fechaFinFmt: formatearFecha(String(item['fechaFin'] ?? '')) || '—',
      tiempoRentaTexto:
        item['tiempoRenta'] != null && String(item['tiempoRenta']).trim() !== ''
          ? String(item['tiempoRenta']).trim()
          : '—',
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
