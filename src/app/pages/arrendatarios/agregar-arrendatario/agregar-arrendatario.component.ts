import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ARRENDATARIOS_FORM_DEMO } from '../arrendatarios-demo.data';

@Component({
  selector: 'app-agregar-arrendatario',
  templateUrl: './agregar-arrendatario.component.html',
  styleUrl: './agregar-arrendatario.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarArrendatarioComponent implements OnInit {
  public title = 'Agregar Arrendatario';
  public submitButton: string = 'Guardar';
  public arrendatarioForm: FormGroup;
  public idArrendatario: number;
  archivoEscrituraNombre: string | null = null;
  imagenLicenciaNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  galeriaImagen1Nombre: string | null = null;
  galeriaImagen2Nombre: string | null = null;

  @ViewChild('archivoEscrituraInput') archivoEscrituraInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imagenLicenciaInput') imagenLicenciaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imagenPlanoInput') imagenPlanoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('galeriaImagen1Input') galeriaImagen1Input!: ElementRef<HTMLInputElement>;
  @ViewChild('galeriaImagen2Input') galeriaImagen2Input!: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRoute.params.subscribe((params) => {
      this.idArrendatario = Number(params['idArrendatario']);
      if (this.idArrendatario) {
        this.title = 'Actualizar Arrendatario';
        this.submitButton = 'Actualizar';
        this.cargarDemoEdicion(this.idArrendatario);
      }
    });
  }

  private initForm(): void {
    this.arrendatarioForm = this.fb.group({
      nombreInmueble: ['', Validators.required],
      rentaMxn: ['', Validators.required],
      direccionInmueble: ['', Validators.required],
      vigenciaAnios: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      arrendador: ['', Validators.required],
      tiempoRentaAnios: ['', Validators.required],
      estatusInmueble: ['', Validators.required],
      documentoEscritura: [null],
      documentoLicencia: [null],
      documentoPlano: [null],
      galeriaImagen1: [null],
      galeriaImagen2: [null],
      servicioAguaContrato: [''],
      servicioLuzContrato: [''],
      servicioMantenimientoContrato: [''],
      zonaPrincipal: [''],
      zonaSuperficieM2: [''],
      superficieDisponiblePredioM2: [''],
      estacionamientoPensionado: [''],
      estacionamientoTarjeta: [''],
      estacionamientoArrendatario: [''],
      pagoConcepto: [''],
      pagoFecha: [''],
      pagoMonto: [''],
      vigenciaDocumento: [''],
      vigenciaDiasRestantes: [''],
      vigenciaEstatus: [''],
      locales: this.fb.array([this.crearLocalFormGroup()]),
    });
  }

  private crearLocalFormGroup(): FormGroup {
    return this.fb.group({
      nombreLocal: ['', Validators.required],
      estadoLocal: [''],
      mensualidadLocalMxn: [''],
      zonaLocal: [''],
      ocupanteLocal: [''],
      giroLocal: [''],
      medidaLocal: [''],
      contratoHastaLocal: [''],
      archivoContratoLocal: [''],
      numeroContratoLocal: [''],
      tipoModificacionContratoLocal: [''],
      arrendadorLocal: [''],
      arrendatarioLocal: [''],
      fechaInicioContratoLocal: [''],
      fechaTerminoContratoLocal: [''],
      tipoMonedaLocal: [''],
      metrosRentadosLocal: [''],
      costoPorM2Local: [''],
      pctMantenimientoLocal: [''],
      mesesDepositoLocal: [''],
      montoDepositoLocal: [''],
      mesesAdelantoLocal: [''],
      montoAdelantoLocal: [''],
      anosForzososArrendadorLocal: [''],
      anosForzososArrendatarioLocal: [''],
      subtotalRentaLocal: [''],
      ivaRentaLocal: [''],
      rentaTotalLocal: [''],
      subtotalMantenimientoLocal: [''],
      ivaMantenimientoLocal: [''],
      mantenimientoTotalLocal: [''],
      observacionesContratoLocal: [''],
    });
  }

  get localesFormArray(): FormArray {
    return this.arrendatarioForm.get('locales') as FormArray;
  }

  agregarLocal(): void {
    this.localesFormArray.push(this.crearLocalFormGroup());
  }

  eliminarLocal(index: number): void {
    if (this.localesFormArray.length === 1) return;
    this.localesFormArray.removeAt(index);
  }

  abrirSelectorArchivo(ref: 'escritura' | 'licencia' | 'plano' | 'gal1' | 'gal2'): void {
    const map = {
      escritura: this.archivoEscrituraInput,
      licencia: this.imagenLicenciaInput,
      plano: this.imagenPlanoInput,
      gal1: this.galeriaImagen1Input,
      gal2: this.galeriaImagen2Input,
    };
    map[ref]?.nativeElement?.click();
  }

  onFileSelected(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.arrendatarioForm.get(controlName)?.setValue(file);

    const name = file?.name ?? null;
    if (controlName === 'documentoEscritura') this.archivoEscrituraNombre = name;
    if (controlName === 'documentoLicencia') this.imagenLicenciaNombre = name;
    if (controlName === 'documentoPlano') this.imagenPlanoNombre = name;
    if (controlName === 'galeriaImagen1') this.galeriaImagen1Nombre = name;
    if (controlName === 'galeriaImagen2') this.galeriaImagen2Nombre = name;
  }

  private cargarDemoEdicion(id: number): void {
    const registro = ARRENDATARIOS_FORM_DEMO.find((item) => item.id === id);
    if (!registro) return;
    this.arrendatarioForm.patchValue(
      {
        nombreInmueble: registro.locales?.[0]?.nombreInmueble ?? '',
        rentaMxn: registro.locales?.[0]?.mensualidadMxn ?? '',
        direccionInmueble: '',
        vigenciaAnios: '',
        fechaInicio: registro.locales?.[0]?.fechaInicio ?? '',
        fechaFin: registro.locales?.[0]?.fechaTermino ?? '',
        arrendador: registro.arrendador,
        tiempoRentaAnios: '',
        estatusInmueble: '',
      },
      { emitEvent: false },
    );

    const localDemo = registro.locales?.[0];
    if (localDemo) {
      this.localesFormArray.clear();
      this.localesFormArray.push(
        this.fb.group({
          nombreLocal: [localDemo.nombreLocal ?? ''],
          estadoLocal: [''],
          mensualidadLocalMxn: [localDemo.mensualidadMxn ?? ''],
          zonaLocal: [localDemo.nivel ?? ''],
          ocupanteLocal: [registro.nombreComercial ?? ''],
          giroLocal: [''],
          medidaLocal: [localDemo.superficieM2 ? `${localDemo.superficieM2} m²` : ''],
          contratoHastaLocal: [localDemo.fechaTermino ?? ''],
          archivoContratoLocal: [''],
          numeroContratoLocal: [''],
          tipoModificacionContratoLocal: [''],
          arrendadorLocal: [registro.arrendador ?? ''],
          arrendatarioLocal: [registro.nombreComercial ?? ''],
          fechaInicioContratoLocal: [localDemo.fechaInicio ?? ''],
          fechaTerminoContratoLocal: [localDemo.fechaTermino ?? ''],
          tipoMonedaLocal: [''],
          metrosRentadosLocal: [localDemo.superficieM2 ?? ''],
          costoPorM2Local: [''],
          pctMantenimientoLocal: [''],
          mesesDepositoLocal: [''],
          montoDepositoLocal: [''],
          mesesAdelantoLocal: [''],
          montoAdelantoLocal: [''],
          anosForzososArrendadorLocal: [''],
          anosForzososArrendatarioLocal: [''],
          subtotalRentaLocal: [''],
          ivaRentaLocal: [''],
          rentaTotalLocal: [''],
          subtotalMantenimientoLocal: [''],
          ivaMantenimientoLocal: [''],
          mantenimientoTotalLocal: [''],
          observacionesContratoLocal: [''],
        }),
      );
    }
  }

  submit(): void {
    if (this.arrendatarioForm.invalid) {
      this.arrendatarioForm.markAllAsTouched();
      Swal.fire({
        title: '¡Revise el formulario!',
        text: 'Complete todos los campos requeridos del inmueble.',
        icon: 'error',
        confirmButtonColor: '#3085d6',
        background: '#141a21',
        color: '#ffffff',
      });
      return;
    }

    Swal.fire({
      title: '¡Operación Exitosa!',
      text: this.idArrendatario
        ? 'El inmueble se actualizó correctamente.'
        : 'Se agregó la información del inmueble correctamente.',
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
      background: '#141a21',
      color: '#ffffff',
    });
    this.regresar();
  }

  regresar(): void {
    this.router.navigateByUrl('/arrendatarios');
  }
}
