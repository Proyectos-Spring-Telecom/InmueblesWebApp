import { HttpContextToken } from '@angular/common/http';

/** Evita un segundo intento de refresh si la petición ya se reenvió con token nuevo. */
export const AUTH_RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);
