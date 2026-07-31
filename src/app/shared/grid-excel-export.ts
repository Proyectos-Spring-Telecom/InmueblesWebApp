import { exportDataGrid } from 'devextreme/excel_exporter';
import { Workbook, Worksheet } from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

/** Colores de texto para etiquetas (solo font, sin fondo). */
const LABEL_COLOR = {
  activo: 'FF059669',
  inactivo: 'FFDC2626',
  disponible: 'FF16A34A',
  instalado: 'FF2563EB',
  pendiente: 'FFD97706',
  pagado: 'FF16A34A',
  vencido: 'FFDC2626',
  post: 'FF16A34A',
  get: 'FF2563EB',
  put: 'FFD97706',
  patch: 'FF9333EA',
  delete: 'FFDC2626',
  evaluate: 'FF0D9488',
  default: 'FF64748B',
} as const;

const VACIO = '--';

export interface ExportDetalleSheet {
  /** Nombre de la hoja (máx. 31). */
  name: string;
  /** Filas de solo texto (sin URLs de imagen/archivo). */
  rows: Array<Record<string, string>>;
}

export interface ExportarGridExcelOptions {
  /** Instancia nativa de DevExtreme DataGrid (`dataGrid.instance`). */
  component: any;
  /** Nombre del archivo sin extensión (solo módulo / grid). */
  fileName: string;
  /** Nombre de la hoja principal (opcional). */
  sheetName?: string;
  /** Hojas adicionales (master-detail u otros anexos de texto). */
  detailSheets?: ExportDetalleSheet[];
}

function esColumnaAcciones(col: any): boolean {
  if (!col) return false;
  const caption = String(col.caption ?? '')
    .trim()
    .toLowerCase();
  const name = String(col.name ?? '')
    .trim()
    .toLowerCase();
  const field = String(col.dataField ?? '')
    .trim()
    .toLowerCase();
  const template = String(col.cellTemplate ?? '')
    .trim()
    .toLowerCase();

  if (caption === 'acciones' || caption === 'acción' || caption === 'accion') {
    return true;
  }
  if (name === 'acciones' || field === 'acciones') return true;
  if (template.includes('accion')) return true;
  if (col.type === 'buttons' || col.type === 'detailExpand') return true;
  return false;
}

/** Imágenes, logos, fachadas, archivos: no se exportan. */
function esColumnaMediaOArchivo(col: any): boolean {
  if (!col) return false;
  const caption = String(col.caption ?? '')
    .trim()
    .toLowerCase();
  const field = String(col.dataField ?? '')
    .trim()
    .toLowerCase();
  const template = String(col.cellTemplate ?? '')
    .trim()
    .toLowerCase();

  const keys = [
    'imagen',
    'foto',
    'fotoperfil',
    'logotipo',
    'logo',
    'avatar',
    'fachada',
    'archivo',
    'archivos',
    'documento',
    'comprobante',
    'adjunto',
    'urlfoto',
    'urlimagen',
  ];

  if (keys.some((k) => caption === k || caption.includes(k))) return true;
  if (keys.some((k) => field === k || field.includes(k))) return true;
  if (
    template === 'imagen' ||
    template.includes('imagen') ||
    template.includes('foto') ||
    template.includes('logo') ||
    template.includes('fachada')
  ) {
    return true;
  }
  return false;
}

/** Chips / resumen visual del grid: no son columnas de datos. */
function esColumnaUiDecorativa(col: any): boolean {
  if (!col) return false;
  const caption = String(col.caption ?? '')
    .trim()
    .toLowerCase();
  const template = String(col.cellTemplate ?? '')
    .trim()
    .toLowerCase();
  if (caption === 'resumen') return true;
  if (template === 'chipstpl' || template.includes('chips')) return true;
  return false;
}

function debeOcultarColumnaExport(col: any): boolean {
  return (
    esColumnaAcciones(col) ||
    esColumnaMediaOArchivo(col) ||
    esColumnaUiDecorativa(col)
  );
}

