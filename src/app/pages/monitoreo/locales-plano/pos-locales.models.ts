/** Contrato drag desde lista / sin zona (compatible con ComanderoAdminPOS). */
export interface MesaDragPayload {
  id: number;
  numero: string;
  meseroNombre: string | null;
  fromSinZona?: boolean;
}

export type FiltroEstadoMesa = 'TODOS' | 'VACIOS' | 'OCUPADOS' | 'EN_PAGO';

export type MesaEstadoUi = 'vacío' | 'ocupado' | 'en_pago';

export interface MesaCatalogo {
  id: number;
  numero: string;
  nombre: string;
  meseroNombre?: string | null;
  idPersonal?: number | null;
  estado: MesaEstadoUi;
  logoUrl?: string;
}

/** Mesa posicionada dentro del cuerpo de una zona (coords relativas bajo el header). */
export interface MesaEnZonaPersist {
  idMesa: number;
  x: number;
  y: number;
}

export interface ZonaDiagramaPersist {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  nombre: string;
  mesas: MesaEnZonaPersist[];
}

export interface MesaSinZonaPersist {
  idMesa: number;
  x: number;
  y: number;
}

/** Snapshot serializado en areaPoligonoJson y en POST asignacion-mesa-zona. */
export interface PlanoLayoutJson {
  zonas: ZonaDiagramaPersist[];
  mesasSinZona: MesaSinZonaPersist[];
  ancho: number;
  alto: number;
  zoom: number;
  mesaTamano: { ancho: number; alto: number };
}

export interface AreaPoligonoApiResponse {
  areaPoligonoJson?: string | PlanoLayoutJson | null;
  mesasSinZona?: MesaSinZonaPersist[] | null;
  data?: { areaPoligonoJson?: string | PlanoLayoutJson };
}

export interface AsignacionMesaZonaBody {
  idSucursal: number;
  json: PlanoLayoutJson;
}

/** Vista en memoria (UI). */
export interface ZonaVm extends ZonaDiagramaPersist {
  _tempNombre?: string;
}

export interface MesaEnPlanoVm {
  idMesa: number;
  zonaId: number | null;
  x: number;
  y: number;
}

/** Contexto desde Monitoreo al abrir «Locales». */
export interface LocalesPlanoContext {
  idSucursal: number;
  nombreSucursal: string;
  mesas: MesaCatalogo[];
}
