import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';
import { contractDimAnim, contractModalAnim } from 'src/app/pipe/module-open.animation';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { CatServiciosService } from 'src/app/services/moduleService/cat-servicios.service';
import {
  Cargo,
  centavos,
  ClaseCargo,
  CobranzaService,
} from 'src/app/services/moduleService/cobranza.service';
import {
  contratosActivosArrendatarioApi,
  etiquetaContratoArrendatarioApi,
  extraerArrendatarioDetalleApi,
} from '../../arrendatarios-list.mapper';
import { alertaError, alertaExito, alertaValidacion, fmtMoneda, hoyIso } from '../cobranza-ui';

interface Opcion {
  id: number;
  nombre: string;
}

interface ServicioArrendatarioOpcion extends Opcion {
  idTipoServicio: number | null;
  /** Nombre del tipo en minúsculas (respaldo cuando la API no manda el id del tipo). */
  tipoNombre: string;
}

const TIPOS_FIJOS = ['renta', 'mantenimiento'];

function filas(resp: unknown): Record<string, unknown>[] {
  const r = resp as { data?: unknown } | unknown[] | null;
  const lista = Array.isArray(r) ? r : (r as { data?: unknown })?.data;
  return Array.isArray(lista) ? (lista as Record<string, unknown>[]) : [];
}

function esTipoFijo(nombre: string): boolean {
  return TIPOS_FIJOS.includes(nombre.trim().toLowerCase());
}

/**
 * Registrar cargo de servicio u otro concepto (`POST /cargos`). Las rentas se siguen generando en `/renta-actual`.
 */