/** Solo columna Estatus (activo/inactivo), no "Estado Equipo" ni similares. */
function esCampoEstatus(field: string, caption: string): boolean {
  const f = field.toLowerCase();
  const c = caption.toLowerCase();
  if (c === 'estatus') return true;
  if (f === 'estatus' || f === 'estatuslabel') return true;
  if (f.endsWith('.estatus')) return true;
  return false;
}

/** null / '' / solo espacios / guiones vacíos del grid → `--`. */
export function textoExportable(value: unknown): string {
  if (value == null) return VACIO;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : VACIO;
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  const t = String(value).trim();
  if (t === '' || t === '—' || t === '-' || t === '--' || t === '---') {
    return VACIO;
  }
  return t;
}

function esPlaceholderVacio(value: unknown): boolean {
  return textoExportable(value) === VACIO;
}

function unirTextosExport(parts: unknown[], sep = ' | '): string {
  const cleaned = parts
    .map((p) => textoExportable(p))
    .filter((t) => t !== VACIO);
  return cleaned.length ? cleaned.join(sep) : VACIO;
}

function unirNombresExport(parts: unknown[]): string {
  return unirTextosExport(parts, ' ');
}

/**
 * Solo para columnas con cellTemplate (sin dataField útil o que el value crudo no refleja).
 * Debe coincidir con lo que muestra el HTML del grid; no inventar ni reusar otras columnas.
 */
