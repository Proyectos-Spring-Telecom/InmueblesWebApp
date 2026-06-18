import { formatearFecha, formatearMoneda } from './inmuebles-list.mapper';

export interface InmuebleDashboardEncargado {
  nombre: string;
  telefono: string;
  correo: string;
}

export interface InmuebleDashboardArrendador {
  id: number;
  nombre: string;
  telefono: string;
  correo: string;
  encargado: InmuebleDashboardEncargado | null;
}

export interface InmuebleDashboardInmueble {
  id: number;
  nombre: string;
  direccionFiscal: string;
  totalM2: number;
  estado: string;
}

export interface InmuebleDashboardLocal {
  id: number;
  nombre: string;
  areaM2: number;
  giro: string;
  estado: string;
  mensualidadBase: number;
}

export interface InmuebleDashboardZona {
  id: number;
  nombre: string;
  superficieTotalM2: number;
  superficieDisponibleM2: number;
  locales: InmuebleDashboardLocal[];
}

export interface InmuebleDashboardResumenOcupacion {
  totalLocales: number;
  localesOcupados: number;
  localesLibres: number;
  ingresoMensualEstimado: number;
}

export interface InmuebleDashboardContrato {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  moneda: string;
  rentaTotal: number;
  mantenimientoTotal: number | null;
  montoDeposito: number;
  montoAdelanto: number;
}

export interface InmuebleDashboardRentaMes {
  mes: string;
  montoRenta: number;
  montoMantenimiento: number;
  factorAplicado: number;
  formulaUsada: string;
  pagada: boolean;
}

export interface InmuebleDashboardPago {
  concepto: string;
  monto: number;
  fecha: string;
  estatus: string;
}

export interface InmuebleDashboardArrendatario {
  id: number;
  nombre: string;
  rfc: string;
  representanteLegal: string;
  telefono: string;
  correo: string;
  localesAsignados: string[];
  contratoActivo: InmuebleDashboardContrato | null;
  rentaDelMes: InmuebleDashboardRentaMes | null;
  pagosRecientes: InmuebleDashboardPago[];
}

export interface InmuebleDashboardData {
  inmueble: InmuebleDashboardInmueble | null;
  arrendador: InmuebleDashboardArrendador | null;
  zonas: InmuebleDashboardZona[];
  resumenOcupacion: InmuebleDashboardResumenOcupacion | null;
  arrendatarios: InmuebleDashboardArrendatario[];
  pagosInmueble: InmuebleDashboardPago[];
}

export interface DashboardOcupacionSlice {
  categoria: string;
  cantidad: number;
  totalLocales: number;
  color: string;
}

export interface DashboardRentaArrendatarioBar {
  arrendatario: string;
  renta: number;
  mantenimiento: number;
}

