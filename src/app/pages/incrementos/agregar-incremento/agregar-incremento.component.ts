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
import {
  IncrementoPayload,
  IncrementosService,
} from 'src/app/services/moduleService/incrementos.service';
import Swal from 'sweetalert2';
import {
  mapInpcApiItemToRow,
  MESES_INPC,
  mesNombreANumero,
} from '../inpc-historico.data';
import {
  countDigitosAntesCursor,
  cursorPosicionTrasFormatoMiles,
  formatMilesAlEscribir,
  formatMilesDesdeNumero,
  parseValorNumerico,
} from 'src/app/shared/valor-miles-format';

const valorInpcValidador: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const raw = String(c.value ?? '').trim();
  if (!raw) return { required: true };
  const n = parseValorNumerico(raw);
  if (!Number.isFinite(n) || n < 0) return { min: true };
  return null;
};

/** Año: exactamente 4 dígitos y entre 1990 y 2040 (el valor del control es string). */
const anioCuatroDigitosValidador: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const s = String(c.value ?? '').trim();
  if (!/^\d{4}$/.test(s)) return { pattern: true };
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1990 || n > 2040) return { anioFueraRango: true };
  return null;
};

@Component({
  selector: 'app-agregar-incremento',
  templateUrl: './agregar-incremento.component.html',
  styleUrl: './agregar-incremento.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarIncrementoComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public incrementoForm: FormGroup;
  public idIncremento: number | null = null;
  public title = 'Agregar INPC';
  readonly mesesOpciones = [...MESES_INPC];

  constructor(
    private fb: FormBuilder,
    private incrementosService: IncrementosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      const raw = params['idIncremento'];
      const idn = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
      this.idIncremento = Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
      if (this.idIncremento != null) {
        this.title = 'Actualizar INPC';
        this.obtenerIncremento();
      } else {
        this.title = 'Agregar INPC';
      }
    });
  }

  obtenerIncremento() {
    if (this.idIncremento == null) return;

    this.incrementosService.obtenerIncremento(this.idIncremento).subscribe({
      next: (res: any) => {
        const raw = res?.data ?? res ?? {};
        const row = mapInpcApiItemToRow(raw);
        this.incrementoForm.patchValue(
          {
            anio: String(row.anio || new Date().getFullYear()).replace(/\D/g, '').slice(0, 4),
            mes: row.mes || '',
            valorInpc: formatMilesDesdeNumero(row.valorInpc),
          },
          { emitEvent: false },
        );
        this.incrementoForm.markAsPristine();
      },
      error: () => {
        Swal.fire({
          title: '¡Ops!',
          text: `No se pudo cargar el registro de INPC.`,
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

  initForm() {
    this.incrementoForm = this.fb.group({
      anio: [
        String(new Date().getFullYear()),
        [Validators.required, anioCuatroDigitosValidador],
      ],
      mes: ['', Validators.required],
      valorInpc: ['', [Validators.required, valorInpcValidador]],
    });
  }

  onAnioInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const solo = input.value.replace(/\D/g, '').slice(0, 4);
    const ctrl = this.incrementoForm.get('anio');
    ctrl?.setValue(solo, { emitEvent: false });
    ctrl?.updateValueAndValidity({ emitEvent: false });
    if (input.value !== solo) {
      input.value = solo;
    }
  }

  onValorInpcInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const before = input.value;
    const cursor = input.selectionStart ?? before.length;
    const digitsBefore = countDigitosAntesCursor(before, cursor);

    const formatted = formatMilesAlEscribir(before);
    const ctrl = this.incrementoForm.get('valorInpc');
    ctrl?.setValue(formatted, { emitEvent: false });
    ctrl?.updateValueAndValidity({ emitEvent: false });

    if (input.value !== formatted) {
      input.value = formatted;
    }

    const newPos = cursorPosicionTrasFormatoMiles(formatted, digitsBefore);
    requestAnimationFrame(() => {
      input.setSelectionRange(newPos, newPos);
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idIncremento != null) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private etiquetas: Record<string, string> = {
    anio: 'Año',
    mes: 'Mes',
    valorInpc: 'INPC',
  };

  private mostrarErroresValidacion(esActualizar: boolean) {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;
    const camposFaltantes: string[] = [];
    Object.keys(this.incrementoForm.controls).forEach((key) => {
      const control = this.incrementoForm.get(key);
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
      customClass: {
        popup: 'swal2-padding swal2-border',
      },
    });
  }

  private buildPayload(): IncrementoPayload {
    const v = this.incrementoForm.value;
    const anio = Number(String(v.anio ?? '').replace(/\D/g, '').slice(0, 4));
    const mesNombre = (v.mes ?? '').toString().trim();
    const valor = parseValorNumerico(v.valorInpc);
    const mesNum = mesNombreANumero(mesNombre);
    return {
      anio,
      mes: mesNum,
      inpc: Number.isFinite(valor) ? valor : 0,
    };
  }

  agregar() {
    if (this.incrementoForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = this.buildPayload();
    this.incrementosService.agregarIncremento(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación exitosa!',
          text: `Se agregó un nuevo registro de INPC de manera exitosa.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al agregar el registro de INPC.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  actualizar() {
    if (this.idIncremento == null) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      return;
    }
    if (this.incrementoForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = this.buildPayload();
    this.incrementosService.actualizarIncremento(this.idIncremento, payload).subscribe({
      next: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación exitosa!',
          text: `Los datos del registro de INPC se actualizaron correctamente.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al actualizar el registro de INPC.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  regresar() {
    this.route.navigateByUrl('/incrementos');
  }
}
