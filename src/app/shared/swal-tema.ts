/** Colores de SweetAlert según el tema activo (alertas disparadas desde grids). */
export function coloresSwalTema(): { background: string; color: string } {
  const claro = document.documentElement.classList.contains('light-theme');
  return claro
    ? { background: '#ffffff', color: '#1e293b' }
    : { background: '#141a21', color: '#ffffff' };
}
