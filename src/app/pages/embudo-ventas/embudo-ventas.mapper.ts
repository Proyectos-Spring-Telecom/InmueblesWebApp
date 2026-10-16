/**
 * Normaliza la respuesta de /embudo-ventas.
 * Acepta camelCase o PascalCase porque el contrato de respuesta no está documentado en Swagger.
 */

export type MedioComunicacion = { id: number; nombre: string };

export type EventoEmbudo = {
  id: number;
  fhProximoEvento: string | null;
  medioComunicacion: number | null;
  medioNombre: string;
  estatus: number;
  comentario: string;
  conclusionEvento: string;
};

export type EmbudoCard = {
  id: number;
  estatus: number;
  idCliente: number | null;
  nombreCliente: string;
  nombreUsuario: string;
  correo: string;
  telefono: string;
  rfc: string;
  esProspecto: boolean | null;
  eventosPendientes: number;
  eventosRealizados: number;
  proximoEvento: EventoEmbudo | string | null;
  fechaCreacion: string | null;
  fechaActualizacion: string | null;
  eventos: EventoEmbudo[];
};

export const MEDIOS_COMUNICACION_DEFAULT: MedioComunicacion[] = [
  { id: 1, nombre: 'Llamada' },
  { id: 2, nombre: 'Correo' },
  { id: 3, nombre: 'Visita' },
];

function pick(obj: any, ...keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function extraerLista(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

export function extraerObjeto(response: any): any {
  if (response?.data && !Array.isArray(response.data)) return response.data;
  return response;
}

export function mapearMedios(response: any): MedioComunicacion[] {
  const lista = extraerLista(response)
    .map((m: any) => ({
      id: num(pick(m, 'id', 'Id')),
      nombre: str(pick(m, 'nombre', 'Nombre')),
    }))
    .filter((m) => m.id > 0 && m.nombre);
  return lista.length ? lista : MEDIOS_COMUNICACION_DEFAULT;
}

function mapearEvento(e: any, medios: MedioComunicacion[]): EventoEmbudo {
  const medioRaw = pick(e, 'medioComunicacion', 'MedioComunicacion', 'idMedioComunicacion', 'IdMedioComunicacion');
  const medioId =
    medioRaw != null && typeof medioRaw === 'object'
      ? num(pick(medioRaw, 'id', 'Id'), NaN)
      : num(medioRaw, NaN);
  const medioNombre =
    (medioRaw != null && typeof medioRaw === 'object' ? str(pick(medioRaw, 'nombre', 'Nombre')) : '') ||
    str(pick(e, 'medioComunicacionNombre', 'nombreMedioComunicacion', 'medio', 'NombreMedioComunicacion')) ||
    medios.find((m) => m.id === medioId)?.nombre ||
    '—';

  return {
    id: num(pick(e, 'id', 'Id', 'idEvento', 'IdEvento', 'idEventoEmbudoVentas', 'IdEventoEmbudoVentas')),
    fhProximoEvento: pick(e, 'fhProximoEvento', 'FhProximoEvento') ?? null,
    medioComunicacion: Number.isFinite(medioId) ? medioId : null,
    medioNombre,
    estatus: num(pick(e, 'estatus', 'Estatus')),
    comentario: str(pick(e, 'comentario', 'Comentario')),
    conclusionEvento: str(pick(e, 'conclusionEvento', 'ConclusionEvento')),
  };
}

export function mapearEmbudo(item: any, medios: MedioComunicacion[]): EmbudoCard {
  const cliente = pick(item, 'cliente', 'Cliente') ?? {};
  const nombreCompleto = [
    pick(cliente, 'nombre', 'Nombre') ?? pick(item, 'nombre', 'Nombre'),
    pick(cliente, 'apellidoPaterno', 'ApellidoPaterno') ?? pick(item, 'apellidoPaterno', 'ApellidoPaterno'),
    pick(cliente, 'apellidoMaterno', 'ApellidoMaterno') ?? pick(item, 'apellidoMaterno', 'ApellidoMaterno'),
  ]
    .map(str)
    .filter(Boolean)
    .join(' ');

  const eventosRaw =
    pick(item, 'eventos', 'Eventos', 'historial', 'eventosEmbudoVentas', 'EventosEmbudoVentas') ?? [];

  const eventos = (Array.isArray(eventosRaw) ? eventosRaw : [])
    .map((e: any) => mapearEvento(e, medios))
    .sort((a, b) => fechaMs(b.fhProximoEvento) - fechaMs(a.fhProximoEvento));

  const idCliente = num(pick(item, 'idCliente', 'IdCliente') ?? pick(cliente, 'id', 'Id'), NaN);
  const esProspecto = pick(item, 'esProspecto', 'EsProspecto');
  const proximoRaw = pick(item, 'proximoEvento', 'ProximoEvento');

  return {
    id: num(pick(item, 'id', 'Id', 'idEmbudoVentas', 'IdEmbudoVentas')),
    estatus: num(pick(item, 'estatus', 'Estatus')),
    idCliente: Number.isFinite(idCliente) ? idCliente : null,
    nombreCliente:
      str(pick(item, 'nombreProspecto', 'NombreProspecto', 'nombreCliente', 'NombreCliente')) ||
      (typeof cliente === 'string' ? str(cliente) : nombreCompleto) ||
      (Number.isFinite(idCliente) ? `Cliente #${idCliente}` : 'Sin nombre'),
    nombreUsuario: str(pick(item, 'nombreUsuario', 'NombreUsuario')),
    correo: str(pick(cliente, 'correo', 'Correo') ?? pick(item, 'correo', 'Correo')),
    telefono: str(pick(cliente, 'telefono', 'Telefono') ?? pick(item, 'telefono', 'Telefono')),
    rfc: str(pick(cliente, 'rfc', 'Rfc', 'RFC') ?? pick(item, 'rfc', 'Rfc', 'RFC')),
    esProspecto: esProspecto == null ? null : esProspecto === true || esProspecto === 1 || esProspecto === '1',
    eventosPendientes: num(
      pick(item, 'eventosPendientes', 'EventosPendientes'),
      eventos.filter((e) => e.estatus === 0).length,
    ),
    eventosRealizados: num(
      pick(item, 'eventosRealizados', 'EventosRealizados'),
      eventos.filter((e) => e.estatus === 1).length,
    ),
    proximoEvento:
      proximoRaw == null
        ? null
        : typeof proximoRaw === 'object'
          ? mapearEvento(proximoRaw, medios)
          : str(proximoRaw) || null,
    fechaCreacion: pick(item, 'fechaCreacion', 'FechaCreacion', 'fhRegistro', 'FhRegistro') ?? null,
    fechaActualizacion: pick(item, 'fhUpdate', 'FhUpdate', 'fechaActualizacion', 'FechaActualizacion') ?? null,
    eventos,
  };
}

export function fechaMs(v: string | null): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}