function resolverValorExportCelda(gridCell: {
  column?: { dataField?: string; caption?: string; cellTemplate?: string };
  value?: unknown;
  data?: Record<string, unknown>;
}): string | null {
  const data = gridCell.data;
  if (!data) return null;

  const field = String(gridCell.column?.dataField ?? '')
    .trim()
    .toLowerCase();
  const caption = String(gridCell.column?.caption ?? '')
    .trim()
    .toLowerCase();
  const template = String(gridCell.column?.cellTemplate ?? '')
    .trim()
    .toLowerCase();

  // Representante Legal (inmuebles / arrendatarios)
  if (
    caption === 'representante legal' ||
    template === 'representantetpl'
  ) {
    return unirTextosExport([
      data['representanteNombre'] ?? data['nombreRepresentante'],
      data['telefonoRepresentante'],
      data['correoRepresentante'],
    ]);
  }

  // Vigencia
  if (template === 'vigenciatpl' || caption === 'vigencia' || field === 'vigenciatexto') {
    const inicio = data['fechaInicioFmt'];
    const fin = data['fechaFinFmt'];
    const fechas =
      !esPlaceholderVacio(inicio) || !esPlaceholderVacio(fin)
        ? `${textoExportable(inicio)} - ${textoExportable(fin)}`
        : '';

    // Arrendatarios (sin dataField): "Tiempo renta" + fechas.
    // Inmuebles (vigenciaTexto): solo fechas, como el template.
    if (!field) {
      const tiempo = data['tiempoRentaTexto'];
      const partes: string[] = [];
      if (!esPlaceholderVacio(tiempo)) {
        partes.push(`Tiempo renta: ${textoExportable(tiempo)}`);
      }
      if (fechas) partes.push(fechas);
      if (partes.length) return partes.join(' | ');
      return VACIO;
    }

    if (fechas) return fechas;
    return textoExportable(data['vigenciaTexto'] ?? gridCell.value);
  }

  // Desglose rentas (Renta / Mantenimiento)
  if (caption === 'desglose' || template.includes('desglose')) {
    const vm = data['desgloseVm'] as Record<string, unknown> | undefined;
    if (!vm || typeof vm !== 'object') return VACIO;
    const partes: string[] = [];
    if (vm['muestraRenta']) {
      partes.push(`Renta: ${textoExportable(vm['rentaFmt'])}`);
    }
    if (vm['muestraMantenimiento']) {
      partes.push(`Mantenimiento: ${textoExportable(vm['mantenimientoFmt'])}`);
    }
    return partes.length ? partes.join(' | ') : VACIO;
  }

  // Estado Equipo (equipos: id → etiqueta; no confundir con Estatus)
  if (field === 'idestadoequipo' || (template === 'tplestadoequipo' && 'idEstadoEquipo' in data)) {
    const id = Number(data['idEstadoEquipo'] ?? gridCell.value);
    const mapa: Record<number, string> = {
      1: 'Disponible',
      2: 'Instalado',
      3: 'En reparación',
      4: 'Descompuesto',
    };
    return mapa[id] ?? 'Sin estado';
  }

  // Arrendador según template del grid (prioridad al HTML, no al nombre del usuario)
  if (template === 'clien') {
    return unirNombresExport([
      data['clienteNombre'],
      data['ApellidoPaternoCliente'] ?? data['apellidoPaternoCliente'],
      data['ApellidoMaternoCliente'] ?? data['apellidoMaternoCliente'],
    ]);
  }

  if (template === 'tplcliente') {
    const c =
      data['cliente'] != null && typeof data['cliente'] === 'object'
        ? (data['cliente'] as Record<string, unknown>)
        : null;
    return unirNombresExport([
      c?.['nombre'],
      c?.['apellidoPaterno'],
      c?.['apellidoMaterno'],
    ]);
  }

  if (template === 'client') {
    const eq =
      data['equipo'] != null && typeof data['equipo'] === 'object'
        ? (data['equipo'] as Record<string, unknown>)
        : null;
    const c =
      eq?.['cliente'] != null && typeof eq['cliente'] === 'object'
        ? (eq['cliente'] as Record<string, unknown>)
        : null;
    return unirNombresExport([
      c?.['nombre'],
      c?.['apellidoPaterno'],
      c?.['apellidoMaterno'],
    ]);
  }

  // Arrendador sin dataField (usuarios legacy / equipos)
  if (caption === 'arrendador' && !field) {
    if ('clienteNombre' in data) {
      return unirNombresExport([
        data['clienteNombre'],
        data['ApellidoPaternoCliente'] ?? data['apellidoPaternoCliente'],
        data['ApellidoMaternoCliente'] ?? data['apellidoMaternoCliente'],
      ]);
    }
    const c =
      data['cliente'] != null && typeof data['cliente'] === 'object'
        ? (data['cliente'] as Record<string, unknown>)
        : null;
    if (c) {
      return unirNombresExport([
        c['nombre'],
        c['apellidoPaterno'],
        c['apellidoMaterno'],
      ]);
    }
    return VACIO;
  }

  return null;
}

function etiquetaEstatus(value: unknown): { text: string; color?: string } | null {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return { text: VACIO };
  }

  if (typeof value === 'string') {
    const t = value.trim();
    const low = t.toLowerCase();
    if (low === 'activo' || low === 'activa') {
      return { text: t, color: LABEL_COLOR.activo };
    }
    if (low === 'inactivo' || low === 'inactiva') {
      return { text: t, color: LABEL_COLOR.inactivo };
    }
    if (low === 'disponible') return { text: t, color: LABEL_COLOR.disponible };
    if (low === 'instalado' || low === 'instalada') {
      return { text: t, color: LABEL_COLOR.instalado };
    }
    if (low === 'pendiente') return { text: t, color: LABEL_COLOR.pendiente };
    if (low === 'pagado' || low === 'pagada') {
      return { text: t, color: LABEL_COLOR.pagado };
    }
    if (low === 'vencido' || low === 'vencida') {
      return { text: t, color: LABEL_COLOR.vencido };
    }
    if (Number.isNaN(Number(t))) return { text: t };
  }

  const n = Number(value);
  if (n === 1) return { text: 'Activo', color: LABEL_COLOR.activo };
  if (n === 0) return { text: 'Inactivo', color: LABEL_COLOR.inactivo };
  return null;
}

