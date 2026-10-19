/** Mensaje uniforme cuando la API responde 404 (id inexistente o de otro cliente). */
export const MENSAJE_REGISTRO_NO_ENCONTRADO =
  'Registro no encontrado. Es posible que no exista o que no pertenezca a tu cliente.';

/** `true` si el error HTTP es 404: el registro no existe o pertenece a otro cliente. */
export function esRegistroNoEncontrado(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 404;
}

/**
 * Mensaje legible de un error de la API (`error.message` puede venir como texto o arreglo de validaciones).
 */
export function mensajeErrorApi(err: unknown, fallback: string): string {
  if (esRegistroNoEncontrado(err)) return MENSAJE_REGISTRO_NO_ENCONTRADO;
  const e = err as { error?: { message?: unknown } | string; message?: unknown } | null;
  const cuerpo = e?.error;
  const raw =
    (typeof cuerpo === 'object' && cuerpo != null ? cuerpo.message : undefined) ??
    (typeof cuerpo === 'string' && cuerpo.trim() ? cuerpo : undefined) ??
    e?.message;
  if (Array.isArray(raw)) {
    const partes = raw.map((x) => String(x ?? '').trim()).filter(Boolean);
    if (partes.length) return partes.join('\n');
  }
  const texto = typeof raw === 'string' ? raw.trim() : '';
  return texto || fallback;
}
