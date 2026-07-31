export type ClienteInmuebleGridRow = {
  id: number;
  NombreCompleto: string;
  rfc: string;
  telefono: string;
  correo: string;
  tipoPersona: string;
  nombreEncargado: string;
  telefonoEncargado: string;
  correoEncargado: string;
  direccionCompleta: string;
  estatus: number;
  estatusCliente: number;
  logotipo: string;
  actaConstitutiva: string;
  comprobanteDomicilio: string;
  constanciaSituacionFiscal: string;
};

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Texto para celdas del grid: null/vacío → em dash. */
function celda(v: unknown): string {
  const s = str(v);
  return s !== '' ? s : '—';
}

function nombreCompleto(item: Record<string, unknown>): string {
  const tipo = Number(item['tipoPersona']);
  const nombre = str(item['nombre']);
  if (tipo === 2) return nombre || '—';
  const partes = [
    nombre,
    str(item['apellidoPaterno']),
    str(item['apellidoMaterno']),
  ].filter(Boolean);
  return partes.join(' ') || '—';
}

function direccionCompleta(item: Record<string, unknown>): string {
  const joined = [
    str(item['calle']),
    str(item['numeroExterior']) ? `#${str(item['numeroExterior'])}` : '',
    str(item['numeroInterior']) ? `Int. ${str(item['numeroInterior'])}` : '',
    str(item['colonia']),
    str(item['municipio']),
    str(item['estado']),
    str(item['cp']) ? `CP ${str(item['cp'])}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return joined || '—';
}

function urlArchivo(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v !== null && 'url' in v) {
    return str((v as { url: unknown }).url);
  }
  return '';
}

export function mapClientesInmueblesApiToGridRows(raw: unknown): ClienteInmuebleGridRow[] {
  const bag = raw as Record<string, unknown>;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(bag?.['data'])
      ? bag['data']
      : Array.isArray(bag?.['content'])
        ? bag['content']
        : Array.isArray(bag?.['items'])
          ? bag['items']
          : [];

  return (list as Record<string, unknown>[]).map((item) => {
    const estatus = Number(item['estatus'] ?? item['estatusCliente'] ?? 1);
    const tipo = Number(item['tipoPersona']);
    return {
      id: Number(item['id']) || 0,
      NombreCompleto: nombreCompleto(item),
      rfc: celda(item['rfc']),
      telefono: celda(item['telefono']),
      correo: celda(item['correo']),
      tipoPersona: tipo === 2 ? 'Moral' : tipo === 1 ? 'Física' : '—',
      nombreEncargado: celda(item['nombreEncargado']),
      telefonoEncargado: celda(item['telefonoEncargado']),
      correoEncargado: celda(item['correoEncargado']),
      direccionCompleta: direccionCompleta(item),
      estatus,
      estatusCliente: estatus,
      logotipo: urlArchivo(item['logotipo']),
      actaConstitutiva: urlArchivo(item['actaConstitutiva']),
      comprobanteDomicilio: urlArchivo(item['comprobanteDomicilio']),
      constanciaSituacionFiscal: urlArchivo(item['constanciaSituacionFiscal']),
    };
  });
}

export function extraerClienteInmuebleDetalleApi(resp: unknown): Record<string, unknown> {
  const bag = resp as Record<string, unknown>;
  const data = bag?.['data'];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (bag && typeof bag === 'object' && !Array.isArray(bag)) {
    return bag;
  }
  return {};
}

export function totalRegistrosClientesInmuebles(resp: unknown, fallback: number): number {
  const bag = resp as Record<string, unknown>;
  const paginated = bag?.['paginated'] as Record<string, unknown> | undefined;
  const candidates = [
    paginated?.['total'],
    bag?.['totalElements'],
    bag?.['total'],
    bag?.['totalRegistros'],
    (bag?.['data'] as Record<string, unknown> | undefined)?.['totalElements'],
    (bag?.['data'] as Record<string, unknown> | undefined)?.['total'],
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}
