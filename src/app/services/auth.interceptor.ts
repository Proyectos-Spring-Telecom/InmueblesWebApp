import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, finalize, switchMap, take } from 'rxjs/operators';
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
    const hadAuth = !!(token && !isAuthEndpoint);
    const authReq = hadAuth ? this.addToken(req, token) : req;

    if (req.url.includes('amazonaws.com')) {
      return next.handle(req);
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (this.shouldAttemptRefresh(error, hadAuth, req)) {
          return this.handle401Error(req, next, error);
        }
        if (this.shouldForceLogin(error, hadAuth, req)) {
          this.authService.clearSessionAndRedirect();
        }
        return throwError(() => error);
      })
    );
  }

  private shouldAttemptRefresh(
    error: HttpErrorResponse,
    hadAuth: boolean,
    req: HttpRequest<any>
  ): boolean {
    const status = error.status;
    if (status !== 401 && status !== 403) return false;
    if (status === 403 && !hadAuth) return false;
    if (req.context.get(AUTH_RETRIED_AFTER_REFRESH)) return false;
    if (req.url.includes('/login/refresh') || req.url.includes('/login/logout')) {
      return false;
    }
    if (this.isAuthEndpoint(req.url)) return false;
    if (this.authService.isRefreshBlocked()) return false;
    return true;
  }

  private shouldForceLogin(
    error: HttpErrorResponse,
    hadAuth: boolean,
    req: HttpRequest<any>
  ): boolean {
    const status = error.status;
    if (status !== 401 && status !== 403) return false;
    if (!hadAuth) return false;
    if (req.context.get(AUTH_RETRIED_AFTER_REFRESH)) return true;
    if (this.authService.isRefreshBlocked()) return true;
    if (!this.authService.getRefreshToken()) return true;
    if (this.isAuthEndpoint(req.url)) return false;
    return false;
  }

  private handle401Error(
    req: HttpRequest<any>,
    next: HttpHandler,
    originalError: HttpErrorResponse
  ): Observable<HttpEvent<any>> {
    if (!this.authService.getRefreshToken()) {
      this.authService.clearSessionAndRedirect();
      return throwError(() => originalError);
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          const newToken = this.authService.getToken();
          if (!newToken) {
            this.refreshTokenSubject.next('');
            this.authService.clearSessionAndRedirect();
            return throwError(() => originalError);
          }
          this.refreshTokenSubject.next(newToken);
          return this.retryWithToken(req, next, newToken);
        }),
        catchError((refreshErr: HttpErrorResponse) => {
          this.refreshTokenSubject.next('');
          if (refreshErr?.status === 401 || refreshErr?.status === 403) {
            this.authService.clearSessionAndRedirect();
          }
          return throwError(() => refreshErr);
        }),
        finalize(() => {
          this.isRefreshing = false;
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => {
        if (!token) {
          this.authService.clearSessionAndRedirect();
          return throwError(() => originalError);
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
