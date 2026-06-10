import {
  extraerFilasRentasActualApi,
  mapRentaActualApiToGridRow,
  RentaActualGridRow,
} from '../lista-rentas-actuales/renta-actual-list.mapper';

export type HistoricoPagoRentaGridRow = RentaActualGridRow;

export function extraerFilasHistoricoPagosRentaApi(resp: unknown): unknown[] {
  return extraerFilasRentasActualApi(resp);
}

export function mapHistoricoPagoRentaApiToGridRow(item: unknown): HistoricoPagoRentaGridRow | null {
  const row = mapRentaActualApiToGridRow(item);
  if (!row) return null;
  return {
    ...row,
    pagada: true,
    pagadaLabel: 'Pagada',
  };
}

export function extraerHistoricoPagoRentaDetalleApi(
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
