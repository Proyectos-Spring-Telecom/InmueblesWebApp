/** Filas de demostración para el grid Fórmulas (presupuestales). */
export interface FormulaPresupuestoDemo {
  id: number;
  nombre: string;
  formula: string;
  estatus: number;
}

export const FORMULAS_PRESUPUESTO_DEMO: FormulaPresupuestoDemo[] = [
  {
    id: 1,
    nombre: 'Fórmula de Incremento de Renta',
    formula: '((inpcActual/inpcAnterior)-uno)*cien',
    estatus: 1,
  },
  {
    id: 2,
    nombre: 'Formula de incremento de solo 50%',
    formula: '(((inpcActual/inpcAnterior)-uno)*cien)/mitad',
    estatus: 1,
  },
];
