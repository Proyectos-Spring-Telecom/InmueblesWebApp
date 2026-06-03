import {
  extraerFilasMantenimientoActualApi,
  mapMantenimientoActualApiToGridRow,
  MantenimientoActualGridRow,
} from './mantenimiento-actual-list.mapper';

export type HistoricoPagoMantenimientoGridRow = MantenimientoActualGridRow;

export function extraerFilasHistoricoPagosMantenimientoApi(resp: unknown): unknown[] {
  return extraerFilasMantenimientoActualApi(resp);
}

export function mapHistoricoPagoMantenimientoApiToGridRow(
  item: unknown,
): HistoricoPagoMantenimientoGridRow | null {
  const row = mapMantenimientoActualApiToGridRow(item);
  if (!row) return null;
  return {
    ...row,
    pagada: true,
    pagadaLabel: 'Pagada',
  };
}

export function extraerHistoricoPagoMantenimientoDetalleApi(
  resp: unknown,
): Record<string, unknown> | null {
  if (resp == null) return null;
  if (typeof resp === 'object' && !Array.isArray(resp)) {
    const r = resp as Record<string, unknown>;
    const data = r['data'];
    if (data != null && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    if (r['id'] != null) return r;
  }
  return null;
}
