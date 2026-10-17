/**
 * Rentas "abiertas" con Apertura de Mes (filas AMARILLAS: ya no se editan, solo se pagan).
 *
 * TEMPORAL: el API aún no tiene campo ni endpoint para guardar la apertura, así que se
 * guarda en el navegador (localStorage). Limitación: solo lo ve este navegador/equipo.
 * Cuando backend lo agregue, solo hay que reemplazar `leer` / `abrir` por llamadas al API;
 * Rent Rol no necesita más cambios.
 */
const CLAVE = 'rentRol.rentasAbiertas';

export const RentRolAperturaStore = {
  /** Ids de /renta-actual que ya pasaron por Apertura de Mes. */
  leer(): Set<number> {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
      return new Set(Array.isArray(raw) ? raw.map(Number).filter((n) => Number.isFinite(n) && n > 0) : []);
    } catch {
      return new Set();
    }
  },

  /** Marca las rentas como abiertas (amarillas). Devuelve false si no se pudo guardar. */
  abrir(ids: number[]): boolean {
    try {
      const actuales = this.leer();
      ids.forEach((id) => actuales.add(id));
      localStorage.setItem(CLAVE, JSON.stringify([...actuales]));
      return true;
    } catch {
      return false;
    }
  },
};
