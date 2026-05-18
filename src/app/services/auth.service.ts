import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, of, switchMap, tap, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../entities/User';
import { Credentials } from '../entities/Credentials';
import { BaseServicesService } from './base.service';

interface LoginResponse {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  [key: string]: any;
}

/**
 * Refresh del JWT: no hay temporizadores ni refresh proactivo.
 * `refreshToken()` solo debe llamarse desde `AuthInterceptor` cuando una petición recibe 401 (y en algunos casos 403 con Bearer).
 */
@Injectable({ providedIn: 'root' })
export class AuthenticationService extends BaseServicesService {
  private authenticationChanged = new Subject<boolean>();
  private user: User | null = null;
  /** Tras un refresh rechazado (401), no volver a llamar /login/refresh ni redirigir. */
  private refreshBlocked = false;
  private readonly baseUrl = environment.API_SECURITY;
  /** Cliente sin interceptores: refresh/logout no deben disparar otro refresh ni redirección. */
  private readonly rawHttp: HttpClient;

  constructor(
    private http: HttpClient,
    httpBackend: HttpBackend,
    private router: Router,
  ) {
    super();
    this.rawHttp = new HttpClient(httpBackend);
  }

  public login(body: { userName: string; password: string }): Observable<User> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, body).pipe(
      tap((resp) => {
        this.resetSessionState();
        this.persistTokens(resp);
      }),
      switchMap(() => this.getMe()),
    );
  }

  public getMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/login/me`).pipe(
      tap((user) => {
        this.user = user;
        this.setStorageUser(user);
        this.setStoragePermissions(user?.permisos || []);
        this.authenticationChanged.next(this.isAuthenticated());
      })
    );
  }

  /** Solo desde `AuthInterceptor` ante 401/403 de recurso (no timers). */
  public refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refreshToken available'));
    }

    return this.rawHttp
      .post<LoginResponse>(
        `${this.baseUrl}/login/refresh`,
        { refreshToken },
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      )
      .pipe(tap((resp) => this.persistTokens(resp)));
  }

  public logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSessionAndRedirect();
      return of(void 0);
    }

    return this.rawHttp
      .post(
        `${this.baseUrl}/login/logout`,
        { refreshToken },
        { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
      )
      .pipe(
        map(() => void 0),
        catchError(() => of(void 0)),
        tap(() => this.clearSessionAndRedirect())
      );
  }

  /** Limpia sesión sin navegar (p. ej. refresh 401: el usuario no debe ser expulsado al login). */
  public clearSessionOnly(): void {
    this.user = null;
    this.cleanSession();
    localStorage.clear();
    this.authenticationChanged.next(false);
    this.blockRefresh();
  }

  /** Cierre de sesión explícito (logout): limpia y va al login. */
  public clearSessionAndRedirect(): void {
    this.clearSessionOnly();
    if (!this.isAuthRoute()) {
      void this.router.navigate(['/login']);
    }
  }

  public isRefreshBlocked(): boolean {
    return this.refreshBlocked;
  }

  public resetSessionState(): void {
    this.refreshBlocked = false;
  }

  /**
   * Sesión activa en cliente: access y/o refresh guardados (normalizados).
   * El access puede estar expirado en el servidor; el interceptor renueva ante 401/403 con Bearer.
   */
  public isAuthenticated(): boolean {
    return !!(this.getToken() || this.getRefreshToken());
  }

  private blockRefresh(): void {
    this.refreshBlocked = true;
  }

  private isAuthRoute(): boolean {
    const url = this.router.url || '';
    return (
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      url.startsWith('/solicitud-cambio-password') ||
      url.startsWith('/cambio-password')
    );
  }

  public isAuthenticationChanged(): Observable<boolean> {
    return this.authenticationChanged.asObservable();
  }

  public clearUserData(): void {
    this.user = null;
    this.cleanSession();
    this.authenticationChanged.next(false);
  }

  public getToken(): string {
    const raw = sessionStorage.getItem('token');
    return this.normalizeStorageValue(raw);
  }

  public getRefreshToken(): string {
    const raw = sessionStorage.getItem('refreshToken');
    return this.normalizeStorageValue(raw);
  }

  public setData(data: User): void {
    this.persistTokens(data);
    this.setStorageUser(data);
    this.setStoragePermissions(data?.permisos || []);
  }

  public failToken(): void {
    this.cleanSession();
  }

  public setStorageCoordinate(coordinates: any): void {
    sessionStorage.setItem('coordinates', JSON.stringify(coordinates));
  }

  public updateUsuario(id: string, form: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/controlusuarios/${id}`, form);
  }

  public getUsuarioControl(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/controlusuarios/${id}`);
  }

  public cleanSession(): void {
    sessionStorage.clear();
  }

  public getUser(): User | null {
    const user = sessionStorage.getItem('user');
    if (!user) return null;
    return JSON.parse(user);
  }

  public getCoordinates(): any {
    const coordinates = sessionStorage.getItem('coordinates');
    if (!coordinates) return null;
    return JSON.parse(coordinates);
  }

  public getPermissions(): string[] {
    const permissions = sessionStorage.getItem('permissions');
    if (!permissions) return [];
    return JSON.parse(permissions);
  }

  // Compatibilidad con código existente
  public authenticate(body: Credentials): Observable<User> {
    const userName = (body as any).userName ?? body.username ?? '';
    return this.login({ userName, password: body.password });
  }

  public recuperarAcceso(data: { userName: string }): Observable<string> {
    return this.http.post<string>(
      `${this.baseUrl}/login/recuperar/confirmacion`,
      data,
      { responseType: 'text' as 'json' }
    );
  }

  public reenviarCodigo(payload: { codigo: string }): Observable<string> {
    return this.http.patch<string>(
      `${this.baseUrl}/login/verify`,
      payload,
      { responseType: 'text' as 'json' }
    );
  }

  public cambiarPasswordConToken(token: string, nuevaPassword: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/login/restablecer-password`, {
      token,
      nuevaPassword,
    });
  }

  private persistTokens(payload: LoginResponse | User): void {
    const token = this.extractToken(payload);
    const refreshToken = this.extractRefreshToken(payload);
    if (token) sessionStorage.setItem('token', token);
    if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
    if (token || refreshToken) {
      this.refreshBlocked = false;
    }
    this.authenticationChanged.next(this.isAuthenticated());
  }

  /**
   * Algunos endpoints envuelven credenciales en `data` y otras claves van en la raíz.
   * Si `data` existe pero no trae JWT, hay que leer también el objeto raíz (si no, nunca se guarda refresh).
   */
  private extractToken(payload: any): string {
    return (
      this.readAccessToken(payload?.data) ||
      this.readAccessToken(payload) ||
      ''
    );
  }

  private extractRefreshToken(payload: any): string {
    return (
      this.readRefreshToken(payload?.data) ||
      this.readRefreshToken(payload) ||
      ''
    );
  }

  private readAccessToken(source: any): string {
    if (!source || typeof source !== 'object') return '';
    const v = source.token || source.accessToken || source.access_token || '';
    return typeof v === 'string' ? v : '';
  }

  private readRefreshToken(source: any): string {
    if (!source || typeof source !== 'object') return '';
    const v = source.refreshToken || source.refresh_token || '';
    return typeof v === 'string' ? v : '';
  }

  private setStorageUser(value: any): void {
    sessionStorage.setItem('user', JSON.stringify(value));
  }

  private setStoragePermissions(permissions: any[]): void {
    const permissionIds = (permissions || []).map((perm: any) => {
      if (perm && typeof perm === 'object' && 'idPermiso' in perm) {
        return String(perm.idPermiso);
      }
      return String(perm);
    });

    sessionStorage.setItem('permissions', JSON.stringify(permissionIds));
  }

  private normalizeStorageValue(raw: string | null): string {
    if (!raw || raw === 'null' || raw === 'undefined') return '';
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : raw;
    } catch {
      return raw;
    }
  }
}