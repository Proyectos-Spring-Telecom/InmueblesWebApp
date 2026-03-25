// ✅ Nuevo interceptor funcional compatible con withInterceptors()
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthenticationService } from 'src/app/services/auth.service';

export const interceptServiceInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthenticationService);
  const token = auth.getToken();

  const isPasswordResetFromLink =
    req.url.includes('/login/cambiar/accesso') && req.method === 'PATCH';

  // ✅ Si hay token, lo agrega al header Authorization (excepto PATCH cambio contraseña desde enlace, que usa token de la URL)
  if (token && !isPasswordResetFromLink) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // ✅ Solo agrega Content-Type si NO es FormData
  if (!(req.body instanceof FormData)) {
    if (!req.headers.has('Content-Type')) {
      req = req.clone({
        setHeaders: { 'Content-Type': 'application/json' }
      });
    }
  }

  return next(req);
};
