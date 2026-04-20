/** Filas de demostración para el grid Factores (presupuestales / INPC). */
export interface FactorPresupuestoDemo {
  id: number;
  variable: string;
  valor: string;
  descripcion: string;
  estatus: number;
}

export const FACTORES_PRESUPUESTO_DEMO: FactorPresupuestoDemo[] = [
  {
    id: 1,
    variable: 'inpcAnterior',
    valor: 'variable',
    descripcion: 'INPC Año Anterior',
    estatus: 1,
  },
  {
    id: 2,
    variable: 'inpcActual',
    valor: 'variable',
    descripcion: 'INPC Año Actual',
    estatus: 1,
  },
  { id: 3, variable: 'uno', valor: '1', descripcion: 'Constante uno', estatus: 1 },
  { id: 4, variable: 'cien', valor: '100', descripcion: 'Constante cien', estatus: 1 },
  {
    id: 5,
    variable: 'mitad',
    valor: '2',
    descripcion: 'Incremento Autorizado',
    estatus: 1,
  },
];
