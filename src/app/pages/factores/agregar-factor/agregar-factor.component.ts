import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FactorPayload, FactoresService } from 'src/app/services/moduleService/factores.service';
import {
  IncrementosService,
  InpcPaginatedResponse,
} from 'src/app/services/moduleService/incrementos.service';
import { forkJoin } from 'rxjs';
import {
  InpcPaginatedGridRow,
  mapInpcPaginatedItemToRow,
  mesNumeroANombre,
} from 'src/app/pages/incrementos/inpc-historico.data';
import {
  contarMontoSimbolosAntesCursor,
  countDigitosAntesCursor,
  cursorMontoTrasFormato,
  cursorPosicionTrasFormatoMiles,
  formatMilesAlEscribir,
  formatValorMilesParaLista,
  parseValorNumerico,
  valorSinComasParaApi,
} from 'src/app/shared/valor-miles-format';
import Swal from 'sweetalert2';

const factorValorValidador: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const raw = String(c.value ?? '').trim();
  if (!raw) return { required: true };
  const n = parseValorNumerico(raw);
  if (!Number.isFinite(n) || n < 0) return { min: true };
  return null;
};

interface InpcOpcionFactor extends InpcPaginatedGridRow {
  variable: string;
}

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
  public inpcOpciones: InpcOpcionFactor[] = [];
  public cargandoInpc = false;
  public inpcSeleccionado: InpcOpcionFactor | null = null;
  fechaInicioFiltro = '2026-01-01';
  fechaFinFiltro = this.isoFechaHoy();
  private factorPendienteEdicion: Record<string, unknown> | null = null;

  constructor(
    private fb: FormBuilder,
    private factoresService: FactoresService,
    private incrementosService: IncrementosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) { }

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
      inpcId: [null as string | null, [Validators.required]],
      valor: ['', [Validators.required, factorValorValidador]],
      descripcion: ['', [Validators.maxLength(2000)]],
    });

    this.factorForm.get('inpcId')?.valueChanges.subscribe((id: string | null) => {
      this.onInpcSeleccionadoChange(id);
    });
  }

  private rangoFechasPorDefecto(): { inicio: string; fin: string } {
    return {
      inicio: '2026-01-01',
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
    const limit = 300;
    const idPrevio = this.factorForm?.get('inpcId')?.value ?? null;

    this.cargandoInpc = true;
    this.incrementosService.obtenerIncrementosData(1, limit, inicio, fin).subscribe({
      next: (resp) => {
        const lastPage = resp?.paginated?.lastPage ?? 1;
        if (lastPage <= 1) {
          this.finalizarCargarInpc(this.filasDesdeRespuestaInpc(resp), idPrevio);
          return;
        }

        const paginasRestantes = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
        forkJoin(
          paginasRestantes.map((page) =>
            this.incrementosService.obtenerIncrementosData(page, limit, inicio, fin),
          ),
        ).subscribe({
          next: (resto) => {
            const todas = [
              ...this.filasDesdeRespuestaInpc(resp),
              ...resto.flatMap((r) => this.filasDesdeRespuestaInpc(r)),
            ];
            this.finalizarCargarInpc(todas, idPrevio);
          },
          error: () => {
            this.finalizarCargarInpc(this.filasDesdeRespuestaInpc(resp), idPrevio);
          },
        });
      },
      error: () => {
        this.inpcOpciones = [];
        this.cargandoInpc = false;
        this.aplicarFactorPendienteEdicion();
      },
    });
  }

  private filasDesdeRespuestaInpc(
    resp: InpcPaginatedResponse | null | undefined,
  ): InpcOpcionFactor[] {
    return (Array.isArray(resp?.data) ? resp.data : [])
      .map((item) => mapInpcPaginatedItemToRow(item))
      .filter((row): row is InpcPaginatedGridRow => row != null)
      .map((row) => ({
        ...row,
        variable: this.variableDesdeInpc(row),
      }));
  }

  private finalizarCargarInpc(rows: InpcOpcionFactor[], idPrevio: string | null): void {
    this.inpcOpciones = rows.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
    this.cargandoInpc = false;

    if (idPrevio != null && !this.inpcPorId(idPrevio)) {
      this.factorForm.patchValue({ inpcId: null, valor: '' }, { emitEvent: false });
      this.inpcSeleccionado = null;
    }

    this.aplicarFactorPendienteEdicion();
  }

  private variableDesdeInpc(row: InpcPaginatedGridRow): string {
    const mes = mesNumeroANombre(row.mes)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, '_');
    return `INPC_${mes}_${row.anio}`;
  }

  private inpcPorId(id: string | null | undefined): InpcOpcionFactor | null {
    if (id == null || String(id).trim() === '') return null;
    return this.inpcOpciones.find((o) => o.id === id) ?? null;
  }

  onInpcSeleccionadoChange(id: string | null): void {
    const row = this.inpcPorId(id);
    this.inpcSeleccionado = row;
    if (!row) return;

    this.factorForm.patchValue(
      {
        valor: formatValorMilesParaLista(row.inpc),
      },
      { emitEvent: false },
    );
    this.factorForm.get('valor')?.updateValueAndValidity({ emitEvent: false });
  }

  etiquetaOpcionInpc(row: InpcOpcionFactor): string {
    return `${row.fecha}`;
  }

  private aplicarFactorPendienteEdicion(): void {
    const data = this.factorPendienteEdicion;
    if (!data || this.inpcOpciones.length === 0) return;

    const variable = String(data['variable'] ?? data['nombre'] ?? '')
      .trim()
      .toUpperCase();
    const match =
      this.inpcOpciones.find((o) => o.variable === variable) ??
      this.buscarInpcPorValorYDescripcion(data);

    this.factorForm.patchValue(
      {
        inpcId: match?.id ?? null,
        valor: formatValorMilesParaLista(data['valor'] ?? ''),
        descripcion: data['descripcion'] ?? '',
      },
      { emitEvent: false },
    );
    this.inpcSeleccionado = match;
    this.factorForm.markAsPristine();
    this.factorPendienteEdicion = null;
  }

  private buscarInpcPorValorYDescripcion(
    data: Record<string, unknown>,
  ): InpcOpcionFactor | null {
    const valor = parseValorNumerico(data['valor']);
    if (!Number.isFinite(valor)) return null;
    const candidatos = this.inpcOpciones.filter((o) => o.inpc === valor);
    if (candidatos.length === 1) return candidatos[0];
    return null;
  }

  obtenerFactor(): void {
    if (this.idFactor == null) return;
    this.factoresService.obtenerFactor(this.idFactor).subscribe({
      next: (res: any) => {
        const data = (res?.data ?? res ?? {}) as Record<string, unknown>;
        this.factorPendienteEdicion = data;
        this.aplicarFactorPendienteEdicion();
      },
      error: () => {
        Swal.fire({
          title: '¡Ops!',
          text: 'No se pudo cargar el factor.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
    });
  }

  onValorInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const before = input.value;
    const cursor = input.selectionStart ?? before.length;

    // Usar la función que cuenta el punto como símbolo
    const simbolosAntes = contarMontoSimbolosAntesCursor(before, cursor);

    const formatted = formatMilesAlEscribir(before);
    const ctrl = this.factorForm.get('valor');
    ctrl?.setValue(formatted, { emitEvent: false });
    ctrl?.updateValueAndValidity({ emitEvent: false });

    if (input.value !== formatted) {
      input.value = formatted;
    }

    // Usar la función que reposiciona correctamente con el punto
    const newPos = cursorMontoTrasFormato(formatted, simbolosAntes);
    requestAnimationFrame(() => {
      input.setSelectionRange(newPos, newPos);
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
    inpcId: 'INPC',
    valor: 'Valor',
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
    const v = this.factorForm.value;
    const inpc = this.inpcPorId(v.inpcId);
    const desc = (v.descripcion ?? '').toString().trim();
    return {
      variable: inpc?.variable ?? '',
      valor: valorSinComasParaApi(v.valor),
      descripcion: desc.length ? desc : null,
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