function colorDesdeAccionClass(accionClass: unknown): string | undefined {
  const c = String(accionClass ?? '').toLowerCase();
  if (c.includes('post')) return LABEL_COLOR.post;
  if (c.includes('get')) return LABEL_COLOR.get;
  if (c.includes('put')) return LABEL_COLOR.put;
  if (c.includes('patch')) return LABEL_COLOR.patch;
  if (c.includes('delete')) return LABEL_COLOR.delete;
  if (c.includes('evaluate')) return LABEL_COLOR.evaluate;
  if (c.includes('default')) return LABEL_COLOR.default;
  return undefined;
}

function safeSheetName(name: string): string {
  const cleaned = (name || 'Grid')
    .replace(/[\\/*/?:[\]]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || 'Grid';
}

function safeFileName(name: string): string {
  const cleaned = (name || 'Grid')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Grid';
}

/** ¿Hay al menos un registro exportable en el grid? */
export function gridTieneDatosParaExportar(component: any): boolean {
  if (!component) return false;
  try {
    const total = component.totalCount?.();
    if (typeof total === 'number' && total >= 0) return total > 0;
  } catch {
    /* ignore */
  }
  try {
    const items = component.getDataSource?.()?.items?.() ?? [];
    if (Array.isArray(items) && items.length > 0) return true;
  } catch {
    /* ignore */
  }
  try {
    const rows = (component.getVisibleRows?.() ?? []).filter(
      (r: any) => r?.rowType === 'data',
    );
    return rows.length > 0;
  } catch {
    /* ignore */
  }
  return false;
}

/** Obtiene filas del dataSource (página cargada / items actuales). */
export function obtenerItemsGrid(component: any): any[] {
  if (!component) return [];
  try {
    const items = component.getDataSource?.()?.items?.();
    if (Array.isArray(items) && items.length) return items;
  } catch {
    /* ignore */
  }
  try {
    return (component.getVisibleRows?.() ?? [])
      .filter((r: any) => r?.rowType === 'data')
      .map((r: any) => r.data)
      .filter((d: any) => d != null);
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Intenta cargar todas las filas del store (filtros actuales).
 * Si falla, usa los items ya cargados en el grid.
 */
export async function obtenerItemsGridCompletos(component: any): Promise<any[]> {
  if (!component) return [];
  try {
    const ds = component.getDataSource?.();
    const store = ds?.store?.();
    if (store && typeof store.load === 'function') {
      const result = await Promise.resolve(
        store.load({
          skip: 0,
          take: 100000,
          filter: ds.filter?.() ?? undefined,
          sort: ds.sort?.() ?? undefined,
          requireTotalCount: false,
        }),
      );
      if (Array.isArray(result) && result.length) return result;
      if (
        result &&
        typeof result === 'object' &&
        Array.isArray((result as { data?: unknown }).data)
      ) {
        return (result as { data: any[] }).data;
      }
    }
  } catch {
    /* fallback abajo */
  }
  return obtenerItemsGrid(component);
}

function autoAjustarAnchos(worksheet: Worksheet): void {
  const colCount = Math.max(worksheet.columnCount || 0, worksheet.actualColumnCount || 0);
  for (let i = 1; i <= colCount; i++) {
    const column = worksheet.getColumn(i);
    let maxLen = 6;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const raw = cell.value;
      let text = '';
      if (raw == null) text = '';
      else if (typeof raw === 'object' && raw !== null && 'richText' in (raw as object)) {
        const rt = (raw as { richText?: Array<{ text?: string }> }).richText ?? [];
        text = rt.map((x) => x.text ?? '').join('');
      } else if (typeof raw === 'object' && raw !== null && 'text' in (raw as object)) {
        text = String((raw as { text?: unknown }).text ?? '');
      } else {
        text = String(raw);
      }
      // Ancho por línea (si hay wraps)
      for (const line of text.split(/\r?\n|\s*\|\s*/)) {
        const len = line.trim().length;
        if (len > maxLen) maxLen = len;
      }
    });
    // Ceñido al contenido (+ margen para filtro); sin heredar anchos del grid.
    column.width = Math.min(Math.max(maxLen + 3, 10), 48);
  }
}

function aplicarEstiloHojaTexto(worksheet: Worksheet): void {
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      if (rowNumber === 1) {
        cell.font = { ...(cell.font || {}), bold: true };
      } else {
        cell.font = { ...(cell.font || {}), bold: false };
        if (cell.value == null || String(cell.value).trim() === '') {
          cell.value = VACIO;
        }
      }
    });
  });
  autoAjustarAnchos(worksheet);
}

