import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthenticationService } from './auth.service';
import { AUTH_RETRIED_AFTER_REFRESH } from './auth-http.context';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private authService: AuthenticationService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    const isAuthEndpoint = this.isAuthEndpoint(req.url);
    const authReq = token && !isAuthEndpoint ? this.addToken(req, token) : req;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.shouldAttemptRefresh(error, req)) {
          return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    );
  }

  private shouldAttemptRefresh(error: HttpErrorResponse, req: HttpRequest<any>): boolean {
    const status = error.status;
    if (status !== 401 && status !== 403) return false;
    // 403 con Bearer suele ser JWT rechazado en algunos filtros; sin Authorization es más probable un permiso real.
    if (status === 403 && !req.headers.get('Authorization')) return false;
    if (req.context.get(AUTH_RETRIED_AFTER_REFRESH)) return false;
    if (req.url.includes('/login/refresh') || req.url.includes('/login/logout')) return false;
    if (this.isAuthEndpoint(req.url)) return false;
    if (this.authService.isRefreshBlocked()) return false;
    return true;
  }

  private handle401Error(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!this.authService.getRefreshToken()) {
      this.authService.clearSessionOnly();
      return this.sessionExpiredError();
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          const newToken = this.authService.getToken();
          if (!newToken) {
            this.refreshTokenSubject.next('');
            this.authService.clearSessionOnly();
            return this.sessionExpiredError();
          }
          this.refreshTokenSubject.next(newToken);
          return this.retryWithToken(req, next, newToken);
        }),
        catchError((refreshErr: HttpErrorResponse) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next('');
          // Refresh 401 (token inválido/expirado): limpiar sesión, sin redirigir al login.
          this.authService.clearSessionOnly();
          return throwError(() => refreshErr);
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => {
        if (!token) {
          return this.sessionExpiredError();
        }
        return this.retryWithToken(req, next, token);
      })
    );
  }

  private retryWithToken(
    req: HttpRequest<any>,
    next: HttpHandler,
    token: string
  ): Observable<HttpEvent<any>> {
    const retryReq = this.addToken(req, token).clone({
      context: req.context.set(AUTH_RETRIED_AFTER_REFRESH, true),
    });
    return next.handle(retryReq);
  }

  private sessionExpiredError(): Observable<never> {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 0,
          statusText: 'SESSION_EXPIRED',
          error: { message: 'La sesión finalizó. Inicia sesión nuevamente.' },
        })
    );
  }

  private addToken(request: HttpRequest<any>, token: string): HttpRequest<any> {
    if (!token) return request;
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private isAuthEndpoint(url: string): boolean {
    const path = this.requestPath(url);
    if (path.includes('/login/me')) return false;
    // Evitar falsos positivos tipo ".../login-recovery" (includes('/login') fallaba antes).
    return /\/login(\/|$)/.test(path);
  }

  private requestPath(url: string): string {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).pathname || '';
      }
    } catch {
      /* seguir con url relativa */
    }
    const q = url.indexOf('?');
    const base = q === -1 ? url : url.slice(0, q);
    return base.startsWith('/') ? base : `/${base}`;
  }
}