export interface DashboardMensualidadLocalBar {
  local: string;
  mensualidad: number;
  estado: string;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function normalizarEncargado(raw: unknown): InmuebleDashboardEncargado | null {
  if (raw == null || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  return {
    nombre: str(item['nombre']),
    telefono: str(item['telefono']),
    correo: str(item['correo']),
  };
}

function normalizarLocal(raw: unknown, index: number): InmuebleDashboardLocal {
  const item = (raw ?? {}) as Record<string, unknown>;
  return {
    id: num(item['id'], index + 1),
    nombre: str(item['nombre'], `Local ${index + 1}`),
    areaM2: num(item['areaM2'] ?? item['area_m2']),
    giro: str(item['giro']),
    estado: str(item['estado'], 'desconocido'),
    mensualidadBase: num(item['mensualidadBase'] ?? item['mensualidad_base']),
  };
}

function normalizarZona(raw: unknown, index: number): InmuebleDashboardZona {
  const item = (raw ?? {}) as Record<string, unknown>;
  const localesRaw = Array.isArray(item['locales']) ? item['locales'] : [];
  return {
    id: num(item['id'], index + 1),
    nombre: str(item['nombre'], `Zona ${index + 1}`),
    superficieTotalM2: num(item['superficieTotalM2'] ?? item['superficie_total_m2']),
    superficieDisponibleM2: num(item['superficieDisponibleM2'] ?? item['superficie_disponible_m2']),
    locales: localesRaw.map((local, li) => normalizarLocal(local, li)),
  };
}

function normalizarContrato(raw: unknown): InmuebleDashboardContrato | null {
  if (raw == null || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const mantRaw = item['mantenimientoTotal'] ?? item['mantenimiento_total'];
  return {
    id: num(item['id']),
    fechaInicio: str(item['fechaInicio'] ?? item['fecha_inicio']),
    fechaFin: str(item['fechaFin'] ?? item['fecha_fin']),
    moneda: str(item['moneda'], 'MXN'),
    rentaTotal: num(item['rentaTotal'] ?? item['renta_total']),
    mantenimientoTotal: mantRaw == null ? null : num(mantRaw),
    montoDeposito: num(item['montoDeposito'] ?? item['monto_deposito']),
    montoAdelanto: num(item['montoAdelanto'] ?? item['monto_adelanto']),
  };
}

function normalizarRentaMes(raw: unknown): InmuebleDashboardRentaMes | null {
  if (raw == null || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  return {
    mes: str(item['mes']),
    montoRenta: num(item['montoRenta'] ?? item['monto_renta']),
    montoMantenimiento: num(item['montoMantenimiento'] ?? item['monto_mantenimiento']),
    factorAplicado: num(item['factorAplicado'] ?? item['factor_aplicado'], 1),
    formulaUsada: str(item['formulaUsada'] ?? item['formula_usada']),
    pagada: bool(item['pagada']),
  };
}

function normalizarPago(raw: unknown): InmuebleDashboardPago {
  const item = (raw ?? {}) as Record<string, unknown>;
  return {
    concepto: str(item['concepto'], 'Pago'),
    monto: num(item['monto']),
    fecha: str(item['fecha']),
    estatus: str(item['estatus'], '—'),
  };
}

function normalizarArrendatario(raw: unknown, index: number): InmuebleDashboardArrendatario {
  const item = (raw ?? {}) as Record<string, unknown>;
  const localesRaw = Array.isArray(item['localesAsignados'])
    ? item['localesAsignados']
    : Array.isArray(item['locales_asignados'])
      ? item['locales_asignados']
      : [];
  const pagosRaw = Array.isArray(item['pagosRecientes'])
    ? item['pagosRecientes']
    : Array.isArray(item['pagos_recientes'])
      ? item['pagos_recientes']
      : [];

  return {
    id: num(item['id'], index + 1),
    nombre: str(item['nombre'], `Arrendatario ${index + 1}`),
    rfc: str(item['rfc']),
    representanteLegal: str(item['representanteLegal'] ?? item['representante_legal']),
    telefono: str(item['telefono']),
    correo: str(item['correo']),
    localesAsignados: localesRaw.map((l) => str(l)).filter(Boolean),
    contratoActivo: normalizarContrato(item['contratoActivo'] ?? item['contrato_activo']),
    rentaDelMes: normalizarRentaMes(item['rentaDelMes'] ?? item['renta_del_mes']),
    pagosRecientes: pagosRaw.map(normalizarPago),
  };
}

export function normalizarDashboardInmueble(res: unknown): InmuebleDashboardData | null {
  const body = res != null && typeof res === 'object' && 'data' in (res as object)
    ? (res as { data?: unknown }).data
    : res;
  if (body == null || typeof body !== 'object') return null;

  const raw = body as Record<string, unknown>;
  const inmuebleRaw = raw['inmueble'];
  const arrendadorRaw = raw['arrendador'];
  const zonasRaw = Array.isArray(raw['zonas']) ? raw['zonas'] : [];
  const resumenRaw = raw['resumenOcupacion'] ?? raw['resumen_ocupacion'];
  const arrendatariosRaw = Array.isArray(raw['arrendatarios']) ? raw['arrendatarios'] : [];
  const pagosRaw = Array.isArray(raw['pagosInmueble'])
    ? raw['pagosInmueble']
    : Array.isArray(raw['pagos_inmueble'])
      ? raw['pagos_inmueble']
      : [];

  let inmueble: InmuebleDashboardInmueble | null = null;
  if (inmuebleRaw != null && typeof inmuebleRaw === 'object') {
    const item = inmuebleRaw as Record<string, unknown>;
    inmueble = {
      id: num(item['id']),
      nombre: str(item['nombre']),
      direccionFiscal: str(item['direccionFiscal'] ?? item['direccion_fiscal']),
      totalM2: num(item['totalM2'] ?? item['total_m2']),
      estado: str(item['estado']),
    };
  }

  let arrendador: InmuebleDashboardArrendador | null = null;
  if (arrendadorRaw != null && typeof arrendadorRaw === 'object') {
    const item = arrendadorRaw as Record<string, unknown>;
    arrendador = {
      id: num(item['id']),
      nombre: str(item['nombre']),
      telefono: str(item['telefono']),
      correo: str(item['correo']),
      encargado: normalizarEncargado(item['encargado']),
    };
  }

  let resumenOcupacion: InmuebleDashboardResumenOcupacion | null = null;
  if (resumenRaw != null && typeof resumenRaw === 'object') {
    const item = resumenRaw as Record<string, unknown>;
    resumenOcupacion = {
      totalLocales: num(item['totalLocales'] ?? item['total_locales']),
      localesOcupados: num(item['localesOcupados'] ?? item['locales_ocupados']),
      localesLibres: num(item['localesLibres'] ?? item['locales_libres']),
      ingresoMensualEstimado: num(
        item['ingresoMensualEstimado'] ?? item['ingreso_mensual_estimado'],
      ),
    };
  }

  return {
    inmueble,
    arrendador,
    zonas: zonasRaw.map((zona, zi) => normalizarZona(zona, zi)),
    resumenOcupacion,
    arrendatarios: arrendatariosRaw.map((arr, ai) => normalizarArrendatario(arr, ai)),
    pagosInmueble: pagosRaw.map(normalizarPago),
  };
}

export function construirGraficaOcupacionLocales(
  resumen: InmuebleDashboardResumenOcupacion | null,
): DashboardOcupacionSlice[] {
  if (!resumen) return [];
  const total = Math.max(
    num(resumen.totalLocales),
    num(resumen.localesOcupados) + num(resumen.localesLibres),
  );
  if (total <= 0) return [];

  return [
    {
      categoria: 'Ocupados',
      cantidad: resumen.localesOcupados,
      totalLocales: total,
      color: '#f59e0b',
    },
    {
      categoria: 'Libres',
      cantidad: resumen.localesLibres,
      totalLocales: total,
      color: '#22c55e',
    },
  ];
}

export function construirGraficaRentaArrendatarios(
  arrendatarios: InmuebleDashboardArrendatario[],
): DashboardRentaArrendatarioBar[] {
  return arrendatarios
    .filter((a) => a.rentaDelMes != null)
    .map((a) => ({
      arrendatario: a.nombre,
      renta: a.rentaDelMes?.montoRenta ?? 0,
      mantenimiento: a.rentaDelMes?.montoMantenimiento ?? 0,
    }));
}

export function construirGraficaMensualidadLocales(
  zonas: InmuebleDashboardZona[],
): DashboardMensualidadLocalBar[] {
  return zonas.flatMap((zona) =>
    zona.locales.map((local) => ({
      local: local.nombre,
      mensualidad: local.mensualidadBase,
      estado: local.estado,
    })),
  );
}

export { formatearFecha, formatearMoneda };
