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
      descripcion: 'Registra y consulta el pago de renta mensual por local.',
      icono: 'payments',
    },
    /* {
      segmento: 'mantenimiento',
      titulo: 'Mantenimientos',
      descripcion: 'Registra y consulta las cuotas de mantenimiento del mes.',
      icono: 'handyman',
    }, */
    {
      segmento: 'servicios',
      titulo: 'Servicios',
      descripcion: 'Gestiona agua, luz, gas y otros servicios con su comprobante.',
      icono: 'design_services',
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
      descripcion: 'Busca pagos de renta ya cerrados. Elige las fechas y revisa lo que se cobró.',
      icono: 'payments',
    },
    /* {
      segmento: 'mantenimiento',
      titulo: 'Mantenimientos',
      descripcion: 'Busca pagos de mantenimiento ya cerrados. Elige las fechas y revisa lo registrado.',
      icono: 'handyman',
    }, */
  ],
};
