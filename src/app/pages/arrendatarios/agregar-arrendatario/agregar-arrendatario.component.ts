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
  contratoRentaNombre: string | null = null;
  constanciaFiscalNombre: string | null = null;
  constanciaRepLegalNombre: string | null = null;
  comprobanteDomicilioNombre: string | null = null;
  actaConstitutivaNombre: string | null = null;
  ineRepresentanteNombre: string | null = null;

  @ViewChild('archivoEscrituraInput') archivoEscrituraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenLicenciaInput') imagenLicenciaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenPlanoInput') imagenPlanoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('contratoRentaInput') contratoRentaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaFiscalInput') constanciaFiscalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaRepLegalInput') constanciaRepLegalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('comprobanteDomicilioInput') comprobanteDomicilioInput?: ElementRef<HTMLInputElement>;
  @ViewChild('actaConstitutivaInput') actaConstitutivaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('ineRepresentanteInput') ineRepresentanteInput?: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    const stateData = history.state?.arrendatario;
    if (stateData && stateData.idLocal) {
      this.idArrendatario = Number(stateData.idLocal);
      this.title = 'Actualizar Arrendatario';
      this.submitButton = 'Actualizar';
      this.cargarDesdeGrid(stateData);
      return;
    }
    this.activatedRoute.params.subscribe((params) => {
      this.idArrendatario = Number(params['id'] ?? params['idArrendatario']);
      if (this.idArrendatario) {
        this.title = 'Actualizar Arrendatario';
        this.submitButton = 'Actualizar';
        this.cargarDemoEdicion(this.idArrendatario);
      }
    });
  }

  private defaultServicioTipoForIndex(index: number): string | null {
    if (index === 0) return 'RENTA';
    if (index === 1) return 'MANTENIMIENTO';
    return null;
  }

  private initForm(): void {
    this.arrendatarioForm = this.fb.group({
      nombreInmueble: ['', Validators.required],
      tipoPersona: [null, Validators.required],
      rentaMxn: ['', Validators.required],
      direccionInmueble: ['', Validators.required],
      vigenciaAnios: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      arrendador: ['', Validators.required],
      tiempoRentaAnios: ['', Validators.required],
      estatusInmueble: ['', Validators.required],
      nombreRepresentanteLegal: ['', Validators.required],
      telefonoRepresentanteLegal: ['', Validators.required],
      correoRepresentanteLegal: ['', [Validators.required, Validators.email]],
      inmuebles: [''],
      fechaInicioContrato: [''],
      fechaTerminoContrato: [''],
      tipoMoneda: ['MXN'],
      metrosRentados: [''],
      costoPorM2: [''],
      pctMantenimiento: [''],
      mesesDeposito: [''],
      montoDeposito: [''],
      mesesAdelanto: [''],
      montoAdelanto: [''],
      anosForzososArrendador: [''],
      anosForzososArrendatario: [''],
      subtotalRenta: [''],
      ivaRenta: [''],
      rentaTotal: [''],
      subtotalMantenimiento: [''],
      ivaMantenimiento: [''],
      mantenimientoTotal: [''],
      observaciones: [''],
      documentoEscritura: [null],
      documentoLicencia: [null],
      documentoPlano: [null],
      documentoContratoRenta: [null],
      documentoConstanciaFiscal: [null],
      documentoCurp: [null],
      constanciaSituacionFiscalRepresentanteLegal: [null],
      documentoComprobanteDomicilio: [null],
      documentoEstadoCuentaBancario: [null],
      documentoActaConstitutiva: [null],
      ineRepresentanteLegal: [null],
      galeriaImagenes: this.fb.array([this.crearGaleriaImagenFormGroup()]),
      servicios: this.fb.array([
        this.crearServicioFormGroup('RENTA', true),
        this.crearServicioFormGroup('MANTENIMIENTO', true),
      ]),
      zonas: this.fb.array([this.crearZonaFormGroup()]),
      estacionamientos: this.fb.array([this.crearEstacionamientoFormGroup()]),
      socios: this.fb.array([this.crearSocioFormGroup()]),
      locales: this.fb.array([this.crearLocalFormGroup()]),
    });
  }

  onTipoPersonaChange(_event: Event): void {
    const raw = this.arrendatarioForm.get('tipoPersona')?.value;
    const value =
      raw === null || raw === undefined || raw === ''
        ? null
        : Number(raw);

    this.arrendatarioForm.get('tipoPersona')?.setValue(value, { emitEvent: false });
  }

  esPersonaFisica(): boolean {
    return Number(this.arrendatarioForm?.get('tipoPersona')?.value) === 1;
  }

  esPersonaMoral(): boolean {
    return Number(this.arrendatarioForm?.get('tipoPersona')?.value) === 2;
  }

  private crearSocioFormGroup(): FormGroup {
    return this.fb.group({
      nombreSocio: ['', Validators.required],
      rfcSocio: [null],
      socioConstanciaSituacionFiscal: [null],
      socioConstanciaSituacionFiscalNombre: [''],
      socioComprobanteDomicilio: [null],
      socioComprobanteDomicilioNombre: [''],
      socioActaConstitutiva: [null],
      socioActaConstitutivaNombre: [''],
    });
  }

  private crearGaleriaImagenFormGroup(): FormGroup {
    return this.fb.group({
      archivo: [null],
      nombre: [''],
    });
  }

  private crearServicioFormGroup(tipo: string = '', lockTipoContrato: boolean = false): FormGroup {
    return this.fb.group({
      servicioTipoContrato: [{ value: tipo, disabled: lockTipoContrato }],
      servicioTipoContratoOtro: [''],
      servicioNumeroContrato: [''],
      servicioFechaPago: [''],
      servicioUltimoDiaPago: [''],
      servicioComprobantePago: [null],
      servicioComprobantePagoNombre: [''],
    });
  }

  private crearZonaFormGroup(): FormGroup {
    return this.fb.group({
      zonaPrincipal: [''],
      zonaSuperficieM2: [''],
      superficieDisponiblePredioM2: [''],
    });
  }

  private crearEstacionamientoFormGroup(): FormGroup {
    return this.fb.group({
      estacionamientoPensionado: [''],
      estacionamientoTarjeta: [''],
      estacionamientoArrendatario: [''],
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

  get galeriaImagenesFormArray(): FormArray {
    return this.arrendatarioForm.get('galeriaImagenes') as FormArray;
  }

  galeriaGrupo(index: number): FormGroup {
    return this.galeriaImagenesFormArray.at(index) as FormGroup;
  }

  get serviciosFormArray(): FormArray {
    return this.arrendatarioForm.get('servicios') as FormArray;
  }

  get zonasFormArray(): FormArray {
    return this.arrendatarioForm.get('zonas') as FormArray;
  }

  get estacionamientosFormArray(): FormArray {
    return this.arrendatarioForm.get('estacionamientos') as FormArray;
  }

  get sociosFormArray(): FormArray {
    return this.arrendatarioForm.get('socios') as FormArray;
  }

  get primerNombreSocio(): string {
    const raw = this.sociosFormArray?.at(0)?.get('nombreSocio')?.value;
    if (raw == null) return '';
    return String(raw).trim();
  }

  nombreSocioEnIndice(index: number): string {
    const raw = this.sociosFormArray?.at(index)?.get('nombreSocio')?.value;
    if (raw == null) return '';
    return String(raw).trim();
  }

  agregarSocio(): void {
    this.sociosFormArray.push(this.crearSocioFormGroup());
  }

  eliminarSocio(index: number): void {
    if (this.sociosFormArray.length === 1) return;
    this.sociosFormArray.removeAt(index);
  }

  openSocioFilePicker(input: HTMLInputElement): void {
    input.click();
  }

  onSocioFileSelected(
    event: Event,
    index: number,
    field:
      | 'socioConstanciaSituacionFiscal'
      | 'socioComprobanteDomicilio'
      | 'socioActaConstitutiva',
    nameField:
      | 'socioConstanciaSituacionFiscalNombre'
      | 'socioComprobanteDomicilioNombre'
      | 'socioActaConstitutivaNombre',
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.sociosFormArray.at(index) as FormGroup;
    group.patchValue({
      [field]: file,
      [nameField]: file?.name ?? '',
    });
    if (input) input.value = '';
  }

  abrirModalMapa(): void {
    Swal.fire({
      title: 'Ubicación del local',
      text: 'Activa el selector de mapa en el siguiente paso.',
      icon: 'info',
      confirmButtonColor: '#3085d6',
      background: '#141a21',
      color: '#ffffff',
    });
  }

  agregarServicio(): void {
    this.serviciosFormArray.push(this.crearServicioFormGroup());
  }

  esServicioTipoOtro(index: number): boolean {
    const group = this.serviciosFormArray.at(index) as FormGroup | null;
    const raw = group?.get('servicioTipoContrato')?.value;
    return String(raw ?? '').toUpperCase().trim() === 'OTRO';
  }

  onServicioTipoContratoChange(index: number): void {
    const group = this.serviciosFormArray.at(index) as FormGroup | null;
    if (!group) return;
    if (index < 2) {
      const tipo = this.defaultServicioTipoForIndex(index);
      if (tipo) {
        group.patchValue({ servicioTipoContrato: tipo, servicioTipoContratoOtro: '' }, { emitEvent: false });
        group.get('servicioTipoContrato')?.disable({ emitEvent: false });
      }
      return;
    }
    if (this.esServicioTipoOtro(index)) return;
    group.patchValue({ servicioTipoContratoOtro: '' }, { emitEvent: false });
  }

  resetServicioTipoContrato(index: number): void {
    const group = this.serviciosFormArray.at(index) as FormGroup | null;
    if (!group) return;
    if (index < 2) return;
    group.patchValue(
      { servicioTipoContrato: '', servicioTipoContratoOtro: '' },
      { emitEvent: false },
    );
  }

  eliminarServicio(index: number): void {
    if (index < 2) return;
    if (this.serviciosFormArray.length <= 2) return;
    this.serviciosFormArray.removeAt(index);
  }

  agregarZona(): void {
    this.zonasFormArray.push(this.crearZonaFormGroup());
  }

  eliminarZona(index: number): void {
    if (this.zonasFormArray.length === 1) return;
    this.zonasFormArray.removeAt(index);
  }

  agregarEstacionamiento(): void {
    this.estacionamientosFormArray.push(this.crearEstacionamientoFormGroup());
  }

  eliminarEstacionamiento(index: number): void {
    if (this.estacionamientosFormArray.length === 1) return;
    this.estacionamientosFormArray.removeAt(index);
  }

  onServicioPagoFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.serviciosFormArray.at(index) as FormGroup;
    group.patchValue({
      servicioComprobantePago: file,
      servicioComprobantePagoNombre: file?.name ?? '',
    });
    if (input) input.value = '';
  }

  agregarFotoGaleria(): void {
    this.galeriaImagenesFormArray.push(this.crearGaleriaImagenFormGroup());
  }

  eliminarFotoGaleria(index: number): void {
    if (this.galeriaImagenesFormArray.length === 1) return;
    this.galeriaImagenesFormArray.removeAt(index);
  }

  abrirSelectorGaleria(input: HTMLInputElement): void {
    input.click();
  }

  onGaleriaFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const galeriaGroup = this.galeriaImagenesFormArray.at(index) as FormGroup;
    galeriaGroup.patchValue({
      archivo: file,
      nombre: file?.name ?? '',
    });
  }

  abrirSelectorArchivo(
    ref:
      | 'escritura'
      | 'licencia'
      | 'plano'
      | 'contratoRenta'
      | 'constanciaFiscal'
      | 'constanciaRepLegal'
      | 'comprobanteDomicilio'
      | 'actaConstitutiva'
      | 'ineRepresentante',
  ): void {
    const map = {
      escritura: this.archivoEscrituraInput,
      licencia: this.imagenLicenciaInput,
      plano: this.imagenPlanoInput,
      contratoRenta: this.contratoRentaInput,
      constanciaFiscal: this.constanciaFiscalInput,
      constanciaRepLegal: this.constanciaRepLegalInput,
      comprobanteDomicilio: this.comprobanteDomicilioInput,
      actaConstitutiva: this.actaConstitutivaInput,
      ineRepresentante: this.ineRepresentanteInput,
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
    if (controlName === 'documentoContratoRenta') this.contratoRentaNombre = name;
    if (controlName === 'documentoConstanciaFiscal') this.constanciaFiscalNombre = name;
    if (controlName === 'constanciaSituacionFiscalRepresentanteLegal') this.constanciaRepLegalNombre = name;
    if (controlName === 'documentoComprobanteDomicilio') this.comprobanteDomicilioNombre = name;
    if (controlName === 'documentoActaConstitutiva') this.actaConstitutivaNombre = name;
    if (controlName === 'ineRepresentanteLegal') this.ineRepresentanteNombre = name;
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
        nombreRepresentanteLegal: `Carlos Medina — ${registro.nombreComercial}`,
        telefonoRepresentanteLegal: registro.telefono ?? '',
        correoRepresentanteLegal: registro.correo ?? '',
      },
      { emitEvent: false },
    );

    const socio0 = this.sociosFormArray.at(0) as FormGroup;
    socio0?.patchValue(
      {
        nombreSocio: registro.razonSocial,
        rfcSocio: registro.rfc,
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

  private cargarDesdeGrid(data: any): void {
    this.arrendatarioForm.patchValue(
      {
        nombreInmueble: data.inmueble || 'Corporativo Pirámide',
        tipoPersona: 2,
        rentaMxn: data.mensualidadMxn || 25000,
        direccionInmueble: 'Río Balsas 106, Vista Hermosa, Cuernavaca',
        vigenciaAnios: 3,
        fechaInicio: '2024-01-01',
        fechaFin: '2027-01-01',
        arrendador: data.arrendador || 'Inmuebles y Desarrollos HAC S.A de C.V.',
        tiempoRentaAnios: 3,
        estatusInmueble: 'RENTADO',
        nombreRepresentanteLegal: data.arrendatario || 'Representante Demo',
        telefonoRepresentanteLegal: data.telefonoContacto || '7770000000',
        correoRepresentanteLegal: data.correoContacto || 'demo@correo.com',
        inmuebles: data.inmueble || 'Corporativo Pirámide',
        fechaInicioContrato: '2024-01-01',
        fechaTerminoContrato: '2027-01-01',
        tipoMoneda: 'MXN',
        metrosRentados: data.superficieM2 || 100,
        costoPorM2: 350,
        pctMantenimiento: 10,
        mesesDeposito: 2,
        montoDeposito: 70000,
        mesesAdelanto: 1,
        montoAdelanto: 35000,
        anosForzososArrendador: 2,
        anosForzososArrendatario: 2,
        subtotalRenta: 35000,
        ivaRenta: 5600,
        rentaTotal: 40600,
        subtotalMantenimiento: 3500,
        ivaMantenimiento: 560,
        mantenimientoTotal: 4060,
        observaciones:
          'Contrato activo con condiciones estándar, incluye mantenimiento y servicios básicos.',
      },
      { emitEvent: false },
    );

    const servicios = this.arrendatarioForm.get('servicios') as FormArray;
    servicios.clear();
    const servicioRenta = this.crearServicioFormGroup('RENTA', true);
    servicioRenta.patchValue(
      {
        servicioNumeroContrato: data.numeroContrato || 'RENTA-001',
        servicioFechaPago: '2024-02-01',
        servicioUltimoDiaPago: '2024-02-28',
        servicioComprobantePagoNombre: 'comprobante_renta.pdf',
      },
      { emitEvent: false },
    );
    servicios.push(servicioRenta);

    const servicioMtto = this.crearServicioFormGroup('MANTENIMIENTO', true);
    servicioMtto.patchValue(
      {
        servicioNumeroContrato: 'MTTO-001',
        servicioFechaPago: '2024-02-01',
        servicioUltimoDiaPago: '2024-02-28',
        servicioComprobantePagoNombre: 'comprobante_mtto.pdf',
      },
      { emitEvent: false },
    );
    servicios.push(servicioMtto);

    const zonas = this.arrendatarioForm.get('zonas') as FormArray;
    zonas.clear();
    const zona = this.crearZonaFormGroup();
    zona.patchValue(
      {
        zonaPrincipal: 'Zona Comercial',
        zonaSuperficieM2: data.superficieM2 || 100,
        superficieDisponiblePredioM2: 50,
      },
      { emitEvent: false },
    );
    zonas.push(zona);

    const estacionamientos = this.arrendatarioForm.get('estacionamientos') as FormArray;
    estacionamientos.clear();
    const estacionamiento = this.crearEstacionamientoFormGroup();
    estacionamiento.patchValue(
      {
        estacionamientoPensionado: '10',
        estacionamientoTarjeta: '0',
        estacionamientoArrendatario: '0',
      },
      { emitEvent: false },
    );
    estacionamientos.push(estacionamiento);

    const socios = this.arrendatarioForm.get('socios') as FormArray;
    socios.clear();
    socios.push(this.crearSocioFormGroup());
    socios.at(0).patchValue(
      {
        nombreSocio: 'Carlos Ramírez',
        rfcSocio: 'CARL900101ABC',
      },
      { emitEvent: false },
    );
    socios.push(this.crearSocioFormGroup());
    socios.at(1).patchValue(
      {
        nombreSocio: 'Luis Hernández',
        rfcSocio: 'LUIS850505XYZ',
      },
      { emitEvent: false },
    );

    const locales = this.arrendatarioForm.get('locales') as FormArray;
    locales.clear();
    const local = this.crearLocalFormGroup();
    local.patchValue(
      {
        nombreLocal: data.local || 'Local Demo',
        zonaLocal: data.nivel || 'Planta baja',
        medidaLocal: data.superficieM2 ? `${data.superficieM2} m²` : '100 m²',
        ocupanteLocal: data.arrendatario || 'Arrendatario Demo',
        mensualidadLocalMxn: data.mensualidadMxn || 25000,
        arrendatarioLocal: data.arrendatario || 'Arrendatario Demo',
        arrendadorLocal: data.arrendador || 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContratoLocal: data.numeroContrato || 'RENTA-001',
        fechaInicioContratoLocal: '2024-01-01',
        fechaTerminoContratoLocal: '2027-01-01',
        contratoHastaLocal: '2027-01-01',
      },
      { emitEvent: false },
    );
    locales.push(local);

    const galeria = this.arrendatarioForm.get('galeriaImagenes') as FormArray;
    galeria.clear();
    const imagen = this.crearGaleriaImagenFormGroup();
    imagen.patchValue(
      {
        archivo: null,
        nombre: 'fondonegro.png',
      },
      { emitEvent: false },
    );
    galeria.push(imagen);
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
