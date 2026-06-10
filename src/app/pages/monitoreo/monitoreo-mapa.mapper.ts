/** GeoJSON del plano guardado en inmueble (`mapaInmueble`). */

export interface MonitoreoMapaCanvasSize {
  width: number;
  height: number;
}

export interface MonitoreoMapaZonaRect {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitoreoMapaLocalRect {
  id: string;
  nombre: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zonaId: string | null;
  estado: string;
}

export interface MonitoreoMapaVisualLayout {
  canvas: MonitoreoMapaCanvasSize;
  zonas: MonitoreoMapaZonaRect[];
  locales: MonitoreoMapaLocalRect[];
}

const CANVAS_DEFAULT: MonitoreoMapaCanvasSize = { width: 1200, height: 760 };

export function extraerMapaInmuebleApi(
  inmueble: unknown,
): Record<string, unknown> | null {
  const o = inmueble as Record<string, unknown> | null;
  if (!o) return null;
  const detalle = o['detalle'] as Record<string, unknown> | undefined;
  const raw = o['mapaInmueble'] ?? detalle?.['mapaInmueble'];
  if (!raw || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

export function mapaInmuebleTienePlano(mapa: unknown): boolean {
  const m = mapa as { type?: string; features?: unknown[] } | null;
  return (
    m?.type === 'FeatureCollection' &&
    Array.isArray(m.features) &&
    m.features.length > 0
  );
}

function rectDesdePoligono(
  coordinates: unknown,
): { x: number; y: number; width: number; height: number } | null {
  const rings = coordinates as number[][][] | undefined;
  const ring = Array.isArray(rings?.[0]) ? rings![0] : null;
  if (!ring?.length) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const x = Number(pt[0]);
    const y = Number(pt[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width,
    height,
  };
}

function canvasDesdeRects(
  rects: Array<{ x: number; y: number; width: number; height: number }>,
): MonitoreoMapaCanvasSize {
  if (!rects.length) return { ...CANVAS_DEFAULT };
  let maxX = 0;
  let maxY = 0;
  for (const r of rects) {
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return {
    width: Math.max(CANVAS_DEFAULT.width, maxX + 40),
    height: Math.max(CANVAS_DEFAULT.height, maxY + 40),
  };
}

/**
 * Convierte `mapaInmueble` (FeatureCollection) al modelo del lienzo de monitoreo.
 */
export function visualLayoutDesdeMapaInmueble(
  mapa: unknown,
): MonitoreoMapaVisualLayout | null {
  if (!mapaInmuebleTienePlano(mapa)) return null;

  const fc = mapa as {
    features: Array<{
      type?: string;
      geometry?: { type?: string; coordinates?: unknown };
      properties?: Record<string, unknown>;
    }>;
  };

  const zonas: MonitoreoMapaZonaRect[] = [];
  const locales: MonitoreoMapaLocalRect[] = [];
  const rects: Array<{ x: number; y: number; width: number; height: number }> =
    [];

  for (const feature of fc.features) {
    if (feature?.type !== 'Feature') continue;
    const geom = feature.geometry;
    if (geom?.type !== 'Polygon') continue;
    const rect = rectDesdePoligono(geom.coordinates);
    if (!rect) continue;

    const props = feature.properties ?? {};
    let entityType = String(props['entityType'] ?? '').toLowerCase();
    if (!entityType) {
      entityType = props['zonaId'] != null && String(props['zonaId']).trim() !== ''
        ? 'local'
        : 'zona';
    }
    const id = String(props['id'] ?? '').trim();
    const nombre = String(props['nombre'] ?? id).trim() || 'Sin nombre';

    rects.push(rect);

    if (entityType === 'zona') {
      zonas.push({
        id: id || `zona-${zonas.length + 1}`,
        nombre,
        ...rect,
      });
      continue;
    }

    if (entityType === 'local') {
      const zonaIdRaw = props['zonaId'];
      locales.push({
        id: id || `local-${locales.length + 1}`,
        nombre,
        ...rect,
        zonaId:
          zonaIdRaw != null && String(zonaIdRaw).trim() !== ''
            ? String(zonaIdRaw).trim()
            : null,
        estado: String(props['estado'] ?? 'libre').trim() || 'libre',
      });
    }
  }

  if (!zonas.length && !locales.length) return null;

  return {
    canvas: canvasDesdeRects(rects),
    zonas,
    locales,
  };
}

export function extraerZonasCatalogoInmueble(
  inmueble: unknown,
): Record<string, unknown>[] {
  const o = inmueble as Record<string, unknown> | null;
  if (!o) return [];
  if (Array.isArray(o['zonas'])) {
    return (o['zonas'] as unknown[]).filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  const detalle = o['detalle'] as Record<string, unknown> | undefined;
  if (Array.isArray(detalle?.['zonas'])) {
    return (detalle['zonas'] as unknown[]).filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  return [];
}

export function inmuebleTieneCatalogoParaPlano(
  zonasApi: Record<string, unknown>[],
  filasLocales: Record<string, unknown>[],
): boolean {
  return zonasApi.length > 0 || filasLocales.length > 0;
}

export function claveZonaCatalogo(
  idZona: unknown,
  nombreZona: string,
  indice: number,
): string {
  const idNum = Number(idZona);
  if (Number.isFinite(idNum) && idNum > 0) return String(idNum);
  const nom = nombreZona.trim();
  if (nom) return nom;
  return `zona-${indice + 1}`;
}

/**
 * Arma un plano inicial desde zonas/locales del catálogo cuando `mapaInmueble` es null.
 */
export function visualLayoutDesdeCatalogoInmueble(
  inmueble: unknown,
  filasLocales: Record<string, unknown>[],
): MonitoreoMapaVisualLayout | null {
  const zonasApi = extraerZonasCatalogoInmueble(inmueble);
  if (!inmuebleTieneCatalogoParaPlano(zonasApi, filasLocales)) return null;

  type ZonaBucket = { id: string; nombre: string; locales: Record<string, unknown>[] };
  const buckets = new Map<string, ZonaBucket>();

  zonasApi.forEach((z, i) => {
    const nombre = String(
      z['zonaPrincipal'] ?? z['nombre'] ?? z['nombreZona'] ?? '',
    ).trim();
    const id = claveZonaCatalogo(z['id'] ?? z['idZona'], nombre, i);
    buckets.set(id, {
      id,
      nombre: nombre || `Zona ${i + 1}`,
      locales: [],
    });
  });

  for (const fila of filasLocales) {
    const nombreZ = String(fila['zonaPrincipal'] ?? '').trim();
    const id = claveZonaCatalogo(fila['idZona'], nombreZ, buckets.size);
    if (!buckets.has(id)) {
      buckets.set(id, {
        id,
        nombre: nombreZ || 'Zona',
        locales: [],
      });
    }
    buckets.get(id)!.locales.push(fila);
  }

  const zoneWidth = 520;
  const zoneHeight = 300;
  const zoneGapX = 48;
  const zoneGapY = 44;
  const colsLocales = 4;
  const localW = 92;
  const localH = 72;
  const localGapX = 20;
  const localGapY = 16;
  const padX = 28;
  const padY = 44;

  const zonas: MonitoreoMapaZonaRect[] = [];
  const locales: MonitoreoMapaLocalRect[] = [];
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

  let zi = 0;
  let rowY = 40;
  for (const bucket of buckets.values()) {
    const col = zi % 2;
    if (zi > 0 && col === 0) {
      rowY += zoneHeight + zoneGapY;
    }
    const zx = 40 + col * (zoneWidth + zoneGapX);
    const zy = rowY;

    zonas.push({
      id: bucket.id,
      nombre: bucket.nombre,
      x: zx,
      y: zy,
      width: zoneWidth,
      height: zoneHeight,
    });
    rects.push({ x: zx, y: zy, width: zoneWidth, height: zoneHeight });

    bucket.locales.forEach((fila, li) => {
      const colL = li % colsLocales;
      const rowL = Math.floor(li / colsLocales);
      const idLocal = String(fila['id'] ?? fila['idLocal'] ?? `local-${li + 1}`).trim();
      const nombre = String(
        fila['nombre'] ?? fila['nombreLocal'] ?? fila['local'] ?? `Local ${li + 1}`,
      ).trim();
      const estNum =
        fila['estatusLocal'] != null
          ? Number(fila['estatusLocal'])
          : Number(fila['estatus']);
      let estado = 'libre';
      if (fila['ocupado'] === true || estNum === 2) estado = 'ocupado';
      else if (estNum === 3) estado = 'reservado';
      else if (estNum === 0) estado = 'inactivo';
      else if (estNum === 1) estado = 'libre';
      else {
        const e = String(fila['estado'] ?? 'libre').toLowerCase().trim();
        if (e === 'ocupado' || e === 'reservado' || e === 'inactivo') estado = e;
      }

      const rect = {
        x: zx + padX + colL * (localW + localGapX),
        y: zy + padY + rowL * (localH + localGapY),
        width: localW,
        height: localH,
      };
      locales.push({
        id: idLocal,
        nombre,
        ...rect,
        zonaId: bucket.id,
        estado,
      });
      rects.push(rect);
    });

    zi++;
  }

  return {
    canvas: canvasDesdeRects(rects),
    zonas,
    locales,
  };
}
