import { OperacionPagosHubConfig } from './operacion-pagos-hub.model';

export const HUB_PAGOS_MES: OperacionPagosHubConfig = {
  titulo: 'Pagos del mes en curso',
  eyebrow: 'Catálogos',
  iconoCabecera: 'event_available',
  migas: [
    { etiqueta: 'Operación' },
    { etiqueta: 'Arrendatarios' },
    { etiqueta: 'Pagos del mes', activa: true },
  ],
  rutaBase: '/arrendatarios/pagos-mes',
  vistas: [
    {
      segmento: 'renta',
      titulo: 'Rentas',
      descripcion: 'Registrar rentas del periodo y marcar pagos',
      icono: 'payments',
    },
    {
      segmento: 'mantenimiento',
      titulo: 'Mantenimientos',
      descripcion: 'Registrar mantenimientos del periodo y marcar pagos',
      icono: 'handyman',
    },
  ],
};

export const HUB_PAGOS_HISTORICO: OperacionPagosHubConfig = {
  titulo: 'Histórico de pagos',
  eyebrow: 'Catálogos',
  iconoCabecera: 'history',
  migas: [
    { etiqueta: 'Operación' },
    { etiqueta: 'Arrendatarios' },
    { etiqueta: 'Histórico de pagos', activa: true },
  ],
  rutaBase: '/arrendatarios/pagos-historico',
  vistas: [
    {
      segmento: 'renta',
      titulo: 'Rentas',
      descripcion: 'Consultar pagos de renta cerrados por fechas',
      icono: 'payments',
    },
    {
      segmento: 'mantenimiento',
      titulo: 'Mantenimientos',
      descripcion: 'Consultar pagos de mantenimiento por fechas',
      icono: 'handyman',
    },
  ],
};