function escribirHojaDetalle(
  workbook: Workbook,
  sheet: ExportDetalleSheet,
): void {
  const name = safeSheetName(sheet.name);
  const ws = workbook.addWorksheet(name);
  const rows = sheet.rows ?? [];
  if (!rows.length) {
    ws.addRow(['Sin registros']);
    aplicarEstiloHojaTexto(ws);
    return;
  }
  const headers = Object.keys(rows[0]);
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(headers.map((h) => textoExportable(row[h])));
  }
  aplicarEstiloHojaTexto(ws);
}

/* ---------- Builders master-detail (solo texto) ---------- */

function detalleDe(master: any): Record<string, unknown> {
  const d = master?.detalle;
  return d != null && typeof d === 'object' && !Array.isArray(d)
    ? (d as Record<string, unknown>)
    : {};
}

function nombreMasterCliente(m: any): string {
  return textoExportable(
    m?.NombreCompleto ?? m?.nombreCliente ?? m?.nombre ?? m?.id,
  );
}

/** Hojas: Documentos (nombres) + Socios. */
export function hojasDetalleCliente(masters: any[]): ExportDetalleSheet[] {
  const documentos: Array<Record<string, string>> = [];
  const socios: Array<Record<string, string>> = [];

  for (const m of masters) {
    const det = detalleDe(m);
    const arrendador = nombreMasterCliente(m);
    const archivos = Array.isArray(det['archivos']) ? det['archivos'] : [];
    for (const a of archivos) {
      const o = (a ?? {}) as Record<string, unknown>;
      documentos.push({
        Arrendador: arrendador,
        Documento: textoExportable(o['nombre'] ?? o['Nombre'] ?? 'Documento'),
      });
    }
    const listaSocios = Array.isArray(det['sociosArrendadores'])
      ? det['sociosArrendadores']
      : [];
    for (const s of listaSocios) {
      const o = (s ?? {}) as Record<string, unknown>;
      socios.push({
        Arrendador: arrendador,
        Socio: textoExportable(o['nombre'] ?? o['Nombre']),
        RFC: textoExportable(o['rfc'] ?? o['RFC']),
      });
    }
  }

  return [
    { name: 'Documentos', rows: documentos },
    { name: 'Socios', rows: socios },
  ];
}

