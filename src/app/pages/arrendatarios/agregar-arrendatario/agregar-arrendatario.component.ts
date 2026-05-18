import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, forkJoin, of, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import {
  CatServicioItem,
  CatServiciosService,
} from 'src/app/services/moduleService/cat-servicios.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import {
  ARRENDATARIOS_FORM_DEMO,
  INMUEBLES_ARRENDATARIOS_DEMO,
} from '../arrendatarios-demo.data';

@Component({
  selector: 'app-agregar-arrendatario',
  templateUrl: './agregar-arrendatario.component.html',
  styleUrl: './agregar-arrendatario.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarArrendatarioComponent implements OnInit, OnDestroy {
  public title = 'Agregar Arrendatario';
  public submitButton: string = 'Guardar';
  public arrendatarioForm: FormGroup;
  /** Id del arrendatario en modo edición (ruta), no confundir con `idArrendador` del formulario. */
  public idArrendatario: number;
  public listaClientes: { id: number; nombre?: string; apellidoPaterno?: string; apellidoMaterno?: string }[] = [];
  public listaInmuebles: { id: number; etiqueta: string }[] = [];
  public listaCatServicios: CatServicioItem[] = [];
  loadingSubmit = false;
  /** Obligatorios sólo cuando el ``estatusInmueble`` es Rentado (alineado con inmueble). */
  public mostrarCamposRenta = false;
  mostrarModalMapa = false;
  /** Índice del slot de galería para animación de entrada (una vez). */
  indiceGaleriaAnimando: number | null = null;
  private readonly mapaCentroCuernavaca = { lat: 18.9186, lng: -99.2341 };
  private readonly mapaZoomCuernavaca = 11;
  private map: unknown = null;
  private marker: unknown = null;
  private latSeleccionada: number | null = null;
  private lngSeleccionada: number | null = null;
  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly pinUrl = 'assets/images/logos/marker_spring.webp';
  readonly acceptPdfImagenes = 'application/pdf,image/png,image/jpeg,image/jpg';
  readonly etiquetaPdfImagenes = 'PDF · PNG · JPG · JPEG';
  readonly acceptSoloImagenes = 'image/png,image/jpeg,image/jpg';
  readonly etiquetaSoloImagenes = 'PNG · JPG · JPEG';
  archivoEscrituraNombre: string | null = null;
  imagenLicenciaNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  contratoRentaNombre: string | null = null;
  constanciaFiscalNombre: string | null = null;
  constanciaRepLegalNombre: string | null = null;
  comprobanteDomicilioNombre: string | null = null;
  actaConstitutivaNombre: string | null = null;
  ineRepresentanteNombre: string | null = null;
  /** Boleta predial y recibo (paridad documentos ``agregar-inmueble``). */
  boletaPredialNombre: string | null = null;
  reciboAguaServiciosNombre: string | null = null;
  archivoEscrituraUrl: string | null = null;
  imagenLicenciaUrl: string | null = null;
  imagenPlanoUrl: string | null = null;
  contratoRentaUrl: string | null = null;
  constanciaFiscalUrl: string | null = null;
  constanciaRepLegalUrl: string | null = null;
  comprobanteDomicilioUrl: string | null = null;
  ineRepresentanteUrl: string | null = null;
  boletaPredialUrl: string | null = null;
  resaltarAutocargaContrato = false;
  resaltarAutocargaDocs = false;
  private promptAutocargaMostrado = false;
  private readonly debounceLogMs = 400;
  private formValueLogSub?: Subscription;
  private estatusInmuebleSub?: Subscription;

  @ViewChild('archivoEscrituraInput') archivoEscrituraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenLicenciaInput') imagenLicenciaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenPlanoInput') imagenPlanoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('contratoRentaInput') contratoRentaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaFiscalInput') constanciaFiscalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaRepLegalInput') constanciaRepLegalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('comprobanteDomicilioInput') comprobanteDomicilioInput?: ElementRef<HTMLInputElement>;
  @ViewChild('actaConstitutivaInput') actaConstitutivaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('ineRepresentanteInput') ineRepresentanteInput?: ElementRef<HTMLInputElement>;
  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;
  @ViewChild('autocargaEscrituraCard') autocargaEscrituraCard?: ElementRef<HTMLElement>;
  @ViewChild('docsSectionArrendatario') docsSectionArrendatario?: ElementRef<HTMLElement>;
  @ViewChild('boletaPredialInput') boletaPredialInput?: ElementRef<HTMLInputElement>;
  @ViewChild('reciboAguaServiciosInput')
  reciboAguaServiciosInput?: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private clientesService: ClientesService,
    private catServiciosService: CatServiciosService,
    private inmueblesService: InmueblesService,
    private arrendatariosService: ArrendatariosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initTipoPersonaLogic();
    this.initEstatusInmuebleLogic();
    this.formValueLogSub = this.arrendatarioForm.valueChanges
      .pipe(debounceTime(this.debounceLogMs))
      .subscribe(() => {
        // Mismo criterio que `agregar-inmueble`: log tras pausa de escritura (incluye valores actuales).
        console.log('[agregar-arrendatario] valor del formulario (tras pausa de escritura)', {
          value: this.arrendatarioForm.getRawValue(),
          mostrarCamposRenta: this.mostrarCamposRenta,
        });
      });

    forkJoin({
      clientes: this.clientesService.obtenerClientes().pipe(catchError(() => of(null))),
      catServicios: this.catServiciosService
        .obtenerServiciosPaginados(1, 30)
        .pipe(catchError(() => of(null))),
      inmuebles: this.inmueblesService
        .obtenerInmueblesData(1, 200)
        .pipe(catchError(() => of(null))),
    }).subscribe(({ clientes, catServicios, inmuebles }) => {
      this.asignarListaClientes(clientes);
      this.asignarListaInmuebles(inmuebles);
      if (catServicios != null) {
        this.listaCatServicios = this.extraerFilasCatServicios(catServicios);
      } else {
        this.listaCatServicios = [];
      }
      this.syncServiciosIdsDesdeCatalogo();
    });

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
      } else {
        this.mostrarPromptAutocargaContrato();
      }
    });
  }

  ngOnDestroy(): void {
    this.formValueLogSub?.unsubscribe();
    this.estatusInmuebleSub?.unsubscribe();
  }

  private initEstatusInmuebleLogic(): void {
    const estatusCtrl = this.arrendatarioForm.get('estatusInmueble');
    if (!estatusCtrl) return;
    this.aplicarValidadoresEstatus(estatusCtrl.value);
    this.estatusInmuebleSub = estatusCtrl.valueChanges.subscribe((value) =>
      this.aplicarValidadoresEstatus(value),
    );
  }

  /** Renta, tiempo de renta y contrato sólo cuando el estatus es Rentado (paridad ``agregar-inmueble``). */
  private aplicarValidadoresEstatus(raw: unknown): void {
    const v = String(raw ?? '').toUpperCase().trim();
    const rentado = v === 'RENTADO';
    this.mostrarCamposRenta = rentado;

    const rentaCtrl = this.arrendatarioForm.get('rentaMxn');
    const tiempoCtrl = this.arrendatarioForm.get('tiempoRentaAnios');
    const contratoCtrl = this.arrendatarioForm.get('documentoContratoRenta');
    if (!rentaCtrl || !tiempoCtrl) return;

    if (rentado) {
      rentaCtrl.setValidators([Validators.required]);
      tiempoCtrl.setValidators([Validators.required]);
    } else {
      rentaCtrl.clearValidators();
      tiempoCtrl.clearValidators();
      rentaCtrl.setValue('', { emitEvent: false });
      tiempoCtrl.setValue('', { emitEvent: false });
      contratoCtrl?.setValue(null, { emitEvent: false });
      this.contratoRentaNombre = null;
      this.contratoRentaUrl = null;
    }

    rentaCtrl.updateValueAndValidity({ emitEvent: false });
    tiempoCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private mostrarPromptAutocargaContrato(): void {
    if (this.promptAutocargaMostrado) return;
    this.promptAutocargaMostrado = true;
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: '¿Quieres Intentar Completar El Formulario Con Un Archivo?',
      text: 'Te llevaremos a la sección de Escrituras o Título para subir el archivo y extraer algunos datos.',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, Llevarme',
      cancelButtonText: 'No, Continuar Manualmente',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.enfocarAutocargaContrato();
    });
  }

  private enfocarAutocargaContrato(): void {
    setTimeout(() => {
      const esc = this.autocargaEscrituraCard?.nativeElement;
      if (esc) {
        esc.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.resaltarAutocargaContrato = true;
        return;
      }
      const docs = this.docsSectionArrendatario?.nativeElement;
      if (!docs) return;
      docs.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.resaltarAutocargaDocs = true;
    }, 120);
  }

  private initForm(): void {
    this.arrendatarioForm = this.fb.group({
      nombreInmueble: ['', Validators.required],
      tipoPersona: [null as number | null, Validators.required],
      rentaMxn: [''],
      /** Solo UI / notas; no van en JSON `arrendatario` del Swagger POST /arrendatarios. */
      direccionInmueble: [''],
      vigenciaAnios: [''],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      idArrendador: [null as number | null, Validators.required],
      /** Controla visibilidad de renta/contrato; no obligatorio y no se envía al API si no está en el contrato OpenAPI. */
      estatusInmueble: [null as string | null],
      tiempoRentaAnios: [''],
      nombreRepresentanteLegal: ['', Validators.required],
      telefonoRepresentanteLegal: ['', Validators.required],
      correoRepresentanteLegal: ['', [Validators.required, Validators.email]],
      /** Opcional según Swagger: `contratoArrendatario` es opcional. */
      idInmueble: [null as number | null],
      lat: [''],
      lng: [''],
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
      documentoBoletaPredial: [null],
      documentoReciboAguaServicios: [null],
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
      /** Dos filas por defecto: Renta y Mantenimiento (`syncServiciosIdsDesdeCatalogo`). */
      servicios: this.fb.array([this.crearServicioFormGroup(), this.crearServicioFormGroup()]),
      pagos: this.fb.array([]),
      socios: this.fb.array([this.crearSocioFormGroup()]),
      locales: this.fb.array([this.crearLocalFormGroup()]),
    });
    this.aplicarValidadoresEstatus(this.arrendatarioForm.get('estatusInmueble')?.value);
  }

  private initTipoPersonaLogic(): void {
    const ctrl = this.arrendatarioForm.get('tipoPersona');
    if (!ctrl) return;
    this.aplicarValidadoresTipoPersona(ctrl.value);
    ctrl.valueChanges.subscribe((v) => this.aplicarValidadoresTipoPersona(v));
  }

  private aplicarValidadoresTipoPersona(raw: unknown): void {
    const tipo = Number(raw);
    const curp = this.arrendatarioForm.get('documentoCurp');
    const acta = this.arrendatarioForm.get('documentoActaConstitutiva');
    const estadoCta = this.arrendatarioForm.get('documentoEstadoCuentaBancario');
    if (!curp || !acta || !estadoCta) return;

    curp.clearValidators();
    acta.clearValidators();
    estadoCta.clearValidators();

    if (tipo === 1) {
      curp.setValidators([Validators.required]);
      estadoCta.setValidators([Validators.required]);
    } else if (tipo === 2) {
      acta.setValidators([Validators.required]);
    }

    curp.updateValueAndValidity({ emitEvent: false });
    acta.updateValueAndValidity({ emitEvent: false });
    estadoCta.updateValueAndValidity({ emitEvent: false });
  }

  onTipoPersonaChange(_event: Event): void {
    const raw = this.arrendatarioForm.get('tipoPersona')?.value;
    const value =
      raw === null || raw === undefined || raw === '' ? null : Number(raw);
    this.arrendatarioForm.get('tipoPersona')?.setValue(value, { emitEvent: true });
  }

  esPersonaFisica(): boolean {
    return Number(this.arrendatarioForm?.get('tipoPersona')?.value) === 1;
  }

  esPersonaMoral(): boolean {
    return Number(this.arrendatarioForm?.get('tipoPersona')?.value) === 2;
  }

  private crearSocioFormGroup(): FormGroup {
    return this.fb.group({
      nombreSocio: [''],
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
      url: [''],
    });
  }

  private crearServicioFormGroup(): FormGroup {
    return this.fb.group({
      idTipoServicio: [null as number | null],
      servicioNumeroContrato: [''],
      servicioFechaPago: [''],
      servicioUltimoDiaPago: [''],
      servicioComprobantePago: [null],
      servicioComprobantePagoNombre: [''],
      servicioComprobantePagoUrl: [''],
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

  get pagosFormArray(): FormArray {
    return this.arrendatarioForm.get('pagos') as FormArray;
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

  private abrirModalMapaParaGuardar(): void {
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.mostrarModalMapa = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      void this.loadGoogleMaps()
        .then(() => this.initMapaArrendatarioModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 100);
  }

  cancelarModalMapa(): void {
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.limpiarEstadoMapaModal();
  }

  private limpiarEstadoMapaModal(): void {
    this.mostrarModalMapa = false;
    this.map = null;
    this.marker = null;
  }

  confirmarUbicacionMapa(): void {
    if (this.latSeleccionada == null || this.lngSeleccionada == null) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Selecciona una ubicación',
        text: 'Debes hacer clic en el mapa para marcar latitud y longitud antes de guardar.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    this.arrendatarioForm.patchValue({
      lat: this.latSeleccionada,
      lng: this.lngSeleccionada,
    });
    this.limpiarEstadoMapaModal();
    this.ejecutarGuardadoArrendatario();
  }

  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as Window & { google?: { maps?: unknown } };
      if (w.google?.maps) {
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

  private initMapaArrendatarioModal(): void {
    const mapElement = document.getElementById('mapArrendatario');
    if (!mapElement) return;
    const w = window as Window & {
      google?: {
        maps: {
          Map: new (node: HTMLElement, opts: object) => unknown;
          Marker: new (opts: object) => { setMap?: (m: unknown) => void };
          Size: new (a: number, b: number) => unknown;
          Point: new (a: number, b: number) => unknown;
        };
      };
    };
    if (!w.google?.maps) return;

    const latFromForm = Number(this.arrendatarioForm.get('lat')?.value);
    const lngFromForm = Number(this.arrendatarioForm.get('lng')?.value);
    const tieneCoordsGuardadas =
      Number.isFinite(latFromForm) &&
      Number.isFinite(lngFromForm) &&
      (latFromForm !== 0 || lngFromForm !== 0);
    const tieneSeleccionActual = this.latSeleccionada != null && this.lngSeleccionada != null;

    let lat: number;
    let lng: number;
    let zoom: number;
    if (tieneSeleccionActual) {
      lat = this.latSeleccionada!;
      lng = this.lngSeleccionada!;
      zoom = 14;
    } else if (tieneCoordsGuardadas) {
      lat = latFromForm;
      lng = lngFromForm;
      zoom = 14;
    } else {
      lat = this.mapaCentroCuernavaca.lat;
      lng = this.mapaCentroCuernavaca.lng;
      zoom = this.mapaZoomCuernavaca;
    }

    const g = w.google.maps;
    this.map = new g.Map(mapElement, {
      center: { lat, lng },
      zoom,
    });

    if (this.latSeleccionada != null && this.lngSeleccionada != null) {
      this.actualizarMarcadorMapa({ lat: this.latSeleccionada, lng: this.lngSeleccionada });
    } else if (tieneCoordsGuardadas) {
      this.latSeleccionada = latFromForm;
      this.lngSeleccionada = lngFromForm;
      this.actualizarMarcadorMapa({ lat: latFromForm, lng: lngFromForm });
    }

    (this.map as { addListener?: (ev: string, fn: (e: { latLng: { lat: () => number; lng: () => number } }) => void) => void })?.addListener?.(
      'click',
      (e: { latLng: { lat: () => number; lng: () => number } }) => {
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        this.latSeleccionada = p.lat;
        this.lngSeleccionada = p.lng;
        this.actualizarMarcadorMapa(p);
      },
    );
  }

  private actualizarMarcadorMapa(pos: { lat: number; lng: number }): void {
    const w = window as Window & {
      google?: {
        maps: {
          Marker: new (opts: object) => { setMap?: (m: unknown) => void };
          Size: new (a: number, b: number) => unknown;
          Point: new (a: number, b: number) => unknown;
        };
      };
    };
    if (!this.map || !w.google?.maps) return;
    const g = w.google.maps;
    const marker = this.marker as { setMap?: (m: null) => void } | null;
    if (marker?.setMap) marker.setMap(null);
    this.marker = new g.Marker({
      position: pos,
      map: this.map,
      icon: {
        url: this.pinUrl,
        scaledSize: new g.Size(70, 70),
        anchor: new g.Point(35, 70),
      },
    });
    (this.map as { panTo?: (p: { lat: number; lng: number }) => void })?.panTo?.(pos);
  }

  private tieneCoordenadasEnFormulario(): boolean {
    const lat = Number(this.arrendatarioForm.get('lat')?.value);
    const lng = Number(this.arrendatarioForm.get('lng')?.value);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  }

  agregarServicio(): void {
    this.serviciosFormArray.push(this.crearServicioFormGroup());
  }

  etiquetaCatServicio(item: CatServicioItem): string {
    const nombre = item.nombre ?? item.servicio ?? item.descripcion;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Servicio ${item.id}`;
  }

  eliminarServicio(index: number): void {
    if (this.serviciosFormArray.length <= 1) return;
    this.serviciosFormArray.removeAt(index);
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
      servicioComprobantePagoUrl: '',
    });
    if (input) input.value = '';
  }

  verArchivoRemoto(url: string | null | undefined, titulo: string): void {
    if (!url?.trim()) return;
    const subtitulo = String(this.arrendatarioForm.get('nombreInmueble')?.value ?? '').trim();
    this.docPreview?.abrir(url, titulo, subtitulo);
  }

  /** Edición con comprobante ya guardado en el servidor (URL remota). */
  layoutArchivoRemoto(url: string | null | undefined): boolean {
    return (
      this.idArrendatario != null &&
      Number.isFinite(Number(this.idArrendatario)) &&
      Number(this.idArrendatario) > 0 &&
      !!String(url ?? '').trim()
    );
  }

  agregarFotoGaleria(): void {
    const nuevoIndice = this.galeriaImagenesFormArray.length;
    this.galeriaImagenesFormArray.push(this.crearGaleriaImagenFormGroup());
    this.indiceGaleriaAnimando = nuevoIndice;
    setTimeout(() => this.finalizarAnimacionGaleria(nuevoIndice), 450);
  }

  finalizarAnimacionGaleria(indice: number): void {
    if (this.indiceGaleriaAnimando === indice) {
      this.indiceGaleriaAnimando = null;
    }
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
      url: '',
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
      | 'ineRepresentante'
      | 'boletaPredial'
      | 'reciboAgua',
  ): void {
    const map = {
      escritura: this.archivoEscrituraInput,
      boletaPredial: this.boletaPredialInput,
      reciboAgua: this.reciboAguaServiciosInput,
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
    if (controlName === 'documentoEscritura') {
      this.archivoEscrituraNombre = name;
      this.archivoEscrituraUrl = null;
    }
    if (controlName === 'documentoLicencia') {
      this.imagenLicenciaNombre = name;
      this.imagenLicenciaUrl = null;
    }
    if (controlName === 'documentoPlano') {
      this.imagenPlanoNombre = name;
      this.imagenPlanoUrl = null;
    }
    if (controlName === 'documentoContratoRenta') {
      this.contratoRentaNombre = name;
      this.contratoRentaUrl = null;
    }
    if (controlName === 'documentoConstanciaFiscal') {
      this.constanciaFiscalNombre = name;
      this.constanciaFiscalUrl = null;
    }
    if (controlName === 'constanciaSituacionFiscalRepresentanteLegal') {
      this.constanciaRepLegalNombre = name;
      this.constanciaRepLegalUrl = null;
    }
    if (controlName === 'documentoComprobanteDomicilio') {
      this.comprobanteDomicilioNombre = name;
      this.comprobanteDomicilioUrl = null;
    }
    if (controlName === 'documentoActaConstitutiva') this.actaConstitutivaNombre = name;
    if (controlName === 'ineRepresentanteLegal') {
      this.ineRepresentanteNombre = name;
      this.ineRepresentanteUrl = null;
    }
    if (controlName === 'documentoBoletaPredial') {
      this.boletaPredialNombre = name;
      this.boletaPredialUrl = null;
    }
    if (controlName === 'documentoReciboAguaServicios') this.reciboAguaServiciosNombre = name;
    if (controlName === 'documentoEscritura' && file) {
      this.resaltarAutocargaContrato = false;
      this.resaltarAutocargaDocs = false;
    }
    if (controlName === 'documentoContratoRenta' && file) this.resaltarAutocargaContrato = false;
  }

  private cargarDemoEdicion(id: number): void {
    const demoLocal = this.buscarLocalDemoPorId(id);
    const registro = ARRENDATARIOS_FORM_DEMO.find((item) => item.id === id);
    if (!registro && !demoLocal) return;
    const arrendatarioNombre =
      demoLocal?.local.arrendatario ??
      registro?.nombreComercial ??
      '';
    const arrendadorNombre =
      demoLocal?.local.arrendador ??
      registro?.arrendador ??
      '';
    const nombreRepresentante =
      this.resolverNombreRepresentanteDemo(arrendatarioNombre);
    const telefonoRep =
      demoLocal?.local.telefonoContacto ??
      registro?.telefono ??
      '';
    const correoRep =
      demoLocal?.local.correoContacto ??
      registro?.correo ??
      '';
    const localDemo = demoLocal
      ? {
          idLocal: demoLocal.local.idLocal,
          nombreLocal: demoLocal.local.nombreLocal,
          idInmueble: demoLocal.inmueble.idInmueble,
          nombreInmueble: demoLocal.inmueble.nombreInmueble,
          nivel: demoLocal.local.nivel,
          superficieM2: demoLocal.local.superficieM2,
          mensualidadMxn: demoLocal.local.mensualidadMxn,
          fechaInicio: '2024-01-01',
          fechaTermino: demoLocal.local.vigenciaHasta,
          estatusContrato: 'vigente' as const,
        }
      : registro?.locales?.[0];

    this.arrendatarioForm.patchValue(
      {
        nombreInmueble: arrendatarioNombre,
        tipoPersona: 2,
        estatusInmueble: 'RENTADO',
        rentaMxn: localDemo?.mensualidadMxn ?? '',
        direccionInmueble: demoLocal?.inmueble.direccion ?? '',
        vigenciaAnios: '5',
        fechaInicio: localDemo?.fechaInicio ?? '',
        fechaFin: localDemo?.fechaTermino ?? '',
        idArrendador: 1,
        tiempoRentaAnios: '3',
        nombreRepresentanteLegal: nombreRepresentante,
        telefonoRepresentanteLegal: telefonoRep,
        correoRepresentanteLegal: correoRep,
        idInmueble: localDemo?.idInmueble ?? null,
        lat: '',
        lng: '',
      },
      { emitEvent: false },
    );

    const socio0 = this.sociosFormArray.at(0) as FormGroup;
    socio0?.patchValue(
      {
        nombreSocio: registro?.razonSocial ?? arrendatarioNombre,
        rfcSocio: registro?.rfc ?? null,
      },
      { emitEvent: false },
    );

    if (localDemo) {
      this.localesFormArray.clear();
      this.localesFormArray.push(
        this.fb.group({
          nombreLocal: [localDemo.nombreLocal ?? ''],
          estadoLocal: [''],
          mensualidadLocalMxn: [localDemo.mensualidadMxn ?? ''],
          zonaLocal: [localDemo.nivel ?? ''],
          ocupanteLocal: [arrendatarioNombre ?? ''],
          giroLocal: [''],
          medidaLocal: [localDemo.superficieM2 ? `${localDemo.superficieM2} m²` : ''],
          contratoHastaLocal: [localDemo.fechaTermino ?? ''],
          archivoContratoLocal: [''],
          numeroContratoLocal: [''],
          tipoModificacionContratoLocal: [''],
          arrendadorLocal: [arrendadorNombre ?? ''],
          arrendatarioLocal: [arrendatarioNombre ?? ''],
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

    this.aplicarValidadoresEstatus(this.arrendatarioForm.get('estatusInmueble')?.value);
    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);
  }

  private cargarDesdeGrid(data: any): void {
    this.arrendatarioForm.patchValue(
      {
        nombreInmueble: data.arrendatario || 'Arrendatario Demo',
        tipoPersona: 2,
        estatusInmueble: 'RENTADO',
        rentaMxn: data.mensualidadMxn || 25000,
        direccionInmueble: 'C. San Cristóbal 4, San Cristobal, 62250 Cuernavaca, Mor.',
        vigenciaAnios: 3,
        fechaInicio: '2024-01-01',
        fechaFin: '2027-01-01',
        idArrendador: 1,
        tiempoRentaAnios: 3,
        nombreRepresentanteLegal: this.resolverNombreRepresentanteDemo(
          data.arrendatario || '',
        ),
        telefonoRepresentanteLegal: data.telefonoContacto || '7770000000',
        correoRepresentanteLegal: data.correoContacto || 'demo@correo.com',
        idInmueble: 1,
        lat: '',
        lng: '',
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
    const servicioRenta = this.crearServicioFormGroup();
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

    const servicioMtto = this.crearServicioFormGroup();
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
    this.syncServiciosIdsDesdeCatalogo();

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

    this.aplicarValidadoresEstatus(this.arrendatarioForm.get('estatusInmueble')?.value);
    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);
  }

  private asignarListaClientes(res: unknown): void {
    const r = res as { data?: unknown[] } | unknown[] | null;
    const rows = Array.isArray(r) ? r : ((r as { data?: unknown[] })?.data ?? []);
    this.listaClientes = Array.isArray(rows)
      ? rows.map((c) => {
          const row = c as Record<string, unknown>;
          return { ...row, id: Number(row['id']) };
        })
      : [];
  }

  private asignarListaInmuebles(res: unknown): void {
    const bag = res as { data?: unknown[] } | null;
    const rows = Array.isArray(bag?.data) ? bag.data : [];
    const items = rows
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const id = Number(row['id']);
        if (!Number.isFinite(id)) return null;
        const nombre = String(row['inmueble'] ?? '').trim() || 'Inmueble';
        const dir = String(row['direccionFiscal'] ?? '').trim();
        const etiqueta = dir ? `${nombre} — ${dir}` : nombre;
        return { id, etiqueta };
      })
      .filter((x): x is { id: number; etiqueta: string } => x != null);
    items.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
    this.listaInmuebles = items;
  }

  private extraerFilasCatServicios(res: unknown): CatServicioItem[] {
    const r = res as { data?: unknown } | unknown[] | null;
    if (r == null) return [];
    let rows: unknown = Array.isArray(r) ? r : (r as { data?: unknown }).data;
    if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
      const bag = rows as Record<string, unknown>;
      rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
    }
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = Number(row['id'] ?? row['idTipoServicio'] ?? row['idCatServicio']);
        if (!Number.isFinite(id)) return null;
        return {
          id,
          nombre: row['nombre'] != null ? String(row['nombre']) : undefined,
          servicio: row['servicio'] != null ? String(row['servicio']) : undefined,
          descripcion: row['descripcion'] != null ? String(row['descripcion']) : undefined,
        } as CatServicioItem;
      })
      .filter((item): item is CatServicioItem => item != null);
  }

  private syncServiciosIdsDesdeCatalogo(): void {
    const rentaId = this.buscarIdServicioPorNombre(/renta/i);
    const mttoId = this.buscarIdServicioPorNombre(/mantenimiento/i);
    if (this.serviciosFormArray.length >= 1 && rentaId != null) {
      (this.serviciosFormArray.at(0) as FormGroup).patchValue({ idTipoServicio: rentaId }, { emitEvent: false });
    }
    if (this.serviciosFormArray.length >= 2 && mttoId != null) {
      (this.serviciosFormArray.at(1) as FormGroup).patchValue({ idTipoServicio: mttoId }, { emitEvent: false });
    }
  }

  private buscarIdServicioPorNombre(rx: RegExp): number | null {
    const hit = this.listaCatServicios.find((s) => {
      const t = `${s.nombre ?? ''} ${s.servicio ?? ''} ${s.descripcion ?? ''}`;
      return rx.test(t);
    });
    return hit?.id ?? null;
  }

  private readonly controlesExcluidosValidacion = new Set<string>([
    'locales',
    'pagos',
    'servicios',
    'socios',
    'galeriaImagenes',
    'documentoEscritura',
    'documentoLicencia',
    'documentoPlano',
    'documentoContratoRenta',
    'documentoConstanciaFiscal',
    'documentoCurp',
    'constanciaSituacionFiscalRepresentanteLegal',
    'documentoComprobanteDomicilio',
    'documentoBoletaPredial',
    'documentoReciboAguaServicios',
    'documentoEstadoCuentaBancario',
    'documentoActaConstitutiva',
    'ineRepresentanteLegal',
    'lat',
    'lng',
  ]);

  private readonly etiquetasCampos: Record<string, string> = {
    nombreInmueble: 'Nombre del arrendatario',
    tipoPersona: 'Tipo de persona',
    rentaMxn: 'Renta (MXN)',
    direccionInmueble: 'Dirección fiscal',
    estatusInmueble: 'Estatus del arrendamiento',
    vigenciaAnios: 'Vigencia (años)',
    fechaInicio: 'Fecha de inicio',
    fechaFin: 'Fecha de fin',
    idArrendador: 'Arrendador',
    tiempoRentaAnios: 'Tiempo de renta (años)',
    nombreRepresentanteLegal: 'Representante legal',
    telefonoRepresentanteLegal: 'Teléfono del representante',
    correoRepresentanteLegal: 'Correo del representante',
    idInmueble: 'Inmueble (contrato)',
    fechaInicioContrato: 'Inicio de contrato',
    fechaTerminoContrato: 'Término de contrato',
    tipoMoneda: 'Moneda',
    metrosRentados: 'Metros rentados',
    costoPorM2: 'Costo por m²',
    pctMantenimiento: 'Porcentaje mantenimiento',
    mesesDeposito: 'Meses depósito',
    montoDeposito: 'Monto depósito',
    mesesAdelanto: 'Meses adelanto',
    montoAdelanto: 'Monto adelanto',
    anosForzososArrendador: 'Años forzosos arrendador',
    anosForzososArrendatario: 'Años forzosos arrendatario',
    subtotalRenta: 'Subtotal renta',
    ivaRenta: 'IVA renta',
    rentaTotal: 'Renta total',
    subtotalMantenimiento: 'Subtotal mantenimiento',
    ivaMantenimiento: 'IVA mantenimiento',
    mantenimientoTotal: 'Mantenimiento total',
    observaciones: 'Observaciones',
  };

  private validarFormularioAntesMapa(): boolean {
    this.aplicarValidadoresEstatus(this.arrendatarioForm.get('estatusInmueble')?.value);
    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);

    this.arrendatarioForm.markAllAsTouched();
    this.serviciosFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());
    this.sociosFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());

    const faltantes = this.recopilarCamposFaltantes();
    if (faltantes.length === 0) return true;

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

    void Swal.fire({
      title: '¡Revise el formulario!',
      html: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Faltan campos obligatorios según el contrato vigente del formulario y del API.
          Los campos ocultos (según estatus o tipo de persona) no se marcan como obligatorios.
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3085d6',
      background: '#141a21',
      color: '#ffffff',
      customClass: { popup: 'swal2-padding swal2-border' },
    });
    return false;
  }

  /** Fila de servicios considerada «en uso»: si eligieron tipo de servicio, deben completar datos mínimos. */
  private servicioFilaActiva(grupo: FormGroup): boolean {
    const raw = grupo.get('idTipoServicio')?.value;
    if (raw == null || raw === '') return false;
    return Number.isFinite(Number(raw));
  }

  private recopilarCamposFaltantes(): string[] {
    const faltantes: string[] = [];
    Object.keys(this.arrendatarioForm.controls).forEach((key) => {
      if (this.controlesExcluidosValidacion.has(key)) return;
      if (!this.mostrarCamposRenta && (key === 'rentaMxn' || key === 'tiempoRentaAnios')) return;

      const control = this.arrendatarioForm.get(key);
      if (!control || control.disabled) return;
      if (control.invalid) {
        faltantes.push(this.etiquetasCampos[key] ?? key);
      }
    });

    this.serviciosFormArray.controls.forEach((ctrl, i) => {
      const g = ctrl as FormGroup;
      if (!this.servicioFilaActiva(g)) return;
      const etiquetaPref = `Servicio ${i + 1}`;
      const nc = String(g.get('servicioNumeroContrato')?.value ?? '').trim();
      const fp = String(g.get('servicioFechaPago')?.value ?? '').trim();
      const ulp = String(g.get('servicioUltimoDiaPago')?.value ?? '').trim();
      if (!nc) faltantes.push(`${etiquetaPref}: número de contrato`);
      if (!fp) faltantes.push(`${etiquetaPref}: fecha de pago`);
      if (!ulp) faltantes.push(`${etiquetaPref}: último día de pago`);
    });

    /** Socios: sin validadores en filas vacías; no se bloquean filas incompletasssss. */

    return faltantes;
  }

  private appendEntero(fd: FormData, key: string, value: unknown): void {
    if (value == null || value === '') return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    fd.append(key, String(Math.trunc(n)));
  }

  private numJson(value: unknown): number | undefined {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  /** JSON `arrendatario`: sólo los campos del Swagger POST /arrendatarios (string en multipart). */
  private construirJsonArrendatarioSwagger(v: Record<string, unknown>): string {
    const dto: Record<string, unknown> = {
      fechaInicio: String(v['fechaInicio'] ?? '').trim(),
      fechaFin: String(v['fechaFin'] ?? '').trim(),
      arrendatario: String(v['nombreInmueble'] ?? '').trim(),
      correoRepresentante: String(v['correoRepresentanteLegal'] ?? '').trim(),
      telefonoRepresentante: String(v['telefonoRepresentanteLegal'] ?? '').trim(),
      representanteLegal: String(v['nombreRepresentanteLegal'] ?? '').trim(),
    };

    const tp = Number(v['tipoPersona']);
    if (Number.isFinite(tp)) dto['tipoPersona'] = Math.trunc(tp);

    const idArr = Number(v['idArrendador']);
    if (Number.isFinite(idArr)) dto['idArrendador'] = Math.trunc(idArr);

    if (this.mostrarCamposRenta) {
      const rentaNum = this.numJson(v['rentaMxn']);
      if (rentaNum !== undefined) dto['renta'] = rentaNum;
      const tr = String(v['tiempoRentaAnios'] ?? '').trim();
      if (tr) dto['tiempoRenta'] = tr;
    }

    const lat = Number(v['lat']);
    const lng = Number(v['lng']);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      dto['lat'] = lat;
      dto['lng'] = lng;
    }

    return JSON.stringify(dto);
  }

  private logMultipartArrendatario(fd: FormData): void {
    const entradas: Record<string, string> = {};
    fd.forEach((value, key) => {
      if (value instanceof File) entradas[key] = `[File: ${value.name} (${value.size} B)]`;
      else entradas[key] = value;
    });
    console.log('[agregar-arrendatario] POST /arrendatarios multipart (clave → valor)', entradas);
  }

  private construirFormDataArrendatario(): FormData {
    const fd = new FormData();
    const v = this.arrendatarioForm.getRawValue() as Record<string, unknown>;

    fd.append('arrendatario', this.construirJsonArrendatarioSwagger(v));

    const idInmRaw = v['idInmueble'];
    const idInm =
      idInmRaw != null && String(idInmRaw).trim() !== '' ? Number(idInmRaw) : Number.NaN;

    const contrato: Record<string, unknown> = {};
    if (Number.isFinite(idInm)) contrato['idInmueble'] = Math.trunc(idInm);
    const fiC = String(v['fechaInicioContrato'] ?? '').trim();
    if (fiC) contrato['fechaInicioContrato'] = fiC;
    const ftC = String(v['fechaTerminoContrato'] ?? '').trim();
    if (ftC) contrato['fechaTerminoContrato'] = ftC;
    const moneda = String(v['tipoMoneda'] ?? '').trim();
    if (moneda) contrato['moneda'] = moneda;
    const obs = String(v['observaciones'] ?? '').trim();
    if (obs) contrato['observaciones'] = obs;
    const mr = this.numJson(v['metrosRentados']);
    if (mr !== undefined) contrato['metrosRentados'] = mr;
    const cm2 = this.numJson(v['costoPorM2']);
    if (cm2 !== undefined) contrato['costoM2'] = cm2;
    const pct = this.numJson(v['pctMantenimiento']);
    if (pct !== undefined) contrato['porcentajeMantenimiento'] = pct;
    const mdMes = this.numJson(v['mesesDeposito']);
    if (mdMes !== undefined) contrato['mesesDeposito'] = mdMes;
    const mdMon = this.numJson(v['montoDeposito']);
    if (mdMon !== undefined) contrato['montoDeposito'] = mdMon;
    const maMes = this.numJson(v['mesesAdelanto']);
    if (maMes !== undefined) contrato['mesesAdelanto'] = maMes;
    const maMon = this.numJson(v['montoAdelanto']);
    if (maMon !== undefined) contrato['montoAdelanto'] = maMon;
    const afa = this.numJson(v['anosForzososArrendador']);
    if (afa !== undefined) contrato['aniosForzososArrendador'] = afa;
    const afAt = this.numJson(v['anosForzososArrendatario']);
    if (afAt !== undefined) contrato['aniosForzososArrendatario'] = afAt;
    const str = this.numJson(v['subtotalRenta']);
    if (str !== undefined) contrato['subTotalRenta'] = str;
    const ivaR = this.numJson(v['ivaRenta']);
    if (ivaR !== undefined) contrato['ivaRenta'] = ivaR;
    const rt = this.numJson(v['rentaTotal']);
    if (rt !== undefined) contrato['rentaTotal'] = rt;
    const stm = this.numJson(v['subtotalMantenimiento']);
    if (stm !== undefined) contrato['subTotalMantenimiento'] = stm;
    const ivaM = this.numJson(v['ivaMantenimiento']);
    if (ivaM !== undefined) contrato['ivaMantenimiento'] = ivaM;
    const mt = this.numJson(v['mantenimientoTotal']);
    if (mt !== undefined) contrato['mantenimientoTotal'] = mt;

    if (Object.keys(contrato).length > 0) {
      fd.append('contratoArrendatario', JSON.stringify(contrato));
    }

    let si = 0;
    this.serviciosFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      const idTipoRaw = g.get('idTipoServicio')?.value;
      const idTipo =
        idTipoRaw != null && idTipoRaw !== '' ? Number(idTipoRaw) : Number.NaN;
      if (!Number.isFinite(idTipo)) return;
      this.appendEntero(fd, `servicios[${si}].idTipoServicio`, idTipo);
      const nc = g.get('servicioNumeroContrato')?.value;
      if (nc != null && String(nc).trim() !== '') {
        fd.append(`servicios[${si}].numeroContrato`, String(nc).trim());
      }
      const fp = String(g.get('servicioFechaPago')?.value ?? '').trim();
      if (fp) fd.append(`servicios[${si}].fechaPago`, fp);
      const ulp = String(g.get('servicioUltimoDiaPago')?.value ?? '').trim();
      if (ulp) fd.append(`servicios[${si}].ultimoDiaPago`, ulp);
      const arch = g.get('servicioComprobantePago')?.value;
      if (arch instanceof File) fd.append(`servicios[${si}].archivo`, arch, arch.name);
      si += 1;
    });

    let ai = 0;
    const pushArchivo = (file: unknown, nombre: string): void => {
      if (file instanceof File) {
        fd.append(`archivos[${ai}].nombre`, nombre);
        fd.append(`archivos[${ai}].archivo`, file, file.name);
        ai += 1;
      }
    };

    if (this.mostrarCamposRenta) {
      pushArchivo(v['documentoContratoRenta'], 'Contrato de renta');
    }
    pushArchivo(v['documentoConstanciaFiscal'], 'Constancia de situación fiscal');
    pushArchivo(v['documentoComprobanteDomicilio'], 'Comprobante de domicilio');
    pushArchivo(v['documentoEscritura'], 'Escrituras o título de propiedad');
    pushArchivo(v['documentoBoletaPredial'], 'Boleta predial vigente');
    pushArchivo(v['documentoReciboAguaServicios'], 'Recibo de agua o servicios');
    pushArchivo(v['documentoCurp'], 'CURP');
    pushArchivo(v['constanciaSituacionFiscalRepresentanteLegal'], 'Constancia fiscal representante legal');
    pushArchivo(v['documentoActaConstitutiva'], 'Acta constitutiva');
    pushArchivo(v['ineRepresentanteLegal'], 'Identificación oficial representante legal');
    pushArchivo(v['documentoEstadoCuentaBancario'], 'Estado de cuenta bancario');

    let ii = 0;
    const pushImagen = (file: unknown, nombre: string): void => {
      if (file instanceof File) {
        fd.append(`imagenes[${ii}].nombre`, nombre || file.name);
        fd.append(`imagenes[${ii}].archivo`, file, file.name);
        ii += 1;
      }
    };
    pushImagen(v['documentoLicencia'], 'Licencia o uso de suelo');
    pushImagen(v['documentoPlano'], 'Fachada');
    this.galeriaImagenesFormArray.controls.forEach((galCtrl) => {
      const g = galCtrl as FormGroup;
      const f = g.get('archivo')?.value;
      const nom = String(g.get('nombre')?.value ?? '').trim();
      if (f instanceof File) {
        fd.append(`imagenes[${ii}].nombre`, nom || f.name);
        fd.append(`imagenes[${ii}].archivo`, f, f.name);
        ii += 1;
      }
    });

    let socI = 0;
    this.sociosFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      const nombre = String(g.get('nombreSocio')?.value ?? '').trim();
      const rfc = String(g.get('rfcSocio')?.value ?? '').trim();
      const c1 = g.get('socioConstanciaSituacionFiscal')?.value;
      const c2 = g.get('socioComprobanteDomicilio')?.value;
      const c3 = g.get('socioActaConstitutiva')?.value;
      if (!nombre && !(c1 instanceof File) && !(c2 instanceof File) && !(c3 instanceof File)) return;

      fd.append(`socios[${socI}].nombre`, nombre || 'Socio');
      if (rfc) fd.append(`socios[${socI}].rfc`, rfc);
      if (c1 instanceof File) {
        fd.append(`socios[${socI}].constanciaFiscalArchivo`, c1, c1.name);
      }
      if (c2 instanceof File) {
        fd.append(`socios[${socI}].comprobanteDomicilioArchivo`, c2, c2.name);
      }
      if (c3 instanceof File) {
        fd.append(`socios[${socI}].identificacionOficialArchivo`, c3, c3.name);
      }
      socI += 1;
    });

    return fd;
  }

  private abrirSwalCargando(): void {
    void Swal.fire({
      title: 'Cargando...',
      background: '#141a21',
      color: '#ffffff',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  private cerrarSwalCargandoYRedirigirArrendatarios(inicioPeticion: number): void {
    const restanteMs = Math.max(0, 2000 - (Date.now() - inicioPeticion));
    setTimeout(() => {
      Swal.close();
      this.loadingSubmit = false;
      void this.router.navigateByUrl('/arrendatarios');
    }, restanteMs);
  }

  private ejecutarGuardadoArrendatario(): void {
    this.loadingSubmit = true;
    const inicio = Date.now();
    this.abrirSwalCargando();
    const fd = this.construirFormDataArrendatario();
    this.logMultipartArrendatario(fd);

    const req =
      this.idArrendatario != null && Number.isFinite(Number(this.idArrendatario))
        ? this.arrendatariosService.actualizarArrendatario(Number(this.idArrendatario), fd)
        : this.arrendatariosService.crearArrendatario(fd);

    req.subscribe({
      next: () => this.cerrarSwalCargandoYRedirigirArrendatarios(inicio),
      error: (err: unknown) => {
        Swal.close();
        this.loadingSubmit = false;
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo guardar el arrendatario. Verifique la información e intente de nuevo.';
        void Swal.fire({
          title: 'No se pudo guardar',
          text: String(text),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  submit(): void {
    if (!this.validarFormularioAntesMapa()) return;
    if (this.tieneCoordenadasEnFormulario()) {
      this.ejecutarGuardadoArrendatario();
    } else {
      this.abrirModalMapaParaGuardar();
    }
  }

  private buscarLocalDemoPorId(idLocal: number): {
    inmueble: (typeof INMUEBLES_ARRENDATARIOS_DEMO)[number];
    local: (typeof INMUEBLES_ARRENDATARIOS_DEMO)[number]['locales'][number];
  } | null {
    for (const inmueble of INMUEBLES_ARRENDATARIOS_DEMO) {
      const local = inmueble.locales.find((l) => l.idLocal === idLocal);
      if (local) return { inmueble, local };
    }
    return null;
  }

  private resolverNombreRepresentanteDemo(arrendatarioNombre: string): string {
    const key = String(arrendatarioNombre ?? '').trim().toLowerCase();
    const map: Record<string, string> = {
      'little caesars': 'Paola Méndez',
      'farmacia san pablo': 'Ricardo Ortega',
      'joyerías nice': 'Gabriela Salinas',
      'spring telecom méxico': 'Luis Fernando Ríos',
    };
    return map[key] ?? 'Representante Demo';
  }

  regresar(): void {
    void this.router.navigateByUrl('/arrendatarios');
  }
}
