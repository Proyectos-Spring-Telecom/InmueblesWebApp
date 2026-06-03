import { OperacionPagosHubConfig } from 'src/app/shared/operacion-pagos-hub/operacion-pagos-hub.model';

export const PAGOS_MANTENIMIENTO_HUB_CONFIG: OperacionPagosHubConfig = {
  titulo: 'Pagos de mantenimiento',
  eyebrow: 'Catálogos',
  iconoCabecera: 'handyman',
  rutaBase: '/arrendatarios/pagos-mantenimiento',
  migas: [
    { etiqueta: 'Operación' },
    { etiqueta: 'Arrendatarios' },
    { etiqueta: 'Pagos de mantenimiento', activa: true },
  ],
  vistas: [
    {
      segmento: 'actual',
      titulo: 'Mes en curso',
      descripcion: 'Registrar mantenimientos del periodo y marcar pagos',
      icono: 'event_available',
    },
    {
      segmento: 'historico',
      titulo: 'Histórico',
      descripcion: 'Consultar pagos de mantenimiento por fechas',
      icono: 'history',
    },
  ],
};