/** Hojas: Locales + Servicios + Documentos (nombres). */
export function hojasDetalleInmueble(masters: any[]): ExportDetalleSheet[] {
  const locales: Array<Record<string, string>> = [];
  const servicios: Array<Record<string, string>> = [];
  const documentos: Array<Record<string, string>> = [];

  for (const m of masters) {
    const det = detalleDe(m);
    const inmueble = textoExportable(
      m?.nombre ?? m?.nombreInmueble ?? det['nombre'] ?? m?.id,
    );
    const zonas = Array.isArray(det['zonas']) ? det['zonas'] : [];
    for (const z of zonas) {
      const zona = (z ?? {}) as Record<string, unknown>;
      const nombreZona = textoExportable(
        zona['zonaPrincipal'] ?? zona['nombre'] ?? zona['numeroZona'],
      );
      const locs = Array.isArray(zona['locales']) ? zona['locales'] : [];
      for (const loc of locs) {
        const l = (loc ?? {}) as Record<string, unknown>;
        locales.push({
          Inmueble: inmueble,
          Zona: nombreZona,
          Local: textoExportable(l['nombre']),
          Estatus: textoExportable(
            l['estatusLocalTexto'] ?? l['estatus'] ?? l['estado'],
          ),
          Renta: textoExportable(l['rentaFmt'] ?? l['renta'] ?? l['montoRenta']),
          Mantenimiento: textoExportable(
            l['mantenimientoFmt'] ?? l['mantenimiento'],
          ),
          Giro: textoExportable(l['giro'] ?? l['giroActividad']),
        });
      }
    }
    const servs = Array.isArray(det['servicios']) ? det['servicios'] : [];
    for (const s of servs) {
      const o = (s ?? {}) as Record<string, unknown>;
      const tipo =
        o['tipoServicio'] != null && typeof o['tipoServicio'] === 'object'
          ? (o['tipoServicio'] as Record<string, unknown>)['nombre']
          : o['nombre'] ?? o['servicio'];
      servicios.push({
        Inmueble: inmueble,
        Servicio: textoExportable(tipo),
        Contrato: textoExportable(o['numeroContrato']),
        FechaPago: textoExportable(o['fechaPago']),
      });
    }
    const archivos = Array.isArray(det['archivos']) ? det['archivos'] : [];
    for (const a of archivos) {
      const o = (a ?? {}) as Record<string, unknown>;
      documentos.push({
        Inmueble: inmueble,
        Documento: textoExportable(o['nombre'] ?? o['Nombre'] ?? 'Documento'),
      });
    }
  }

  return [
    { name: 'Locales', rows: locales },
    { name: 'Servicios', rows: servicios },
    { name: 'Documentos', rows: documentos },
  ];
}

/** Hojas: Contratos + Servicios + Documentos + Socios. */
export function hojasDetalleArrendatario(masters: any[]): ExportDetalleSheet[] {
  const contratos: Array<Record<string, string>> = [];
  const servicios: Array<Record<string, string>> = [];
  const documentos: Array<Record<string, string>> = [];
  const socios: Array<Record<string, string>> = [];

  for (const m of masters) {
    const det = detalleDe(m);
    const arrendatario = textoExportable(
      m?.nombre ?? m?.NombreCompleto ?? m?.nombreArrendatario ?? m?.id,
    );
    const listaC = Array.isArray(det['contratos']) ? det['contratos'] : [];
    for (const c of listaC) {
      const o = (c ?? {}) as Record<string, unknown>;
      contratos.push({
        Arrendatario: arrendatario,
        Contrato: textoExportable(o['numeroContrato'] ?? o['folio'] ?? o['id']),
        Inmueble: textoExportable(
          o['nombreInmueble'] ?? o['inmueble'] ?? o['idInmueble'],
        ),
        Estatus: textoExportable(o['estatus'] ?? o['estatusContrato']),
        Inicio: textoExportable(o['fechaInicio'] ?? o['vigenciaInicio']),
        Fin: textoExportable(o['fechaFin'] ?? o['vigenciaFin']),
      });
    }
    const servs = Array.isArray(det['servicios']) ? det['servicios'] : [];
    for (const s of servs) {
      const o = (s ?? {}) as Record<string, unknown>;
      const tipo =
        o['tipoServicio'] != null && typeof o['tipoServicio'] === 'object'
          ? (o['tipoServicio'] as Record<string, unknown>)['nombre']
          : o['nombre'] ?? o['servicio'];
      servicios.push({
        Arrendatario: arrendatario,
        Servicio: textoExportable(tipo),
        Contrato: textoExportable(o['numeroContrato']),
        FechaPago: textoExportable(o['fechaPago']),
      });
    }
    const archivos = Array.isArray(det['archivos']) ? det['archivos'] : [];
    for (const a of archivos) {
      const o = (a ?? {}) as Record<string, unknown>;
      documentos.push({
        Arrendatario: arrendatario,
        Documento: textoExportable(o['nombre'] ?? o['Nombre'] ?? 'Documento'),
      });
    }
    const listaS = Array.isArray(det['socios']) ? det['socios'] : [];
    for (const s of listaS) {
      const o = (s ?? {}) as Record<string, unknown>;
      socios.push({
        Arrendatario: arrendatario,
        Socio: textoExportable(o['nombre'] ?? o['Nombre']),
        RFC: textoExportable(o['rfc'] ?? o['RFC']),
      });
    }
  }

  return [
    { name: 'Contratos', rows: contratos },
    { name: 'Servicios', rows: servicios },
    { name: 'Documentos', rows: documentos },
    { name: 'Socios', rows: socios },
  ];
}

