import { formatearFecha, formatearMoneda } from '../inmuebles/inmuebles-list.mapper';

export interface ArrendatarioDashboardFiltros {
  idArrendatario: number;
  fechaInicio: string;
  fechaFin: string;
}

export interface ArrendatarioDashboardInfo {
  id: number;
  nombre: string;
  rfc: string;
  renta: number;
  fechaInicio: string;
  fechaFin: string;
  tiempoRenta: string;
  representanteLegal: string;
  telefonoRepresentante: string;
  correoRepresentante: string;
  arrendadorNombre: string;
  arrendadorTelefono: string;
  arrendadorCorreo: string;
}

export interface ArrendatarioDashboardLocal {
  id: number;
  nombre: string;
  areaM2: number;
  mensualidad: number;
  giro: string;
  zonaNombre: string;
  inmuebleNombre: string;
}

export interface ArrendatarioDashboardZona {
  id: number;
  nombre: string;
  superficieM2: number;
  locales: ArrendatarioDashboardLocal[];
}

export interface ArrendatarioDashboardContrato {
  id: number;
  inmuebleNombre: string;
  fechaInicio: string;
  fechaFin: string;
  moneda: string;
  rentaTotal: number;
  mantenimientoTotal: number | null;
  montoDeposito: number;
  montoAdelanto: number;
  localesNombres: string[];
  observaciones: string;
}

export interface ArrendatarioDashboardRentaActual {
  id: number;
  mes: string;
  montoRenta: number;
  montoMantenimiento: number;
  montoFinalTotal: number;
  factorAplicado: number;
  formulaUsada: string;
  pagada: boolean;
  contratoId: number;
  inmuebleNombre: string;
}

export interface ArrendatarioDashboardPago {
  id: number;
  concepto: string;
  monto: number;
  fecha: string;
  metodoPago: string;
  estatusLabel: string;
}

export interface ArrendatarioDashboardResumen {
  totalContratos: number;
  totalLocales: number;
  rentaMesTotal: number;
  rentasPagadas: number;
  rentasPendientes: number;
  totalPagos: number;
  montoPagos: number;
}

export interface ArrendatarioDashboardData {
  filtros: ArrendatarioDashboardFiltros | null;
  arrendatario: ArrendatarioDashboardInfo | null;
  contratos: ArrendatarioDashboardContrato[];
  zonas: ArrendatarioDashboardZona[];
  locales: ArrendatarioDashboardLocal[];
  rentaActual: ArrendatarioDashboardRentaActual[];
  pagos: ArrendatarioDashboardPago[];
  resumen: ArrendatarioDashboardResumen | null;
}

export interface DashboardRentaEstadoSlice {
  categoria: string;
  cantidad: number;
  totalRentas: number;
  color: string;
}

export interface DashboardMensualidadLocalBar {
  local: string;
  mensualidad: number;
}

