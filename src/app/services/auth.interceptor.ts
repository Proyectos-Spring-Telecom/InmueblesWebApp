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
        if (
          error.status === 401 &&
          !req.url.includes('/login/refresh') &&
          !req.url.includes('/login/logout')
        ) {
          return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          const newToken = this.authService.getToken();
          this.refreshTokenSubject.next(newToken || null);
          return next.handle(this.addToken(req, newToken));
        }),
        catchError(() => {
          this.isRefreshing = false;
          // Desbloquea requests en espera sin propagar 401.
          this.refreshTokenSubject.next('');
          this.authService.clearSessionAndRedirect();
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 0,
                statusText: 'SESSION_EXPIRED',
                error: { message: 'La sesión finalizó. Inicia sesión nuevamente.' },
              })
          );
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => {
        if (!token) {
          return throwError(
            () =>
              new HttpErrorResponse({
                status: 0,
                statusText: 'SESSION_EXPIRED',
                error: { message: 'La sesión finalizó. Inicia sesión nuevamente.' },
              })
          );
        }
        return next.handle(this.addToken(req, token));
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
    return url.includes('/login') && !url.includes('/login/me');
  }
}
