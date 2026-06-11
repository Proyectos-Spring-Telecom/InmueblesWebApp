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
      descripcion: 'Consulta y registra la renta mensual de cada local. Aquí solo ves los pagos de este mes.',
      icono: 'payments',
    },
    {
      segmento: 'mantenimiento',
      titulo: 'Mantenimientos',
      descripcion: 'Consulta y registra las cuotas de mantenimiento de cada arrendatario. Solo los pagos de este mes.',
      icono: 'handyman',
    },
    {
      segmento: 'servicios',
      titulo: 'Servicios',
      descripcion: 'Consulta y registra agua, luz, gas y otros servicios. Puedes guardar el comprobante de cada pago.',
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
    {
      segmento: 'mantenimiento',
      titulo: 'Mantenimientos',
      descripcion: 'Busca pagos de mantenimiento ya cerrados. Elige las fechas y revisa lo registrado.',
      icono: 'handyman',
    },
  ],
};
