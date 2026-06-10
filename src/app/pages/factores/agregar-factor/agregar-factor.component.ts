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

  constructor(
    private fb: FormBuilder,
    private factoresService: FactoresService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) { }

  ngOnInit(): void {
    this.initForm();
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
      variable: ['', [Validators.required]],
      valor: ['', [Validators.required, factorValorValidador]],
      descripcion: ['', [Validators.maxLength(2000)]],
    });

    // Forzar mayúsculas en variable al escribir
    this.factorForm.get('variable')?.valueChanges.subscribe((val: string) => {
      const upper = (val ?? '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
      if (upper !== val) {
        this.factorForm.get('variable')?.setValue(upper, { emitEvent: false });
      }
    });
  }

  obtenerFactor(): void {
    if (this.idFactor == null) return;
    this.factoresService.obtenerFactor(this.idFactor).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? {};
        this.factorForm.patchValue(
          {
            variable: data?.variable ?? data?.nombre ?? '',
            valor: formatValorMilesParaLista(data?.valor ?? ''),
            descripcion: data?.descripcion ?? '',
          },
          { emitEvent: false },
        );
        this.factorForm.markAsPristine();
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
    variable: 'Nombre de la variable',
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
    const desc = (v.descripcion ?? '').toString().trim();
    return {
      variable: (v.variable ?? '').trim().toUpperCase(),
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