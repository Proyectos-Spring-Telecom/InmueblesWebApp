import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { INMUEBLES_FORM_DEMO } from '../inmuebles-demo.data';

@Component({
  selector: 'app-agregar-inmueble',
  templateUrl: './agregar-inmueble.component.html',
  styleUrl: './agregar-inmueble.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarInmuebleComponent implements OnInit {
  public title = 'Agregar Inmueble';
  public submitButton: string = 'Guardar';
  public inmuebleForm!: FormGroup;
  public idInmueble!: number;
  public mostrarCamposRenta = true;
  archivoEscrituraNombre: string | null = null;
  imagenLicenciaNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  contratoRentaNombre: string | null = null;
  constanciaFiscalNombre: string | null = null;
  constanciaRepLegalNombre: string | null = null;
  comprobanteDomicilioNombre: string | null = null;
  actaConstitutivaNombre: string | null = null;
  ineRepresentanteNombre: string | null = null;
  mostrarModalMapa = false;
  map: any = null;
  marker: any = null;
  latSeleccionada: number | null = null;
  lngSeleccionada: number | null = null;
  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly PIN_URL = 'assets/images/logos/marker_spring.webp';

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
    this.initEstatusInmuebleLogic();
    this.activatedRoute.params.subscribe((params) => {
      this.idInmueble = Number(params['idInmueble']);
      if (this.idInmueble) {
        this.title = 'Actualizar Inmueble';
        this.submitButton = 'Actualizar';
        this.cargarDemoEdicion(this.idInmueble);
      }
    });
  }

  private initForm(): void {
    this.inmuebleForm = this.fb.group({
      nombreInmueble: ['', Validators.required],
      rentaMxn: [''],
      direccionInmueble: ['', Validators.required],
      vigenciaAnios: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      arrendador: ['', Validators.required],
      tiempoRentaAnios: [''],
      estatusInmueble: ['', Validators.required],
      nombreRepresentanteLegal: ['', Validators.required],
      telefonoRepresentanteLegal: ['', Validators.required],
      correoRepresentanteLegal: ['', [Validators.required, Validators.email]],
      documentoEscritura: [null],
      documentoLicencia: [null],
      documentoPlano: [null],
      documentoContratoRenta: [null],
      documentoConstanciaFiscal: [null],
      constanciaSituacionFiscalRepresentanteLegal: [null],
      documentoComprobanteDomicilio: [null],
      documentoActaConstitutiva: [null],
      ineRepresentanteLegal: [null],
      galeriaImagenes: this.fb.array([this.crearGaleriaImagenFormGroup()]),
      servicios: this.fb.array([this.crearServicioFormGroup()]),
      zonas: this.fb.array([this.crearZonaFormGroup()]),
      estacionamientos: this.fb.array([this.crearEstacionamientoFormGroup()]),
      pagos: this.fb.array([this.crearPagoFormGroup()]),
      socios: this.fb.array([this.crearSocioFormGroup()]),
      locales: this.fb.array([this.crearLocalFormGroup()]),
      lat: [''],
      lng: [''],
    });
  }

  private initEstatusInmuebleLogic(): void {
    const estatusCtrl = this.inmuebleForm.get('estatusInmueble');
    if (!estatusCtrl) return;

    const apply = (raw: unknown): void => {
      const v = String(raw ?? '').toUpperCase().trim();
      const rentado = v === 'RENTADO';
      this.mostrarCamposRenta = rentado;

      const rentaCtrl = this.inmuebleForm.get('rentaMxn');
      const tiempoCtrl = this.inmuebleForm.get('tiempoRentaAnios');
      if (!rentaCtrl || !tiempoCtrl) return;

      if (rentado) {
        rentaCtrl.setValidators([Validators.required]);
        tiempoCtrl.setValidators([Validators.required]);
      } else {
        rentaCtrl.clearValidators();
        tiempoCtrl.clearValidators();
        rentaCtrl.setValue('', { emitEvent: false });
        tiempoCtrl.setValue('', { emitEvent: false });
      }

      rentaCtrl.updateValueAndValidity({ emitEvent: false });
      tiempoCtrl.updateValueAndValidity({ emitEvent: false });
    };

    apply(estatusCtrl.value);
    estatusCtrl.valueChanges.subscribe((value) => apply(value));
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

  private crearServicioFormGroup(): FormGroup {
    return this.fb.group({
      servicioTipoContrato: [''],
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

  private crearPagoFormGroup(): FormGroup {
    return this.fb.group({
      pagoConcepto: [''],
      pagoFecha: [''],
      pagoMonto: [''],
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
    return this.inmuebleForm.get('locales') as FormArray;
  }

  get galeriaImagenesFormArray(): FormArray {
    return this.inmuebleForm.get('galeriaImagenes') as FormArray;
  }

  galeriaGrupo(index: number): FormGroup {
    return this.galeriaImagenesFormArray.at(index) as FormGroup;
  }

  get serviciosFormArray(): FormArray {
    return this.inmuebleForm.get('servicios') as FormArray;
  }

  get zonasFormArray(): FormArray {
    return this.inmuebleForm.get('zonas') as FormArray;
  }

  get estacionamientosFormArray(): FormArray {
    return this.inmuebleForm.get('estacionamientos') as FormArray;
  }

  get pagosFormArray(): FormArray {
    return this.inmuebleForm.get('pagos') as FormArray;
  }

  get sociosFormArray(): FormArray {
    return this.inmuebleForm.get('socios') as FormArray;
  }

  get primerNombreSocio(): string {
    const raw = this.sociosFormArray?.at(0)?.get('nombreSocio')?.value;
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
    if (this.esServicioTipoOtro(index)) return;
    group.patchValue({ servicioTipoContratoOtro: '' }, { emitEvent: false });
  }

  resetServicioTipoContrato(index: number): void {
    const group = this.serviciosFormArray.at(index) as FormGroup | null;
    if (!group) return;
    group.patchValue(
      { servicioTipoContrato: '', servicioTipoContratoOtro: '' },
      { emitEvent: false },
    );
  }

  eliminarServicio(index: number): void {
    if (this.serviciosFormArray.length === 1) return;
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

  agregarPago(): void {
    this.pagosFormArray.push(this.crearPagoFormGroup());
  }

  eliminarPago(index: number): void {
    if (this.pagosFormArray.length === 1) return;
    this.pagosFormArray.removeAt(index);
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
    this.inmuebleForm.get(controlName)?.setValue(file);

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
    const registro = INMUEBLES_FORM_DEMO.find((item) => item.id === id);
    if (!registro) return;
    this.inmuebleForm.patchValue(
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
        lat: '',
        lng: '',
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

  submit(): void {
    if (this.inmuebleForm.invalid) {
      this.inmuebleForm.markAllAsTouched();
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
      text: this.idInmueble
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
    void this.router.navigateByUrl('/inmuebles');
  }

  abrirModalMapa(): void {
    this.mostrarModalMapa = true;
    setTimeout(() => {
      this.loadGoogleMaps()
        .then(() => this.initMapModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 0);
  }

  cerrarModalMapa(): void {
    this.mostrarModalMapa = false;
    this.map = null;
    this.marker = null;
  }

  confirmarUbicacionMapa(): void {
    if (this.latSeleccionada == null || this.lngSeleccionada == null) {
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Selecciona una ubicación',
        text: 'Haz clic en el mapa para marcar la ubicación del inmueble.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    this.inmuebleForm.patchValue({
      lat: this.latSeleccionada,
      lng: this.lngSeleccionada,
    });
    this.cerrarModalMapa();
  }

  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;

      if (w.google && w.google.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  private initMapModal(): void {
    const mapElement = document.getElementById('mapInmueble');
    if (!mapElement) return;

    const w = window as any;
    if (!w.google || !w.google.maps) return;

    const latFromForm = Number(this.inmuebleForm.get('lat')?.value);
    const lngFromForm = Number(this.inmuebleForm.get('lng')?.value);
    const lat = this.latSeleccionada ?? (Number.isFinite(latFromForm) ? latFromForm : 18.92173314169828);
    const lng = this.lngSeleccionada ?? (Number.isFinite(lngFromForm) ? lngFromForm : -99.234049156825952);

    this.map = new w.google.maps.Map(mapElement, {
      center: { lat, lng },
      zoom: 13,
    });

    if (this.latSeleccionada != null && this.lngSeleccionada != null) {
      this.actualizarMarcador({ lat: this.latSeleccionada, lng: this.lngSeleccionada });
    } else if (Number.isFinite(latFromForm) && Number.isFinite(lngFromForm)) {
      this.latSeleccionada = latFromForm;
      this.lngSeleccionada = lngFromForm;
      this.actualizarMarcador({ lat: latFromForm, lng: lngFromForm });
    }

    this.map.addListener('click', (e: any) => {
      const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      this.latSeleccionada = p.lat;
      this.lngSeleccionada = p.lng;
      this.actualizarMarcador(p);
    });
  }

  private actualizarMarcador(pos: { lat: number; lng: number }): void {
    const w = window as any;
    if (!this.map || !w.google || !w.google.maps) return;

    if (this.marker) this.marker.setMap(null);
    this.marker = new w.google.maps.Marker({
      position: pos,
      map: this.map,
      icon: {
        url: this.PIN_URL,
        scaledSize: new w.google.maps.Size(70, 70),
        anchor: new w.google.maps.Point(35, 70),
      },
    });

    this.map.panTo(pos);
  }
}