export interface DashboardPagoConceptoBar {
  concepto: string;
  monto: number;
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

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function nombreInmuebleDesde(raw: Record<string, unknown>): string {
  const inmueble = record(raw['inmueble']);
  return str(inmueble['inmueble'] ?? inmueble['nombre']);
}

function normalizarLocal(
  raw: unknown,
  zonaNombre = '',
  inmuebleNombre = '',
): ArrendatarioDashboardLocal {
  const item = record(raw);
  const zona = record(item['zona']);
  return {
    id: num(item['id']),
    nombre: str(item['nombre'], `Local ${item['id'] ?? ''}`),
    areaM2: num(item['areaM2'] ?? item['area_m2']),
    mensualidad: num(item['mensualidad'] ?? item['mensualidadBase'] ?? item['mensualidad_base']),
    giro: str(item['giro']),
    zonaNombre: zonaNombre || str(zona['zonaPrincipal'] ?? zona['zona_principal'] ?? zona['nombre']),
    inmuebleNombre: inmuebleNombre || nombreInmuebleDesde(zona),
  };
}

function localesDesdeContrato(raw: unknown): string[] {
  const item = record(raw);
  const rows = Array.isArray(item['contratoLocales']) ? item['contratoLocales'] : [];
  return rows
    .map((row) => str(record(record(row)['local'])['nombre']))
    .filter(Boolean);
}

function normalizarContrato(raw: unknown): ArrendatarioDashboardContrato {
  const item = record(raw);
  const mantRaw = item['mantenimientoTotal'] ?? item['mantenimiento_total'];
  return {
    id: num(item['id']),
    inmuebleNombre: nombreInmuebleDesde(item),
    fechaInicio: str(item['fechaInicioContrato'] ?? item['fecha_inicio_contrato'] ?? item['fechaInicio']),
    fechaFin: str(item['fechaTerminoContrato'] ?? item['fecha_termino_contrato'] ?? item['fechaFin']),
    moneda: str(item['moneda'], 'MXN'),
    rentaTotal: num(item['rentaTotal'] ?? item['renta_total']),
    mantenimientoTotal: mantRaw == null ? null : num(mantRaw),
    montoDeposito: num(item['montoDeposito'] ?? item['monto_deposito']),
    montoAdelanto: num(item['montoAdelanto'] ?? item['monto_adelanto']),
    localesNombres: localesDesdeContrato(item),
    observaciones: str(item['observaciones']),
  };
}

function normalizarRentaActual(raw: unknown): ArrendatarioDashboardRentaActual {
  const item = record(raw);
  const contrato = record(item['contrato']);
  const formula = record(item['formula']);
  const desglose = record(item['desglose']);
  const renta = record(desglose['renta']);
  const mant = record(desglose['mantenimiento']);
  const montoRenta = num(item['montoFinal'] ?? renta['montoFinal'] ?? item['total']);
  const montoMantenimiento = num(
    item['montoFinalMantenimiento'] ?? mant['montoFinalMantenimiento'] ?? item['totalMantenimiento'],
  );
  return {
    id: num(item['id']),
    mes: str(item['mes']),
    montoRenta,
    montoMantenimiento,
    montoFinalTotal: montoRenta + montoMantenimiento,
    factorAplicado: num(item['factorVariable'] ?? item['factor_variable'], 1),
    formulaUsada: str(formula['nombre']),
    pagada: bool(item['pagada']),
    contratoId: num(item['idContrato'] ?? item['id_contrato'] ?? contrato['id']),
    inmuebleNombre: nombreInmuebleDesde(contrato),
  };
}

function normalizarPago(raw: unknown): ArrendatarioDashboardPago {
  const item = record(raw);
  const metodo = record(item['metodoPago'] ?? item['metodo_pago']);
  const estatus = num(item['estatus'], 1);
  return {
    id: num(item['id']),
    concepto: str(item['concepto'], 'Pago'),
    monto: num(item['monto']),
    fecha: str(item['fechaPago'] ?? item['fecha_pago'] ?? item['fecha']),
    metodoPago: str(metodo['nombre']),
    estatusLabel: estatus === 1 ? 'Pagado' : 'Pendiente',
  };
}

function deduplicarContratos(contratos: ArrendatarioDashboardContrato[]): ArrendatarioDashboardContrato[] {
  const mapa = new Map<number, ArrendatarioDashboardContrato>();
  contratos.forEach((c) => {
    if (c.id > 0) mapa.set(c.id, c);
  });
  return Array.from(mapa.values()).sort((a, b) => b.id - a.id);
}

function construirResumen(data: {
  contratos: ArrendatarioDashboardContrato[];
  locales: ArrendatarioDashboardLocal[];
  rentaActual: ArrendatarioDashboardRentaActual[];
  pagos: ArrendatarioDashboardPago[];
}): ArrendatarioDashboardResumen {
  const rentasPagadas = data.rentaActual.filter((r) => r.pagada).length;
  const rentasPendientes = data.rentaActual.filter((r) => !r.pagada).length;
  const rentaMesTotal = data.rentaActual.reduce((s, r) => s + r.montoFinalTotal, 0);
  const montoPagos = data.pagos.reduce((s, p) => s + p.monto, 0);
  return {
    totalContratos: data.contratos.length,
    totalLocales: data.locales.length,
    rentaMesTotal,
    rentasPagadas,
    rentasPendientes,
    totalPagos: data.pagos.length,
    montoPagos,
  };
}

export function normalizarDashboardArrendatario(res: unknown): ArrendatarioDashboardData | null {
  const body = res != null && typeof res === 'object' && 'data' in (res as object)
    ? (res as { data?: unknown }).data
    : res;
  if (body == null || typeof body !== 'object') return null;

  const raw = body as Record<string, unknown>;
  const filtrosRaw = record(raw['filtros']);
  const arrRaw = record(raw['arrendatario']);
  const arrendadorRaw = record(arrRaw['arrendador']);

  let arrendatario: ArrendatarioDashboardInfo | null = null;
  if (Object.keys(arrRaw).length) {
    arrendatario = {
      id: num(arrRaw['id']),
      nombre: str(arrRaw['arrendatario'] ?? arrRaw['nombre']),
      rfc: str(arrRaw['rfc']),
      renta: num(arrRaw['renta']),
      fechaInicio: str(arrRaw['fechaInicio'] ?? arrRaw['fecha_inicio']),
      fechaFin: str(arrRaw['fechaFin'] ?? arrRaw['fecha_fin']),
      tiempoRenta: str(arrRaw['tiempoRenta'] ?? arrRaw['tiempo_renta']),
      representanteLegal: str(arrRaw['representanteLegal'] ?? arrRaw['representante_legal']),
      telefonoRepresentante: str(arrRaw['telefonoRepresentante'] ?? arrRaw['telefono_representante']),
      correoRepresentante: str(arrRaw['correoRepresentante'] ?? arrRaw['correo_representante']),
      arrendadorNombre: str(arrendadorRaw['nombre']),
      arrendadorTelefono: str(arrendadorRaw['telefono']),
      arrendadorCorreo: str(arrendadorRaw['correo']),
    };
  }

  const contratosRaw = Array.isArray(raw['contratos']) ? raw['contratos'] : [];
  const contratos = deduplicarContratos(contratosRaw.map(normalizarContrato));

  const zonasRaw = Array.isArray(raw['zonas']) ? raw['zonas'] : [];
  const zonas = zonasRaw.map((zonaRaw, zi) => {
    const zona = record(zonaRaw);
    const nombreZona = str(zona['zonaPrincipal'] ?? zona['zona_principal'] ?? zona['nombre'], `Zona ${zi + 1}`);
    const localesRaw = Array.isArray(zona['locales']) ? zona['locales'] : [];
    return {
      id: num(zona['id'], zi + 1),
      nombre: nombreZona,
      superficieM2: num(zona['superficieZonaM2'] ?? zona['superficie_zona_m2']),
      locales: localesRaw.map((local) => normalizarLocal(local, nombreZona)),
    };
  });

  const localesRaw = Array.isArray(raw['locales']) ? raw['locales'] : [];
  const localesMap = new Map<number, ArrendatarioDashboardLocal>();
  localesRaw.forEach((localRaw) => {
    const local = normalizarLocal(localRaw);
    if (local.id > 0) localesMap.set(local.id, local);
  });
  if (!localesMap.size) {
    zonas.forEach((zona) => zona.locales.forEach((local) => {
      if (local.id > 0) localesMap.set(local.id, local);
    }));
  }
  const locales = Array.from(localesMap.values());

  const rentaRaw = Array.isArray(raw['rentaActual'])
    ? raw['rentaActual']
    : Array.isArray(raw['renta_actual'])
      ? raw['renta_actual']
      : [];
  const rentaActual = rentaRaw.map(normalizarRentaActual);

  const pagosRaw = Array.isArray(raw['pagosArrendatarios'])
    ? raw['pagosArrendatarios']
    : Array.isArray(raw['pagos_arrendatarios'])
      ? raw['pagos_arrendatarios']
      : [];
  const pagos = pagosRaw.map(normalizarPago);

  const filtros: ArrendatarioDashboardFiltros | null = Object.keys(filtrosRaw).length
    ? {
        idArrendatario: num(filtrosRaw['idArrendatario'] ?? filtrosRaw['id_arrendatario']),
        fechaInicio: str(filtrosRaw['fechaInicio'] ?? filtrosRaw['fecha_inicio']),
        fechaFin: str(filtrosRaw['fechaFin'] ?? filtrosRaw['fecha_fin']),
      }
    : null;

  const resumen = construirResumen({ contratos, locales, rentaActual, pagos });

  return {
    filtros,
    arrendatario,
    contratos,
    zonas,
    locales,
    rentaActual,
    pagos,
    resumen,
  };
}

export function construirGraficaRentaEstado(
  resumen: ArrendatarioDashboardResumen | null,
): DashboardRentaEstadoSlice[] {
  if (!resumen) return [];
  const total = Math.max(
    resumen.rentasPagadas + resumen.rentasPendientes,
    resumen.rentasPagadas,
    resumen.rentasPendientes,
  );
  if (total <= 0 && resumen.rentaMesTotal <= 0) return [];

  const totalRentas = total > 0 ? total : 1;
  return [
    {
      categoria: 'Pagadas',
      cantidad: resumen.rentasPagadas,
      totalRentas,
      color: '#22c55e',
    },
    {
      categoria: 'Pendientes',
      cantidad: resumen.rentasPendientes,
      totalRentas,
      color: '#f59e0b',
    },
  ].filter((slice) => slice.cantidad > 0);
}

export function construirGraficaMensualidadLocales(
  locales: ArrendatarioDashboardLocal[],
): DashboardMensualidadLocalBar[] {
  return locales.map((local) => ({
    local: local.nombre,
    mensualidad: local.mensualidad,
  }));
}

export function construirGraficaPagosConcepto(
  pagos: ArrendatarioDashboardPago[],
): DashboardPagoConceptoBar[] {
  const mapa = new Map<string, number>();
  pagos.forEach((pago) => {
    const key = pago.concepto || 'Pago';
    mapa.set(key, (mapa.get(key) ?? 0) + pago.monto);
  });
  return Array.from(mapa.entries()).map(([concepto, monto]) => ({ concepto, monto }));
}

export function etiquetaMes(raw: string): string {
  if (!raw) return '—';
  const fecha = new Date(raw);
  if (Number.isNaN(fecha.getTime())) return formatearFecha(raw);
  return fecha.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}

export { formatearFecha, formatearMoneda };
