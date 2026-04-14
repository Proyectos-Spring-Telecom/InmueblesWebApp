import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { merge, Subscription } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { ContratosService } from 'src/app/services/moduleService/contratos.service';
import { InstalacionService } from 'src/app/services/moduleService/instalaciones.service';
import Swal from 'sweetalert2';

const IVA = 0.16;

function inmueblesRequeridos(
  control: AbstractControl,
): ValidationErrors | null {
  const v = control.value;
  if (Array.isArray(v) && v.length > 0) return null;
  return { inmuebles: true };
}

@Component({
  selector: 'app-agregar-contrato',
  templateUrl: './agregar-contrato.component.html',
  styleUrl: './agregar-contrato.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarContratoComponent implements OnInit, OnDestroy {
  public submitButton = 'Guardar';
  public loading = false;
  public contratoForm!: FormGroup;
  public idContrato?: number;
  public title = 'Agregar Contrato';

  public tiposModificacion = [
    'Por renovación',
    'Por revisión',
    'Por prórroga',
    'Otro',
  ];
  public tiposMoneda = ['Peso (MXN)', 'Dólar (USD)'];
  public mesesCatalogo: { id: number; text: string }[] = Array.from(
    { length: 13 },
    (_, i) => ({
      id: i,
      text: i === 0 ? '0 meses' : `${i} ${i === 1 ? 'mes' : 'meses'}`,
    }),
  );
  public anosForzososCatalogo: { id: number; text: string }[] = [1, 2, 3, 4, 5].map(
    (n) => ({
      id: n,
      text: `${n} ${n === 1 ? 'año' : 'años'}`,
    }),
  );

  /** Misma estructura que en agregar usuario (lista de arrendadores). */
  public listaClientes: any[] = [];
  public listaInmuebles: any[] = [];

  public pdfDragging = false;
  public pdfFileName: string | null = null;
  /** Expuesto para el template (@if … !pdfFile); no usar desde fuera del componente. */
  public pdfFile: File | null = null;
  public documentoExistenteUrl: string | null = null;

  @ViewChild('contratoPdfInput') contratoPdfInput?: ElementRef<HTMLInputElement>;

  private subCalc?: Subscription;

  private etiquetas: Record<string, string> = {
    tipoModificacion: 'Tipo de modificación',
    numeroContrato: 'Contrato',
    idArrendador: 'Arrendador',
    idArrendatario: 'Arrendatario',
    idInmuebles: 'Inmueble(s)',
    fechaInicio: 'Fecha de inicio',
    fechaTermino: 'Fecha de término',
    tipoMoneda: 'Tipo de moneda',
    metrosRentados: 'Metros rentados',
    costoPorM2: 'Costo por m²',
    mesesDeposito: 'Meses de depósito',
    montoDeposito: 'Monto de depósito',
    pctMantenimiento: '% de mantenimiento',
    anosForzososArrendador: 'Años forzosos arrendador',
    anosForzososArrendatario: 'Años forzosos arrendatario',
    mesesAdelanto: 'Meses de adelanto',
    montoAdelanto: 'Monto de adelanto',
    observaciones: 'Observaciones',
  };

  constructor(
    private fb: FormBuilder,
    private contratosService: ContratosService,
    private clientesService: ClientesService,
    private instalacionService: InstalacionService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarCatalogos();

    this.activatedRoute.params.subscribe((params) => {
      const id = params['idContrato'];
      this.idContrato = id ? Number(id) : undefined;
      if (this.idContrato) {
        this.title = 'Actualizar Contrato';
        this.obtenerContrato();
      } else {
        this.title = 'Agregar Contrato';
        this.documentoExistenteUrl = null;
        this.pdfFile = null;
        this.pdfFileName = null;
        this.resetFormAlta();
      }
    });

    this.subCalc = merge(
      this.contratoForm.get('metrosRentados')!.valueChanges,
      this.contratoForm.get('costoPorM2')!.valueChanges,
      this.contratoForm.get('pctMantenimiento')!.valueChanges,
    ).subscribe(() => this.recalcularMontos());
    this.recalcularMontos();
  }

  ngOnDestroy(): void {
    this.subCalc?.unsubscribe();
  }

  /** Alta: formulario limpio; inmuebles sin selección (evita arrastre al reutilizar la ruta). */
  private resetFormAlta(): void {
    if (!this.contratoForm) return;
    this.contratoForm.reset({
      tipoModificacion: null,
      numeroContrato: '',
      idArrendador: null,
      idArrendatario: null,
      idInmuebles: [],
      fechaInicio: null,
      fechaTermino: null,
      tipoMoneda: null,
      metrosRentados: null,
      costoPorM2: null,
      mesesDeposito: null,
      montoDeposito: null,
      pctMantenimiento: null,
      anosForzososArrendador: null,
      anosForzososArrendatario: null,
      mesesAdelanto: null,
      montoAdelanto: null,
      observaciones: '',
    });
    this.recalcularMontos();
    this.contratoForm.markAsPristine();
    this.contratoForm.markAsUntouched();
  }

  private initForm(): void {
    this.contratoForm = this.fb.group({
      tipoModificacion: [null as string | null, Validators.required],
      numeroContrato: ['', Validators.required],
      idArrendador: [null as number | null, Validators.required],
      idArrendatario: [null as number | null, Validators.required],
      idInmuebles: [[], [Validators.required, inmueblesRequeridos]],
      fechaInicio: [null as string | null, Validators.required],
      fechaTermino: [null as string | null, Validators.required],
      tipoMoneda: [null as string | null, Validators.required],
      metrosRentados: [null as number | null, [Validators.required, Validators.min(0)]],
      costoPorM2: [null as number | null, [Validators.required, Validators.min(0)]],
      mesesDeposito: [null as number | null, Validators.required],
      montoDeposito: [null as number | null, [Validators.required, Validators.min(0)]],
      pctMantenimiento: [
        null as number | null,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      anosForzososArrendador: [null as number | null, Validators.required],
      anosForzososArrendatario: [null as number | null, Validators.required],
      mesesAdelanto: [null as number | null, Validators.required],
      montoAdelanto: [null as number | null, [Validators.required, Validators.min(0)]],
      observaciones: ['', Validators.required],
      subtotalRenta: [{ value: 0, disabled: true }],
      ivaRenta: [{ value: 0, disabled: true }],
      rentaTotal: [{ value: 0, disabled: true }],
      subtotalMantenimiento: [{ value: 0, disabled: true }],
      ivaMantenimiento: [{ value: 0, disabled: true }],
      mantenimientoTotal: [{ value: 0, disabled: true }],
    });
  }

  private cargarCatalogos(): void {
    this.clientesService.obtenerClientes().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];
      this.listaClientes = Array.isArray(rows) ? rows : [];
    });
    this.instalacionService.obtenerInstalaciones().subscribe((res: any) => {
      const rows = res?.data ?? res ?? [];
      this.listaInmuebles = Array.isArray(rows) ? rows : [];
    });
  }

  /** Valor para input type="date" (yyyy-MM-dd). */
  private toDateInputValue(v: unknown): string | null {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(String(v));
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private parseIds(raw: unknown): number[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) {
      return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }
    if (typeof raw === 'string') {
      try {
        return this.parseIds(JSON.parse(raw));
      } catch {
        return raw
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n));
      }
    }
    return [];
  }

  obtenerContrato(): void {
    if (!this.idContrato) return;
    this.contratosService.obtenerContrato(this.idContrato).subscribe({
      next: (res: any) => {
        const d = res?.data ?? res ?? {};
        this.documentoExistenteUrl = d.documentoUrl ?? null;
        this.pdfFile = null;
        this.pdfFileName = this.documentoExistenteUrl
          ? 'Documento registrado'
          : null;
        this.contratoForm.patchValue(
          {
            tipoModificacion: d.tipoModificacion ?? null,
            numeroContrato: d.numeroContrato ?? '',
            idArrendador:
              d.idArrendador != null ? Number(d.idArrendador) : null,
            idArrendatario:
              d.idArrendatario != null ? Number(d.idArrendatario) : null,
            idInmuebles: this.parseIds(d.idInmuebles ?? d.idsInmuebles),
            fechaInicio: this.toDateInputValue(d.fechaInicio),
            fechaTermino: this.toDateInputValue(d.fechaTermino),
            tipoMoneda: d.tipoMoneda ?? null,
            metrosRentados:
              d.metrosRentados != null ? Number(d.metrosRentados) : null,
            costoPorM2: d.costoPorM2 != null ? Number(d.costoPorM2) : null,
            mesesDeposito:
              d.mesesDeposito != null ? Number(d.mesesDeposito) : null,
            montoDeposito:
              d.montoDeposito != null ? Number(d.montoDeposito) : null,
            pctMantenimiento:
              d.pctMantenimiento != null ? Number(d.pctMantenimiento) : null,
            anosForzososArrendador:
              d.anosForzososArrendador != null
                ? Number(d.anosForzososArrendador)
                : null,
            anosForzososArrendatario:
              d.anosForzososArrendatario != null
                ? Number(d.anosForzososArrendatario)
                : null,
            mesesAdelanto:
              d.mesesAdelanto != null ? Number(d.mesesAdelanto) : null,
            montoAdelanto:
              d.montoAdelanto != null ? Number(d.montoAdelanto) : null,
            observaciones: d.observaciones ?? '',
          },
          { emitEvent: false },
        );
        this.recalcularMontos();
        this.contratoForm.markAsPristine();
      },
    });
  }

  recalcularMontos(): void {
    const m = Number(this.contratoForm.get('metrosRentados')?.value) || 0;
    const c = Number(this.contratoForm.get('costoPorM2')?.value) || 0;
    const p = Number(this.contratoForm.get('pctMantenimiento')?.value) || 0;
    const subR = m * c;
    const ivaR = subR * IVA;
    const totR = subR + ivaR;
    const subM = subR * (p / 100);
    const ivaM = subM * IVA;
    const totM = subM + ivaM;
    this.contratoForm.patchValue(
      {
        subtotalRenta: Math.round(subR * 1e6) / 1e6,
        ivaRenta: Math.round(ivaR * 1e6) / 1e6,
        rentaTotal: Math.round(totR * 1e6) / 1e6,
        subtotalMantenimiento: Math.round(subM * 1e6) / 1e6,
        ivaMantenimiento: Math.round(ivaM * 1e6) / 1e6,
        mantenimientoTotal: Math.round(totM * 1e6) / 1e6,
      },
      { emitEvent: false },
    );
  }

  onPdfSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Formato',
        text: 'Solo se permiten archivos PDF.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
      });
      input.value = '';
      return;
    }
    this.pdfFile = file;
    this.pdfFileName = file.name;
    input.value = '';
  }

  onPdfDragOver(e: DragEvent): void {
    e.preventDefault();
    this.pdfDragging = true;
  }

  onPdfDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.pdfDragging = false;
  }

  onPdfDrop(e: DragEvent): void {
    e.preventDefault();
    this.pdfDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Formato',
        text: 'Solo se permiten archivos PDF.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    this.pdfFile = file;
    this.pdfFileName = file.name;
  }

  openContratoPdfPicker(): void {
    this.contratoPdfInput?.nativeElement?.click();
  }

  private documentoValido(): boolean {
    if (this.pdfFile) return true;
    if (this.idContrato && this.documentoExistenteUrl) return true;
    return false;
  }

  submit(): void {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idContrato) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private mostrarErroresValidacion(esActualizar: boolean): void {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;
    const faltantes: string[] = [];
    Object.keys(this.contratoForm.controls).forEach((key) => {
      const control = this.contratoForm.get(key);
      if (control?.disabled) return;
      if (control?.invalid) {
        faltantes.push(this.etiquetas[key] || key);
      }
    });
    if (!this.documentoValido()) {
      faltantes.push('Documento (PDF)');
    }
    const lista = faltantes
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

  private appendFormData(fd: FormData): void {
    const v = this.contratoForm.getRawValue();
    fd.append('tipoModificacion', String(v.tipoModificacion ?? ''));
    fd.append('numeroContrato', String(v.numeroContrato ?? ''));
    fd.append('idArrendador', String(v.idArrendador ?? ''));
    fd.append('idArrendatario', String(v.idArrendatario ?? ''));
    fd.append('idInmuebles', JSON.stringify(v.idInmuebles ?? []));
    const fi = v.fechaInicio as string | null | undefined;
    const ft = v.fechaTermino as string | null | undefined;
    if (fi) {
      fd.append(
        'fechaInicio',
        new Date(fi + 'T12:00:00').toISOString(),
      );
    }
    if (ft) {
      fd.append(
        'fechaTermino',
        new Date(ft + 'T12:00:00').toISOString(),
      );
    }
    fd.append('tipoMoneda', String(v.tipoMoneda ?? ''));
    fd.append('metrosRentados', String(v.metrosRentados ?? ''));
    fd.append('costoPorM2', String(v.costoPorM2 ?? ''));
    fd.append('mesesDeposito', String(v.mesesDeposito ?? ''));
    fd.append('montoDeposito', String(v.montoDeposito ?? ''));
    fd.append('pctMantenimiento', String(v.pctMantenimiento ?? ''));
    fd.append(
      'anosForzososArrendador',
      String(v.anosForzososArrendador ?? ''),
    );
    fd.append(
      'anosForzososArrendatario',
      String(v.anosForzososArrendatario ?? ''),
    );
    fd.append('mesesAdelanto', String(v.mesesAdelanto ?? ''));
    fd.append('montoAdelanto', String(v.montoAdelanto ?? ''));
    fd.append('observaciones', String(v.observaciones ?? ''));
    fd.append('subtotalRenta', String(v.subtotalRenta ?? 0));
    fd.append('ivaRenta', String(v.ivaRenta ?? 0));
    fd.append('rentaTotal', String(v.rentaTotal ?? 0));
    fd.append('subtotalMantenimiento', String(v.subtotalMantenimiento ?? 0));
    fd.append('ivaMantenimiento', String(v.ivaMantenimiento ?? 0));
    fd.append('mantenimientoTotal', String(v.mantenimientoTotal ?? 0));
    if (this.pdfFile) {
      fd.append('documento', this.pdfFile, this.pdfFile.name);
    }
  }

  agregar(): void {
    if (this.contratoForm.invalid || !this.documentoValido()) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const fd = new FormData();
    this.appendFormData(fd);
    this.contratosService.agregarContrato(fd).subscribe({
      next: () => {
        this.loading = false;
        this.submitButton = 'Guardar';
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó el contrato de manera exitosa.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: () => {
        this.loading = false;
        this.submitButton = 'Guardar';
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al agregar el contrato.`,
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
    if (!this.idContrato) return;
    if (this.contratoForm.invalid || !this.documentoValido()) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const fd = new FormData();
    this.appendFormData(fd);
    this.contratosService.actualizarContrato(this.idContrato, fd).subscribe({
      next: () => {
        this.loading = false;
        this.submitButton = 'Actualizar';
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos del contrato se actualizaron correctamente.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: () => {
        this.loading = false;
        this.submitButton = 'Actualizar';
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al actualizar el contrato.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  regresar(): void {
    this.router.navigateByUrl('/contratos');
  }
}