@Component({
  selector: 'app-registrar-cargo-modal',
  standalone: true,
  imports: [CommonModule, CampoFechaComponent, CampoSelectComponent, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './registrar-cargo-modal.component.html',
  styleUrls: ['../cobranza.scss'],
  animations: [contractDimAnim, contractModalAnim],
})
export class RegistrarCargoModalComponent implements OnInit {
  @Input({ required: true }) idArrendatario!: number;
  @Input() nombreArrendatario = '';
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<Cargo>();

  cargando = true;
  guardando = false;
  contratos: Opcion[] = [];
  readonly opcionesClase: { id: Exclude<ClaseCargo, 'RENTA'>; nombre: string }[] = [
    { id: 'SERVICIO', nombre: 'Servicio' },
    { id: 'OTRO', nombre: 'Otro concepto' },
  ];
  tiposServicio: Opcion[] = [];
  serviciosArrendatario: ServicioArrendatarioOpcion[] = [];

  clase: Exclude<ClaseCargo, 'RENTA'> = 'SERVICIO';
  idContrato: number | null = null;
  fecha = hoyIso();
  idTipoServicio: number | null = null;
  idServicioArrendatario: number | null = null;
  descripcion = '';
  total: number | null = null;
  subtotal: number | null = null;
  iva: number | null = null;

  readonly fmtMoneda = fmtMoneda;

  /** Clic fuera del modal: cierra salvo que haya una operación en curso. */
  cerrarSiLibre(): void {
    if (!this.guardando) this.cerrar.emit();
  }

  constructor(
    private cobranza: CobranzaService,
    private arrendatarios: ArrendatariosService,
    private catServicios: CatServiciosService,
  ) {}

  ngOnInit(): void {
    forkJoin({
      detalle: this.arrendatarios.obtenerArrendatario(this.idArrendatario).pipe(catchError(() => of(null))),
      servicios: this.arrendatarios.obtenerServiciosArrendatario(this.idArrendatario).pipe(catchError(() => of(null))),
      tipos: this.catServicios.obtenerServiciosPaginados(1, 100).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe(({ detalle, servicios, tipos }) => {
        this.contratos = contratosActivosArrendatarioApi(extraerArrendatarioDetalleApi(detalle))
          .map((c) => ({ id: Number(c['id'] ?? c['idContrato']), nombre: etiquetaContratoArrendatarioApi(c) }))
          .filter((c) => c.id > 0);
        if (this.contratos.length === 1) this.idContrato = this.contratos[0].id;

        this.tiposServicio = filas(tipos)
          .filter((t) => t['estatus'] == null || Number(t['estatus']) === 1)
          .map((t) => ({ id: Number(t['id']), nombre: String(t['nombre'] ?? '') }))
          .filter((t) => t.id > 0 && t.nombre && !esTipoFijo(t.nombre));

        this.serviciosArrendatario = filas(servicios)
          .map((s) => {
            const tipo = (s['tipoServicio'] ?? {}) as Record<string, unknown>;
            const nombreTipo = String(tipo['nombre'] ?? '').trim();
            const idTipo = Number(s['idTipoServicio'] ?? tipo['id']);
            const numero = String(s['numeroContrato'] ?? '').trim();
            return {
              id: Number(s['id']),
              idTipoServicio: Number.isFinite(idTipo) && idTipo > 0 ? idTipo : null,
              nombre: [nombreTipo || `Servicio ${s['id']}`, numero ? `contrato ${numero}` : ''].filter(Boolean).join(' · '),
              tipoNombre: nombreTipo.toLowerCase(),
              _tipo: nombreTipo,
            };
          })
          .filter((s) => s.id > 0 && !esTipoFijo(s._tipo))
          .map(({ _tipo, ...s }) => s);
      });
  }

  /** Servicios del arrendatario del tipo elegido. */
  get serviciosDelTipo(): ServicioArrendatarioOpcion[] {
    if (this.idTipoServicio == null) return [];
    const nombreTipo = (this.tiposServicio.find((t) => t.id === this.idTipoServicio)?.nombre ?? '').trim().toLowerCase();
    return this.serviciosArrendatario.filter((s) =>
      s.idTipoServicio != null ? s.idTipoServicio === this.idTipoServicio : !!nombreTipo && s.tipoNombre === nombreTipo,
    );
  }

  onTipoServicio(): void {
    const delTipo = this.serviciosDelTipo;
    this.idServicioArrendatario = delTipo.length === 1 ? delTipo[0].id : null;
  }

  /** Captura el subtotal y calcula IVA 16 % (redondeado) y total = subtotal + IVA. */
  calcularDesdeSubtotal(): void {
    const sub = Number(this.subtotal);
    if (!Number.isFinite(sub) || sub <= 0) return;
    this.iva = centavos(sub * 0.16);
    this.total = centavos(centavos(sub) + this.iva);
  }

  guardar(): void {
    const total = centavos(Number(this.total) || 0);
    const tieneDesglose = this.subtotal != null || this.iva != null;
    const errores: string[] = [];
    if (!this.fecha) errores.push('Captura la fecha del cargo.');
    if (total <= 0) errores.push('Captura un total mayor a 0.');
    if (this.clase === 'SERVICIO' && !this.idTipoServicio) errores.push('Selecciona el tipo de servicio.');
    if (this.clase === 'OTRO' && !this.descripcion.trim()) errores.push('Captura la descripción del cargo.');
    if (tieneDesglose) {
      const sub = centavos(Number(this.subtotal) || 0);
      const iva = centavos(Number(this.iva) || 0);
      if (centavos(sub + iva) !== total) {
        errores.push(`Subtotal (${fmtMoneda(sub)}) + IVA (${fmtMoneda(iva)}) no coincide con el total (${fmtMoneda(total)}).`);
      }
    }
    if (errores.length) {
      alertaValidacion(errores);
      return;
    }

    const concepto: Record<string, unknown> = { total };
    if (this.clase === 'SERVICIO') {
      concepto['idTipoServicio'] = this.idTipoServicio;
      if (this.idServicioArrendatario) concepto['idServicioArrendatario'] = this.idServicioArrendatario;
    } else {
      concepto['descripcion'] = this.descripcion.trim();
    }
    if (tieneDesglose) {
      concepto['subtotal'] = centavos(Number(this.subtotal) || 0);
      concepto['iva'] = centavos(Number(this.iva) || 0);
    }

    this.guardando = true;
    this.cobranza
      .registrarCargo({
        idArrendatario: this.idArrendatario,
        idContrato: this.idContrato ?? undefined,
        clase: this.clase,
        fecha: this.fecha,
        descripcion: this.descripcion.trim() || undefined,
        conceptos: [concepto as { total: number }],
      })
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (cargo) => {
          alertaExito('El cargo se registró correctamente.');
          this.guardado.emit(cargo);
        },
        error: (err) => alertaError('No se pudo registrar el cargo', err, 'Intenta de nuevo.'),
      });
  }
}
