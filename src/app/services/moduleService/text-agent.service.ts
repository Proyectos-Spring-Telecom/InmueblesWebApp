import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  Observable,
  catchError,
  map,
  of,
  switchMap,
  throwError,
  timeout,
} from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RespuestaAgente {
  response: string;
  conversation_id: string;
  tools_used: string[];
  processing_time_ms: number;
}

export interface ConversacionResumen {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversacionMensaje {
  role: 'user' | 'assistant' | string;
  content: string;
  created_at: string;
}

export interface ConversacionDetalle {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ConversacionMensaje[];
}

export interface ListadoConversaciones {
  data: ConversacionResumen[];
  paginated: { total: number; page: number; limit: number; last_page: number };
}

export type TextAgentErrorCode =
  | 'SESION_EXPIRADA'
  | 'DEMASIADAS_PREGUNTAS'
  | 'AGENTE_NO_DISPONIBLE'
  | 'NO_ENCONTRADA'
  | 'VALIDACION';

export class TextAgentError extends Error {
  constructor(
    public readonly code: TextAgentErrorCode,
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'TextAgentError';
  }
}

const CONV_KEY = 'agente.conversationId';
const CHAT_TIMEOUT_MS = 60_000;

/**
 * Cliente de textAgentAPI (`docs` / agente_consumo_front.md).
 * Base: https://springtelecom.mx/textAgent/api
 */
@Injectable({ providedIn: 'root' })
export class TextAgentService {
  private readonly base = environment.API_TEXT_AGENT;

  constructor(private http: HttpClient) {}

  get conversationId(): string | null {
    return sessionStorage.getItem(CONV_KEY);
  }

  /** Omite conversation_id (nueva conversación). */
  nuevaConversacion(): void {
    sessionStorage.removeItem(CONV_KEY);
  }

  /** Al cerrar sesión o cambiar de usuario. */
  limpiarSesionAgente(): void {
    this.nuevaConversacion();
  }

  preguntar(mensaje: string, retried404 = false): Observable<RespuestaAgente> {
    const text = mensaje.trim();
    if (!text || text.length > 4000) {
      return throwError(
        () =>
          new TextAgentError(
            'VALIDACION',
            text ? 'El mensaje no puede superar 4000 caracteres.' : 'Escribe un mensaje.',
          ),
      );
    }

    const body: { message: string; conversation_id?: string } = { message: text };
    const conv = this.conversationId;
    if (conv) body.conversation_id = conv;

    return this.http
      .post<RespuestaAgente>(`${this.base}/chat`, body, {
        headers: this.headers(),
        observe: 'response',
      })
      .pipe(
        timeout(CHAT_TIMEOUT_MS),
        switchMap((res) => {
          const data = res.body;
          if (!data?.conversation_id || typeof data.response !== 'string') {
            return throwError(
              () => new TextAgentError('AGENTE_NO_DISPONIBLE', 'Respuesta inválida del asistente.'),
            );
          }
          sessionStorage.setItem(CONV_KEY, data.conversation_id);
          return of(data);
        }),
        catchError((err: unknown) => this.handleChatError(err, mensaje, retried404)),
      );
  }

  listarConversaciones(page = 1, limit = 20): Observable<ListadoConversaciones> {
    return this.http
      .get<ListadoConversaciones>(`${this.base}/conversations`, {
        headers: this.headers(),
        params: { page: String(page), limit: String(limit) },
      })
      .pipe(
        timeout(CHAT_TIMEOUT_MS),
        catchError((err) => throwError(() => this.mapHttpError(err))),
      );
  }

  abrirConversacion(id: string): Observable<ConversacionDetalle> {
    return this.http
      .get<ConversacionDetalle>(`${this.base}/conversations/${id}`, {
        headers: this.headers(),
      })
      .pipe(
        timeout(CHAT_TIMEOUT_MS),
        map((conv) => {
          sessionStorage.setItem(CONV_KEY, conv.id);
          return conv;
        }),
        catchError((err) => throwError(() => this.mapHttpError(err))),
      );
  }

  borrarConversacion(id: string): Observable<void> {
    return this.http
      .delete(`${this.base}/conversations/${id}`, {
        headers: this.headers(),
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        timeout(CHAT_TIMEOUT_MS),
        map((res) => {
          if (res.status !== 204 && res.status !== 404) {
            throw new TextAgentError('AGENTE_NO_DISPONIBLE', 'No se pudo borrar la conversación.');
          }
          if (this.conversationId === id) this.nuevaConversacion();
        }),
        catchError((err: unknown) => {
          if (err instanceof HttpErrorResponse && (err.status === 204 || err.status === 404)) {
            if (this.conversationId === id) this.nuevaConversacion();
            return of(void 0);
          }
          if (err instanceof TextAgentError) return throwError(() => err);
          return throwError(() => this.mapHttpError(err));
        }),
      );
  }

  health(): Observable<boolean> {
    return this.http.get<{ status?: string }>(`${this.base}/health`).pipe(
      timeout(8_000),
      map((r) => r?.status === 'ok'),
      catchError(() => of(false)),
    );
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Solution': 'inmuebles',
    });
  }

  private handleChatError(
    err: unknown,
    mensaje: string,
    retried404: boolean,
  ): Observable<RespuestaAgente> {
    if (err instanceof TextAgentError) return throwError(() => err);

    if (err instanceof HttpErrorResponse) {
      if (err.status === 404 && this.conversationId && !retried404) {
        this.nuevaConversacion();
        return this.preguntar(mensaje, true);
      }
      return throwError(() => this.mapHttpError(err));
    }

    // Timeout / red
    return throwError(
      () =>
        new TextAgentError(
          'AGENTE_NO_DISPONIBLE',
          'El asistente no está disponible. Intenta más tarde.',
        ),
    );
  }

  private mapHttpError(err: unknown): TextAgentError {
    if (!(err instanceof HttpErrorResponse)) {
      return new TextAgentError(
        'AGENTE_NO_DISPONIBLE',
        'El asistente no está disponible. Intenta más tarde.',
      );
    }

    const retry =
      numHeader(err.headers.get('retry-after-usuario')) ??
      numHeader(err.headers.get('retry-after-ip')) ??
      numHeader(err.headers.get('Retry-After'));

    switch (err.status) {
      case 400:
        return new TextAgentError('VALIDACION', 'Revisa el mensaje e intenta de nuevo.');
      case 401:
        return new TextAgentError('SESION_EXPIRADA', 'Tu sesión expiró. Vuelve a iniciar sesión.');
      case 404:
        return new TextAgentError('NO_ENCONTRADA', 'Conversación no encontrada.');
      case 429:
        return new TextAgentError(
          'DEMASIADAS_PREGUNTAS',
          'Espera un momento antes de preguntar otra vez.',
          retry ?? 30,
        );
      case 503:
        return new TextAgentError(
          'AGENTE_NO_DISPONIBLE',
          'El asistente no está disponible. Reintenta en unos segundos.',
        );
      default:
        return new TextAgentError(
          'AGENTE_NO_DISPONIBLE',
          'El asistente no está disponible. Intenta más tarde.',
        );
    }
  }
}

function numHeader(v: string | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : undefined;
}
