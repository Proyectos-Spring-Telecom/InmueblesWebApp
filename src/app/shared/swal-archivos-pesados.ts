import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import Swal from 'sweetalert2';

function statusHttp(err: unknown): number | null {
  if (err instanceof HttpErrorResponse) {
    return Number.isFinite(err.status) ? err.status : null;
  }
  if (err == null || typeof err !== 'object') return null;
  const n = Number((err as { status?: unknown; statusCode?: unknown }).status
    ?? (err as { statusCode?: unknown }).statusCode);
  return Number.isFinite(n) ? n : null;
}

function textoErrorHttp(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (typeof err !== 'object') return String(err);
  const e = err as Record<string, unknown>;
  const nested = e['error'];
  return [
    e['status'],
    e['statusText'],
    e['message'],
    e['name'],
    typeof nested === 'string' ? nested : '',
    nested != null && typeof nested === 'object'
      ? String((nested as Record<string, unknown>)['message'] ?? '')
      : '',
  ]
    .map((v) => String(v ?? ''))
    .join(' ')
    .toLowerCase();
}

/** 413 real, o corte de nginx/HTML que Angular reporta como status 0 en subidas. */
export function esErrorHttp413(err: unknown, esSubidaArchivos = false): boolean {
  const status = statusHttp(err);
  if (status === 413) return true;
  if (esSubidaArchivos && status === 0) return true;

  const msg = textoErrorHttp(err);
  return (
    /\b413\b/.test(msg) ||
    msg.includes('content too large') ||
    msg.includes('payload too large') ||
    msg.includes('request entity too large') ||
    msg.includes('entity too large')
  );
}

export function mostrarSwalArchivosDemasiadoPesados(): void {
  void Swal.fire({
    title: 'Archivos Demasiado Pesados',
    html: 'Los archivos que intentas cargar, superan el tamaño permitido. Reduce su tamaño e intentalo nuevamente.',
    icon: 'warning',
    background: '#141a21',
    color: '#ffffff',
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'Confirmar',
  });
}

let ultimoAviso413Ms = 0;

export function manejarErrorHttp413(err: unknown, esSubidaArchivos = false): boolean {
  if (!esErrorHttp413(err, esSubidaArchivos)) return false;
  const ahora = Date.now();
  if (ahora - ultimoAviso413Ms > 400) {
    ultimoAviso413Ms = ahora;
    mostrarSwalArchivosDemasiadoPesados();
  }
  return true;
}

/** Aplica el aviso 413 en POST/PUT de arrendadores, inmuebles y arrendatarios. */
export function conAvisoArchivosPesados<T>(source: Observable<T>): Observable<T> {
  return source.pipe(
    tap({
      error: (err) => {
        manejarErrorHttp413(err, true);
      },
    }),
  );
}
