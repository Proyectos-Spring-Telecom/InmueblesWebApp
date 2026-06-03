import { OperacionPagosHubConfig } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.model';

export const PAGOS_RENTA_HUB_CONFIG: OperacionPagosHubConfig = {
  titulo: 'Pagos de Renta',
  eyebrow: 'Catálogos',
  iconoCabecera: 'payments',
  rutaBase: '/arrendatarios/pagos-renta',
  migas: [
    { etiqueta: 'Operación' },
    { etiqueta: 'Arrendatarios' },
    { etiqueta: 'Pagos de Renta', activa: true },
  ],
  vistas: [
    {
      segmento: 'actual',
      titulo: 'Mes en curso',
      descripcion: 'Registrar rentas del periodo y marcar pagos',
      icono: 'event_available',
    },
    {
      segmento: 'historico',
      titulo: 'Histórico',
      descripcion: 'Consultar pagos cerrados por rango de fechas',
      icono: 'history',
    },
  ],
};