/** Hoja de equipos/instalaciones anidadas (oficinas centrales). */
export function hojasDetalleInstalacionCentral(
  masters: any[],
): ExportDetalleSheet[] {
  const equipos: Array<Record<string, string>> = [];
  for (const m of masters) {
    const central = textoExportable(m?.nombre ?? m?.id);
    const arrendador = textoExportable(m?.nombreCliente);
    const lista = Array.isArray(m?.instalaciones) ? m.instalaciones : [];
    for (const inst of lista) {
      const o = (inst ?? {}) as Record<string, unknown>;
      const equipo =
        o['equipo'] != null && typeof o['equipo'] === 'object'
          ? (o['equipo'] as Record<string, unknown>)
          : {};
      const estadoEq =
        equipo['estadoEquipo'] != null &&
        typeof equipo['estadoEquipo'] === 'object'
          ? (equipo['estadoEquipo'] as Record<string, unknown>)
          : o['estadoEquipo'] != null && typeof o['estadoEquipo'] === 'object'
            ? (o['estadoEquipo'] as Record<string, unknown>)
            : {};
      equipos.push({
        Oficina: central,
        Arrendador: arrendador,
        NumeroSerie: textoExportable(
          equipo['numeroSerie'] ?? o['numeroSerie'] ?? o['idEquipo'],
        ),
        EstadoEquipo: textoExportable(estadoEq['nombre'] ?? o['estadoEquipo']),
        FechaRegistro: textoExportable(o['fhRegistro']),
        Estatus: textoExportable(o['estatus']),
      });
    }
  }
  return [{ name: 'Equipos', rows: equipos }];
}

function abrirSwalCargandoExport(): void {
  void Swal.fire({
    title: 'Cargando...',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    background: '#141a21',
    color: '#ffffff',
    didOpen: () => {
      Swal.showLoading();
    },
  });
}

async function mostrarErrorExport(error: unknown): Promise<void> {
  const detalle =
    error instanceof Error && error.message
      ? error.message
      : typeof error === 'string' && error.trim()
        ? error
        : 'No se pudo generar el archivo Excel.';
  await Swal.fire({
    title: '¡Ops!',
    html: detalle,
    icon: 'error',
    background: '#141a21',
    color: '#ffffff',
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'Confirmar',
  });
}

/**
 * Exporta un DxDataGrid a Excel (.xlsx).
 * - Omite Acciones, imágenes y archivos
 * - Encabezados negrita, todo centrado, anchos autoajustables
 * - Vacíos → `--`
 * - Etiquetas: solo color de texto
 * - Hojas extra opcionales para master-detail (texto)
 * - Muestra Swal "Cargando..." hasta terminar o fallar
 */
