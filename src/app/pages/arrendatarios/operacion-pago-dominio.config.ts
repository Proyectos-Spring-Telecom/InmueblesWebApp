import {
  extraerFilasHistoricoPagosMantenimientoApi,
  extraerHistoricoPagoMantenimientoDetalleApi,
  mapHistoricoPagoMantenimientoApiToGridRow,
} from './historico-pagos-mantenimiento-list.mapper';
import {
  extraerFilasHistoricoPagosRentaApi,
  extraerHistoricoPagoRentaDetalleApi,
  mapHistoricoPagoRentaApiToGridRow,
} from './historico-pagos-renta-list.mapper';
import {
  extraerFilasMantenimientoActualApi,
  extraerMantenimientoActualDetalleApi,
  mapMantenimientoActualApiToGridRow,
} from './mantenimiento-actual-list.mapper';
import {
  extraerFilasRentasActualApi,
  extraerRentaActualDetalleApi,
  mapRentaActualApiToGridRow,
} from './renta-actual-list.mapper';

export type OperacionPagoDominioId = 'renta' | 'mantenimiento';

export interface OperacionPagoDominioConfig {
  id: OperacionPagoDominioId;
  tituloVistaActual: string;
  tituloVistaHistorico: string;
  etiquetaPeriodo: string;
  etiquetaChip: string;
  gridIdActual: string;
  buscarActual: string;
  buscarHistorico: string;
  iconoCabeceraSuelta: string;
  extraerFilasActual: (resp: unknown) => unknown[];
  mapFilaActual: (item: unknown) => ReturnType<typeof mapRentaActualApiToGridRow>;
  extraerDetalleActual: (resp: unknown) => Record<string, unknown> | null;
  extraerFilasHistorico: (resp: unknown) => unknown[];
  mapFilaHistorico: (item: unknown) => ReturnType<typeof mapHistoricoPagoRentaApiToGridRow>;
  extraerDetalleHistorico: (resp: unknown) => Record<string, unknown> | null;
  textos: {
    errorCargarActual: string;
    errorCargarDetalle: string;
    guardarExitoAlta: string;
    guardarExitoEdicion: string;
    guardarSeleccionArrCon: string;
    marcarPagadaTitulo: string;
    marcarPagadaExito: string;
    marcarPagadaError: string;
    modalEyebrow: string;
    resumenContratoMonto: string;
  };
}

export const OPERACION_PAGO_RENTA: OperacionPagoDominioConfig = {
  id: 'renta',
  tituloVistaActual: 'Rentas actuales',
  tituloVistaHistorico: 'Histórico de pagos',
  etiquetaPeriodo: 'renta',
  etiquetaChip: 'Renta',
  gridIdActual: 'gridRentasActual',
  buscarActual: 'Buscar renta...',
  buscarHistorico: 'Buscar en histórico...',
  iconoCabeceraSuelta: 'payments',
  extraerFilasActual: extraerFilasRentasActualApi,
  mapFilaActual: mapRentaActualApiToGridRow,
  extraerDetalleActual: extraerRentaActualDetalleApi,
  extraerFilasHistorico: extraerFilasHistoricoPagosRentaApi,
  mapFilaHistorico: mapHistoricoPagoRentaApiToGridRow,
  extraerDetalleHistorico: extraerHistoricoPagoRentaDetalleApi,
  textos: {
    errorCargarActual: 'Error al cargar rentas actuales:',
    errorCargarDetalle: 'No se pudo cargar la renta',
    guardarExitoAlta: 'La renta del mes se registró correctamente.',
    guardarExitoEdicion: 'La renta se actualizó correctamente.',
    guardarSeleccionArrCon: 'Selecciona arrendatario y contrato para registrar la renta.',
    marcarPagadaTitulo: '¡Registrar Pago!',
    marcarPagadaExito:
      'La renta quedó marcada como pagada y se registró en el histórico.',
    marcarPagadaError: 'Error al marcar renta pagada:',
    modalEyebrow: 'Renta del mes',
    resumenContratoMonto: 'Renta del contrato',
  },
};

export const OPERACION_PAGO_MANTENIMIENTO: OperacionPagoDominioConfig = {
  id: 'mantenimiento',
  tituloVistaActual: 'Mantenimiento actual',
  tituloVistaHistorico: 'Histórico de mantenimiento',
  etiquetaPeriodo: 'mantenimiento',
  etiquetaChip: 'Mantenimiento',
  gridIdActual: 'gridMantenimientoActual',
  buscarActual: 'Buscar mantenimiento...',
  buscarHistorico: 'Buscar en histórico de mantenimiento...',
  iconoCabeceraSuelta: 'handyman',
  extraerFilasActual: extraerFilasMantenimientoActualApi,
  mapFilaActual: mapMantenimientoActualApiToGridRow,
  extraerDetalleActual: extraerMantenimientoActualDetalleApi,
  extraerFilasHistorico: extraerFilasHistoricoPagosMantenimientoApi,
  mapFilaHistorico: mapHistoricoPagoMantenimientoApiToGridRow,
  extraerDetalleHistorico: extraerHistoricoPagoMantenimientoDetalleApi,
  textos: {
    errorCargarActual: 'Error al cargar mantenimientos actuales:',
    errorCargarDetalle: 'No se pudo cargar el mantenimiento',
    guardarExitoAlta: 'El mantenimiento del mes se registró correctamente.',
    guardarExitoEdicion: 'El mantenimiento se actualizó correctamente.',
    guardarSeleccionArrCon:
      'Selecciona arrendatario y contrato para registrar el mantenimiento.',
    marcarPagadaTitulo: '¡Registrar Pago!',
    marcarPagadaExito:
      'El mantenimiento quedó marcado como pagado y se registró en el histórico.',
    marcarPagadaError: 'Error al marcar mantenimiento pagado:',
    modalEyebrow: 'Mantenimiento del mes',
    resumenContratoMonto: 'Monto de mantenimiento en contrato',
  },
};

export function resolverOperacionPagoDominio(
  route: import('@angular/router').ActivatedRoute,
): OperacionPagoDominioConfig {
  let actual: import('@angular/router').ActivatedRoute | null = route;
  while (actual) {
    const cfg = actual.snapshot.data['operacionPagoDominio'] as
      | OperacionPagoDominioConfig
      | undefined;
    if (cfg?.id) return cfg;
    actual = actual.parent;
  }
  return OPERACION_PAGO_RENTA;
}
