import { HttpContextToken } from '@angular/common/http';

/** Evita un segundo intento de refresh si la petición ya se reenvió con token nuevo. */
export const AUTH_RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

/**
 * El 403 de esta petición significa "sin permiso para este recurso" (p. ej. APIs externas que
 * validan el rol), no sesión vencida: no se intenta refresh ni se cierra la sesión.
 * Los 401 siguen el flujo normal.
 */
export const AUTH_403_ES_PERMISO = new HttpContextToken<boolean>(() => false);
