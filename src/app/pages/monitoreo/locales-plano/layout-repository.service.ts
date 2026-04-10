import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AreaPoligonoApiResponse,
  AsignacionMesaZonaBody,
  PlanoLayoutJson,
} from './pos-locales.models';

const DEFAULT_LAYOUT = (): PlanoLayoutJson => ({
  zonas: [],
  mesasSinZona: [],
  ancho: 1600,
  alto: 1000,
  zoom: 1,
  mesaTamano: { ancho: 56, alto: 56 },
});

function parseJsonLayout(raw: unknown): PlanoLayoutJson {
  if (!raw) return DEFAULT_LAYOUT();
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as PlanoLayoutJson;
      return normalizeLayout(o);
    } catch {
      return DEFAULT_LAYOUT();
    }
  }
  return normalizeLayout(raw as PlanoLayoutJson);
}

function normalizeLayout(j: PlanoLayoutJson): PlanoLayoutJson {
  const d = DEFAULT_LAYOUT();
  return {
    zonas: Array.isArray(j?.zonas) ? j.zonas : [],
    mesasSinZona: Array.isArray(j?.mesasSinZona) ? j.mesasSinZona : [],
    ancho: typeof j?.ancho === 'number' && j.ancho > 0 ? j.ancho : d.ancho,
    alto: typeof j?.alto === 'number' && j.alto > 0 ? j.alto : d.alto,
    zoom:
      typeof j?.zoom === 'number' && j.zoom >= 0.1 && j.zoom <= 10
        ? j.zoom
        : d.zoom,
    mesaTamano:
      j?.mesaTamano?.ancho && j?.mesaTamano?.alto
        ? { ancho: j.mesaTamano.ancho, alto: j.mesaTamano.alto }
        : d.mesaTamano,
  };
}

/**
 * Abstracción GET/POST del layout de punto de venta / plano de locales.
 * Rutas alineadas con ComanderoAdminPOS: pos/area-poligono-sucursal, pos/asignacion-mesa-zona.
 */
@Injectable({ providedIn: 'root' })
export class LayoutRepositoryService {
  private readonly base = environment.API_SECURITY;

  constructor(private http: HttpClient) {}

  getLayout(idSucursal: number): Observable<PlanoLayoutJson> {
    if (!idSucursal) {
      return of(DEFAULT_LAYOUT());
    }
    return this.http
      .get<AreaPoligonoApiResponse>(
        `${this.base}/pos/area-poligono-sucursal/${idSucursal}`,
      )
      .pipe(
        map((resp) => {
          const raw =
            resp?.data?.areaPoligonoJson ??
            resp?.areaPoligonoJson ??
            null;
          const layout = parseJsonLayout(raw);
          const rootSin = resp?.mesasSinZona;
          if (Array.isArray(rootSin) && rootSin.length && !layout.mesasSinZona.length) {
            layout.mesasSinZona = rootSin;
          }
          return layout;
        }),
        catchError(() => of(DEFAULT_LAYOUT())),
      );
  }

  postAsignacion(body: AsignacionMesaZonaBody): Observable<void> {
    return this.http
      .post<void>(`${this.base}/pos/asignacion-mesa-zona`, body)
      .pipe(
        catchError((err) =>
          throwError(() => err),
        ),
      );
  }
}

export { DEFAULT_LAYOUT, parseJsonLayout };
