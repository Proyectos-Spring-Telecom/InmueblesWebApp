/** Vista interna del hub (actual / histórico). Reutilizable para renta y mantenimiento. */
export interface OperacionPagosHubVista {
  segmento: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

/** Configuración del módulo unificado (cabecera + segmentos + rutas hijas). */
export interface OperacionPagosHubConfig {
  titulo: string;
  eyebrow: string;
  iconoCabecera: string;
  migas: { etiqueta: string; activa?: boolean }[];
  rutaBase: string;
  vistas: OperacionPagosHubVista[];
}
