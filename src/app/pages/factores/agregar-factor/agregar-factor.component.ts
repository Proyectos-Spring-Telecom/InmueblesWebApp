import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FactorPayload, FactoresService } from 'src/app/services/moduleService/factores.service';
import { IncrementosService } from 'src/app/services/moduleService/incrementos.service';
import {
  InpcPaginatedGridRow,
  mapInpcPaginatedItemToRow,
} from 'src/app/pages/incrementos/inpc-historico.data';
import {
  formatValorMilesParaLista,
  valorSinComasParaApi,
} from 'src/app/shared/valor-miles-format';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-factor',
  templateUrl: './agregar-factor.component.html',
  styleUrl: './agregar-factor.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarFactorComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public factorForm: FormGroup;
  public idFactor: number | null = null;
  public title = 'Agregar Factor';
  public inpcOpciones: InpcPaginatedGridRow[] = [];
  public cargandoInpc = false;
  public inpcSeleccionado: InpcPaginatedGridRow | null = null;
  fechaInicioFiltro = '';
  fechaFinFiltro = '';
  private factorPendienteEdicion: Record<string, unknown> | null = null;

  constructor(
    private fb: FormBuilder,
    private factoresService: FactoresService,
    private incrementosService: IncrementosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.aplicarRangoFechasPorDefecto();
    this.initForm();
    this.cargarCatalogoInpc();
    this.activatedRouted.params.subscribe((params) => {
      const raw = params['idFactor'];
      const idn = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
      this.idFactor = Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
      if (this.idFactor != null) {
        this.title = 'Actualizar Factor';
        this.obtenerFactor();
      } else {
        this.title = 'Agregar Factor';
      }
    });
  }

  initForm(): void {
    this.factorForm = this.fb.group({
      variable: ['', [Validators.required, Validators.maxLength(100)]],
      inpcId: [null as string | null, [Validators.required]],
      valor: [{ value: '', disabled: true }],
      descripcion: ['', [Validators.maxLength(2000)]],
    });

    this.factorForm.get('inpcId')?.valueChanges.subscribe((id: string | null) => {
      this.onInpcSeleccionadoChange(id);
    });
  }

  private rangoFechasPorDefecto(): { inicio: string; fin: string } {
    const anio = new Date().getFullYear();
    return {
      inicio: `${anio}-01-01`,
      fin: this.isoFechaHoy(),
    };
  }

  private isoFechaHoy(): string {
    return this.toIsoFecha(new Date());
  }

  private aplicarRangoFechasPorDefecto(): void {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
  }

  private asegurarRangoFechasInpc(): void {
    const rango = this.rangoFechasPorDefecto();
    if (!this.fechaInicioFiltro?.trim()) this.fechaInicioFiltro = rango.inicio;
    if (!this.fechaFinFiltro?.trim()) this.fechaFinFiltro = rango.fin;
  }

  private toIsoFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  aplicarFiltrosInpcCatalogo(): void {
    this.asegurarRangoFechasInpc();
    if (!this.validarRangoFechasInpc(true)) return;
    this.cargarCatalogoInpc();
  }

  private validarRangoFechasInpc(mostrarAlerta: boolean): boolean {
    if (this.fechaInicioFiltro > this.fechaFinFiltro) {
      if (mostrarAlerta) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
          title: 'Rango inválido',
          text: 'La fecha inicial no puede ser posterior a la final.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }
    return true;
  }

  private cargarCatalogoInpc(): void {
    this.asegurarRangoFechasInpc();
    if (!this.validarRangoFechasInpc(false)) {
      this.cargandoInpc = false;
      return;
    }

    const inicio = this.fechaInicioFiltro.trim();
    const fin = this.fechaFinFiltro.trim();
    const idPrevio = this.factorForm?.get('inpcId')?.value ?? null;

    this.cargandoInpc = true;
    this.incrementosService.obtenerInpcListado(inicio, fin).subscribe({
      next: (resp) => {
        const rows = (Array.isArray(resp?.data) ? resp.data : [])
          .map((item) => mapInpcPaginatedItemToRow(item))
          .filter((row): row is InpcPaginatedGridRow => row != null);
        this.finalizarCargarInpc(rows, idPrevio);
      },
      error: () => {
        this.inpcOpciones = [];
        this.cargandoInpc = false;
        this.aplicarFactorPendienteEdicion();
      },
    });
  }

  private finalizarCargarInpc(rows: InpcPaginatedGridRow[], idPrevio: string | null): void {
    this.inpcOpciones = rows.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
    this.cargandoInpc = false;

    if (idPrevio != null && !this.inpcPorId(idPrevio)) {
      this.factorForm.patchValue({ inpcId: null, valor: '' }, { emitEvent: false });
      this.inpcSeleccionado = null;
    }

    this.aplicarFactorPendienteEdicion();
  }

  private inpcPorId(id: string | null | undefined): InpcPaginatedGridRow | null {
    if (id == null || String(id).trim() === '') return null;
    return this.inpcOpciones.find((o) => o.id === id) ?? null;
  }

  onInpcSeleccionadoChange(id: string | null): void {
    const row = this.inpcPorId(id);
    this.inpcSeleccionado = row;
    this.factorForm
      .get('valor')
      ?.setValue(row ? this.formatValorInpcVista(row) : '', { emitEvent: false });
  }

  /** Solo presentación en el input; el payload usa `inpc.inpc` del periodo seleccionado. */
  private formatValorInpcVista(row: InpcPaginatedGridRow): string {
    const inpc = formatValorMilesParaLista(row.inpc);
    const pctRaw = String(row.porcentajeAnualFmt ?? '').trim();
    if (!pctRaw || pctRaw === '-') return inpc;
    const pct = pctRaw.endsWith('%') ? pctRaw : `${pctRaw}%`;
    return `${inpc} - ${pct}`;
  }

  etiquetaOpcionInpc(row: InpcPaginatedGridRow): string {
    return row.fecha;
  }

  private aplicarFactorPendienteEdicion(): void {
    const data = this.factorPendienteEdicion;
    if (!data || this.inpcOpciones.length === 0) return;

    const anioInpc = Number(data['anioInpc'] ?? data['anioINPC'] ?? data['AnioInpc']);
    const mesInpc = Number(data['mesInpc'] ?? data['mesINPC'] ?? data['MesInpc']);
    const match =
      (Number.isFinite(anioInpc) && Number.isFinite(mesInpc)
        ? this.inpcOpciones.find((o) => o.anio === anioInpc && o.mes === mesInpc)
        : null) ?? this.buscarInpcPorValor(data);

    this.factorForm.patchValue(
      {
        variable: data['variable'] ?? data['nombre'] ?? '',
        inpcId: match?.id ?? null,
        valor: match ? this.formatValorInpcVista(match) : formatValorMilesParaLista(data['valor'] ?? ''),
        descripcion: data['descripcion'] ?? '',
      },
      { emitEvent: false },
    );
    this.inpcSeleccionado = match;
    this.factorForm.markAsPristine();
    this.factorPendienteEdicion = null;
  }

  private buscarInpcPorValor(data: Record<string, unknown>): InpcPaginatedGridRow | null {
    const raw = String(data['valor'] ?? '').replace(/,/g, '').trim();
    const valor = Number(raw);
    if (!Number.isFinite(valor)) return null;
    const candidatos = this.inpcOpciones.filter((o) => o.inpc === valor);
    return candidatos.length === 1 ? candidatos[0] : null;
  }

  obtenerFactor(): void {
    if (this.idFactor == null) return;

    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: 'Cargando...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    setTimeout(() => Swal.close(), 1000);

    this.factoresService.obtenerFactor(this.idFactor).subscribe({
      next: (res: any) => {
        const data = (res?.data ?? res ?? {}) as Record<string, unknown>;
        this.factorPendienteEdicion = data;
        this.aplicarFactorPendienteEdicion();
      },
      error: () => {
        setTimeout(() => {
          void Swal.fire({
            title: '¡Ops!',
            text: 'No se pudo cargar el factor.',
            icon: 'error',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
            background: '#141a21',
            color: '#ffffff',
          });
          this.regresar();
        }, 1000);
      },
    });
  }

  submit(): void {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idFactor != null) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private etiquetas: Record<string, string> = {
    variable: 'Variable',
    inpcId: 'Periodo INPC',
    descripcion: 'Descripción',
  };

  private mostrarErroresValidacion(esActualizar: boolean): void {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;
    const camposFaltantes: string[] = [];
    Object.keys(this.factorForm.controls).forEach((key) => {
      const control = this.factorForm.get(key);
      if (control?.invalid) {
        camposFaltantes.push(this.etiquetas[key] || key);
      }
    });
    const lista = camposFaltantes
      .map(
        (campo, index) => `
          <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                      background: #caa8a8; text-align: center; margin-bottom: 8px;
                      border-radius: 4px;">
            <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
          </div>
        `,
      )
      .join('');
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Revise el formulario!',
      html: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Corrija los campos indicados antes de continuar.
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
      icon: 'error',
      confirmButtonText: 'Entendido',
    });
  }

  private buildPayload(): FactorPayload {
    const v = this.factorForm.getRawValue();
    const inpc = this.inpcPorId(v.inpcId);
    const desc = (v.descripcion ?? '').toString().trim();
    const valorFuente = inpc != null ? String(inpc.inpc) : String(v.valor ?? '');
    return {
      variable: (v.variable ?? '').toString().trim(),
      valor: valorSinComasParaApi(valorFuente),
      descripcion: desc.length ? desc : null,
      anioInpc: inpc?.anio ?? 0,
      mesInpc: inpc?.mes ?? 0,
    };
  }

  agregar(): void {
    if (this.factorForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = this.buildPayload();
    this.factoresService.agregarFactor(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: 'Se agregó un nuevo factor de manera exitosa.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: (err) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: this.mensajeErrorHttp(err),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  actualizar(): void {
    if (this.idFactor == null) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      return;
    }
    if (this.factorForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = this.buildPayload();
    this.factoresService.actualizarFactor(this.idFactor, payload).subscribe({
      next: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: 'Los datos del factor se actualizaron correctamente.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: (err) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: this.mensajeErrorHttp(err),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  private mensajeErrorHttp(err: unknown): string {
    const e = err as { error?: string | { message?: string; mensaje?: string }; message?: string };
    const nested = e?.error;
    if (typeof nested === 'string' && nested.trim()) return nested;
    if (nested && typeof nested === 'object') {
      const msg = nested.message ?? nested.mensaje;
      if (msg != null && String(msg).trim()) return String(msg);
    }
    if (e?.message) return String(e.message);
    return 'Ocurrió un error al comunicarse con el servidor.';
  }

  regresar(): void {
    this.route.navigateByUrl('/factores');
  }
}