export async function exportarDxDataGridExcel(
  options: ExportarGridExcelOptions,
): Promise<void> {
  const grid = options?.component;
  if (!grid || typeof grid.getVisibleColumns !== 'function') {
    await mostrarErrorExport('No hay grid disponible para exportar.');
    return;
  }
  if (!gridTieneDatosParaExportar(grid)) {
    await mostrarErrorExport('El grid no tiene registros para exportar.');
    return;
  }

  const fileName = safeFileName(options.fileName);
  const sheetName = safeSheetName(options.sheetName || fileName);

  abrirSwalCargandoExport();

  const hiddenDuringExport: Array<{ index: number; wasVisible: boolean }> = [];
  try {
    const cols = grid.getVisibleColumns?.() ?? [];
    cols.forEach((col: any) => {
      if (!debeOcultarColumnaExport(col)) return;
      const index = col.index;
      if (typeof index !== 'number') return;
      hiddenDuringExport.push({
        index,
        wasVisible: col.visible !== false,
      });
      grid.columnOption(index, 'visible', false);
    });

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    await exportDataGrid({
      component: grid,
      worksheet,
      autoFilterEnabled: true,
      keepColumnWidths: false,
      customizeCell: ({ gridCell, excelCell }) => {
        excelCell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };

        if (gridCell?.rowType === 'header') {
          excelCell.font = {
            ...(excelCell.font || {}),
            bold: true,
          };
          return;
        }

        if (gridCell?.rowType !== 'data') return;

        const field = String(gridCell.column?.dataField ?? '');
        const caption = String(gridCell.column?.caption ?? '');
        const data = gridCell.data as Record<string, unknown> | undefined;

        excelCell.font = { ...(excelCell.font || {}), bold: false };

        // Bitácora / etiquetas con clase de acción: solo color de texto.
        if (field === 'accion' && data?.['accionClass'] != null) {
          const color = colorDesdeAccionClass(data['accionClass']);
          const text = textoExportable(
            data['accion'] != null ? data['accion'] : gridCell.value,
          );
          excelCell.value = text;
          if (color) {
            excelCell.font = {
              ...(excelCell.font || {}),
              bold: false,
              color: { argb: color },
            };
          }
          return;
        }

        // Templates sin dataField / valores compuestos (Representante Legal, Vigencia, etc.)
        const compuesto = resolverValorExportCelda(gridCell as any);
        if (compuesto != null) {
          excelCell.value = compuesto;
          return;
        }

        if (esCampoEstatus(field, caption)) {
          const rawEst = !esPlaceholderVacio(gridCell.value)
            ? gridCell.value
            : data?.['estatusLabel'] ?? data?.['estatus'];
          const label = etiquetaEstatus(rawEst);
          if (label) {
            excelCell.value = label.text;
            if (label.color) {
              excelCell.font = {
                ...(excelCell.font || {}),
                bold: false,
                color: { argb: label.color },
              };
            }
            return;
          }
          if (!esPlaceholderVacio(data?.['estatusLabel'])) {
            excelCell.value = textoExportable(data?.['estatusLabel']);
            return;
          }
        }

        const raw = gridCell.value;
        if (esPlaceholderVacio(raw)) {
          if (field && data && !esPlaceholderVacio(data[field])) {
            excelCell.value = textoExportable(data[field]);
            return;
          }
          excelCell.value = VACIO;
          return;
        }

        const asStr = String(raw).trim();
        if (
          /^https?:\/\//i.test(asStr) &&
          /\.(png|jpe?g|gif|webp|svg|pdf|docx?|xlsx?)(\?|$)/i.test(asStr)
        ) {
          excelCell.value = VACIO;
          return;
        }

        excelCell.value = textoExportable(raw);
      },
    });

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { ...(cell.font || {}), bold: true };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    });

    // Autoajuste tras export (no usar anchos del grid).
    autoAjustarAnchos(worksheet);

    for (const detail of options.detailSheets ?? []) {
      escribirHojaDetalle(workbook, detail);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${fileName}.xlsx`,
    );

    Swal.close();
  } catch (error) {
    await mostrarErrorExport(error);
  } finally {
    for (const item of hiddenDuringExport) {
      try {
        grid.columnOption(item.index, 'visible', item.wasVisible);
      } catch {
        /* ignore */
      }
    }
  }
}
