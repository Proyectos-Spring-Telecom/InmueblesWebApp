import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TipoCampoPlantilla = 'texto' | 'fecha' | 'numero' | 'decimal' | 'correo' | 'telefono';

export interface CampoPlantilla {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoPlantilla;
  valor: string | number | null;
}

export interface SeccionPlantilla {
  clave: string;
  titulo: string;
  campos: CampoPlantilla[];
}

export interface PlantillaContrato {
  clave: string;
  nombre: string;
  secciones: SeccionPlantilla[];
}

@Injectable({
  providedIn: 'root'
})
export class PlantillaContratoService {

  constructor(private http: HttpClient) { }

  private readonly apiUrl = `${environment.API_SECURITY}/contratos/plantilla/subarrendamiento`;
  private readonly generadosUrl = `${environment.API_SECURITY}/contratos/generados`;

  obtenerPlantillaSubarrendamiento(): Observable<PlantillaContrato> {
    return this.http.get<PlantillaContrato>(this.apiUrl);
  }

  /** Recibe la plantilla con los valores capturados y regresa el PDF del contrato. */
  vistaPreviaSubarrendamiento(plantilla: PlantillaContrato): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/vista-previa`, plantilla, { responseType: 'blob' });
  }

  /** Contratos guardados desde la vista previa, con el usuario que los registró. */
  obtenerContratosGenerados(): Observable<any> {
    return this.http.get(this.generadosUrl);
  }

  /** Plantilla guardada para volver a abrirla en el editor. */
  obtenerContratoGenerado(id: number): Observable<any> {
    return this.http.get(`${this.generadosUrl}/${id}`);
  }

  /** Reemplaza la plantilla guardada; se envía el mismo JSON que en los POST. */
  actualizarContratoGenerado(id: number, plantilla: PlantillaContrato): Observable<any> {
    return this.http.patch(`${this.generadosUrl}/${id}`, plantilla);
  }

  /** Guarda en ContratosGenerados la misma plantilla enviada a la vista previa. */
  guardarContratoGenerado(plantilla: PlantillaContrato): Observable<any> {
    return this.http.post(this.generadosUrl, plantilla);
  }

}
