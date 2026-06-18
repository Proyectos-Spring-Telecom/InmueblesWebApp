import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  Subject,
  of,
  switchMap,
  tap,
  map,
  catchError,
  throwError,
  shareReplay,
  finalize,
} from 'rxjs';
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
  private static readonly TOKEN_KEY = 'token';
  private static readonly REFRESH_KEY = 'refreshToken';
  /** Solo en sessionStorage: indica login explícito en esta pestaña/sesión del navegador. */
  private static readonly SESSION_ACTIVE_KEY = 'authSessionActive';
  private static readonly AUTH_STORAGE_KEYS = [
    'token',
    'refreshToken',
    'user',
    'permissions',
    'coordinates',
    AuthenticationService.SESSION_ACTIVE_KEY,
  ] as const;

  private authenticationChanged = new Subject<boolean>();
  private user: User | null = null;
  /** Sesión confirmada con el servidor en esta carga de la app. */
  private sessionValidated = false;
  private sessionCheck$: Observable<boolean> | null = null;
  /** Tras un refresh rechazado (401), no volver a llamar /login/refresh. */
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
    this.purgeStalePersistentAuth();
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
        this.activateBrowserSession();
        this.sessionValidated = true;
        this.authenticationChanged.next(this.isAuthenticated());
      })
    );
  }

  /**
   * Comprueba con el servidor que la sesión sigue vigente.
   * Si falla (p. ej. access expirado), no limpia tokens ni fuerza login: el interceptor
   * renovará con /login/refresh ante 401 en peticiones de negocio.
   */
  public ensureSessionValid(): Observable<boolean> {
    if (!this.isAuthenticated()) {
      return of(false);
    }
    if (this.sessionValidated) {
      return of(true);
    }
    if (!this.sessionCheck$) {
      this.sessionCheck$ = this.getMe().pipe(
        map(() => true),
        catchError(() => of(this.isAuthenticated())),
        finalize(() => {
          this.sessionCheck$ = null;
        }),
        shareReplay(1)
      );
    }
    return this.sessionCheck$;
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

  /** Limpia credenciales sin navegar (p. ej. refresh rechazado: el usuario permanece en la pantalla actual). */
  public clearSessionOnly(): void {
    this.user = null;
    this.cleanSession();
    this.invalidateSessionValidation();
    this.authenticationChanged.next(false);
    this.blockRefresh();
  }

  /** Cierre de sesión explícito (logout): limpia y va al login sin query params. */
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
    this.invalidateSessionValidation();
  }

  private invalidateSessionValidation(): void {
    this.sessionValidated = false;
    this.sessionCheck$ = null;
  }

  /**
   * Sesión activa: login explícito en esta sesión del navegador + credenciales guardadas.
   * Tokens en localStorage de sesiones anteriores no cuentan como autenticado.
   */
  public isAuthenticated(): boolean {
    return this.hasBrowserSessionFlag() && !!(this.getToken() || this.getRefreshToken());
  }

  public blockRefresh(): void {
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
    return this.readAuthStorage(AuthenticationService.TOKEN_KEY);
  }

  public getRefreshToken(): string {
    return this.readAuthStorage(AuthenticationService.REFRESH_KEY);
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
    for (const key of AuthenticationService.AUTH_STORAGE_KEYS) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
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
    if (token) {
      this.writeAuthStorage(AuthenticationService.TOKEN_KEY, token);
    }
    if (refreshToken) {
      this.writeAuthStorage(AuthenticationService.REFRESH_KEY, refreshToken);
    }
    if (token || refreshToken) {
      this.refreshBlocked = false;
    }
    this.authenticationChanged.next(this.isAuthenticated());
  }

  private readAuthStorage(key: string): string {
    return this.normalizeStorageValue(sessionStorage.getItem(key));
  }

  private writeAuthStorage(key: string, value: string): void {
    sessionStorage.setItem(key, value);
  }

  private hasBrowserSessionFlag(): boolean {
    return sessionStorage.getItem(AuthenticationService.SESSION_ACTIVE_KEY) === '1';
  }

  private activateBrowserSession(): void {
    sessionStorage.setItem(AuthenticationService.SESSION_ACTIVE_KEY, '1');
  }

  /** Credenciales viejas en localStorage no deben reabrir la app sin login. */
  private purgeStalePersistentAuth(): void {
    if (this.hasBrowserSessionFlag()) {
      return;
    }
    const hadPersistentAuth = AuthenticationService.AUTH_STORAGE_KEYS.some(
      (key) => !!localStorage.getItem(key) || !!sessionStorage.getItem(key)
    );
    if (!hadPersistentAuth) {
      return;
    }
    this.user = null;
    this.cleanSession();
    this.invalidateSessionValidation();
    this.authenticationChanged.next(false);
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