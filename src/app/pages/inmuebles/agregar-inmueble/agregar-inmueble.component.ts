import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, finalize, forkJoin, map, of, Subscription, switchMap, tap } from 'rxjs';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  estatusInmuebleDesdeApi,
  extraerInmuebleDetalleApi,
  fechaParaInputDate,
  idArrendadorDesdeApi,
  InmuebleApiItem,
  InmuebleArchivoApi,
  InmuebleServicioApi,
  InmuebleZonaApi,
  separarArchivosInmueble,
  SlotDocumentoInmueble,
} from '../inmuebles-list.mapper';
import {
  CatServicioItem,
  CatServiciosService,
} from 'src/app/services/moduleService/cat-servicios.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import { PdfOcrService } from 'src/app/services/moduleService/pdf-ocr.service';
import {
  extraerConstanciaDeRespuestaOcr,
  mapearConstanciaAInmueble,
} from 'src/app/shared/constancia-fiscal-ocr.mapper';

@Component({
  selector: 'app-agregar-inmueble',
  templateUrl: './agregar-inmueble.component.html',
  styleUrl: './agregar-inmueble.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarInmuebleComponent implements OnInit, OnDestroy {
  private readonly swalToastOcrExito = Swal.mixin({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: 'Información aplicada en formulario.',
    showConfirmButton: false,
    timer: 4200,
    timerProgressBar: true,
    background: '#141a21',
    color: '#ffffff',
  });

  public title = 'Agregar Inmueble';
  public submitButton: string = 'Guardar';
  public inmuebleForm!: FormGroup;
  public idInmueble?: number;
  /** Catálogo de clientes (arrendadores) para `idArrendador`. */
  public listaClientes: {
    id: number;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    rfc?: string;
  }[] = [];
  /** Catálogo GET `/cat-servicios/paginated` para el select de servicios. */
  public listaCatServicios: CatServicioItem[] = [];
  public loadingSubmit = false;
  public cargandoDetalle = false;
  public mostrarCamposRenta = false;
  /** Fachada y galería: solo imágenes. */
  readonly acceptSoloImagenes = 'image/png,image/jpeg,image/jpg';
  readonly etiquetaSoloImagenes = 'PNG · JPG · JPEG';
  /** Resto de documentos y comprobantes. */
  readonly acceptPdfImagenes = 'application/pdf,image/png,image/jpeg,image/jpg';
  readonly etiquetaPdfImagenes = 'PDF · PNG · JPG · JPEG';
  readonly acceptSoloPdf = 'application/pdf';
  readonly etiquetaSoloPdf = 'PDF';
  archivoEscrituraNombre: string | null = null;
  imagenLicenciaNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  contratoRentaNombre: string | null = null;
  constanciaFiscalNombre: string | null = null;
  constanciaRepLegalNombre: string | null = null;
  comprobanteDomicilioNombre: string | null = null;
  actaConstitutivaNombre: string | null = null;
  ineRepresentanteNombre: string | null = null;
  boletaPredialNombre: string | null = null;
  reciboAguaServiciosNombre: string | null = null;
  imagenLicenciaUrl: string | null = null;
  imagenPlanoUrl: string | null = null;
  contratoRentaUrl: string | null = null;
  constanciaFiscalUrl: string | null = null;
  constanciaRepLegalUrl: string | null = null;
  comprobanteDomicilioUrl: string | null = null;
  ineRepresentanteUrl: string | null = null;
  archivoEscrituraUrl: string | null = null;
  boletaPredialUrl: string | null = null;
  resaltarAutocargaContrato = false;
  resaltarAutocargaDocs = false;
  /** Usuario aceptó completar el formulario con la constancia fiscal. */
  autocargaCsfPendiente = false;
  private procesandoConstanciaOcr = false;
  private promptAutocargaMostrado = false;
  /** Log del formulario tras pausa de escritura (ms); se cancela al destruir el componente. */
  private readonly debounceLogMs = 400;
  private formValueLogSub?: Subscription;
  private readonly etiquetasCampos: Record<string, string> = {
    nombreInmueble: 'Inmueble',
    idArrendador: 'Arrendador',
    rentaMxn: 'Renta (MXN)',
    direccionInmueble: 'Dirección fiscal',
    estatusInmueble: 'Estatus del inmueble',
    vigenciaAnios: 'Vigencia (años)',
    fechaInicio: 'Inicio de vigencia',
    fechaFin: 'Fin de vigencia',
    tiempoRentaAnios: 'Tiempo de renta (años)',
    nombreRepresentanteLegal: 'Nombre representante legal',
    telefonoRepresentanteLegal: 'Teléfono representante legal',
    correoRepresentanteLegal: 'Correo representante legal',
  };
  private readonly controlesExcluidosValidacion = new Set([
    'lat',
    'lng',
    'documentoEscritura',
    'documentoBoletaPredial',
    'documentoReciboAguaServicios',
    'documentoLicencia',
    'documentoPlano',
    'documentoContratoRenta',
    'documentoConstanciaFiscal',
    'constanciaSituacionFiscalRepresentanteLegal',
    'documentoComprobanteDomicilio',
    'documentoActaConstitutiva',
    'ineRepresentanteLegal',
    'galeriaImagenes',
    'servicios',
    'zonas',
    'locales',
    'socios',
    'estacionamientos',
    'pagos',
  ]);
  mostrarModalMapa = false;
  /** Índice del slot de galería que debe reproducir la animación de entrada (una sola vez). */
  indiceGaleriaAnimando: number | null = null;
  /** Vista inicial del modal: Cuernavaca, Morelos (sin coordenadas en formulario). */
  private readonly mapaCentroCuernavaca = { lat: 18.9186, lng: -99.2341 };
  private readonly mapaZoomCuernavaca = 11;
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
  @ViewChild('boletaPredialInput') boletaPredialInput?: ElementRef<HTMLInputElement>;
  @ViewChild('reciboAguaServiciosInput')
  reciboAguaServiciosInput?: ElementRef<HTMLInputElement>;
  @ViewChild('autocargaCsfCardInmueble') autocargaCsfCardInmueble?: ElementRef<HTMLElement>;
  @ViewChild('topFormularioInmueble') topFormularioInmueble?: ElementRef<HTMLElement>;
  @ViewChild('inicioFormularioInmueble') inicioFormularioInmueble?: ElementRef<HTMLElement>;
  @ViewChild('docsSectionInmueble') docsSectionInmueble?: ElementRef<HTMLElement>;
  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private clientesService: ClientesService,
    private inmueblesService: InmueblesService,
    private catServiciosService: CatServiciosService,
    private pdfOcrService: PdfOcrService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initEstatusInmuebleLogic();
    this.formValueLogSub = this.inmuebleForm.valueChanges
      .pipe(debounceTime(this.debounceLogMs))
      .subscribe((value) => {
        console.log('[agregar-inmueble] valor del formulario (tras pausa de escritura)', value);
      });
    this.activatedRoute.params
      .pipe(
        switchMap((params) => {
          const raw = params['idInmueble'];
          const idInmueble =
            raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw))
              ? Number(raw)
              : undefined;

          if (idInmueble != null) {
            this.cargandoDetalle = true;
            this.abrirSwalCargando();
          }

          return forkJoin({
            params: of(params),
            idInmueble: of(idInmueble),
            clientes: this.clientesService.obtenerClientes().pipe(catchError(() => of(null))),
            catServicios: this.catServiciosService
              .obtenerServiciosPaginados(1, 30)
              .pipe(catchError(() => of(null))),
            detalle:
              idInmueble != null
                ? this.inmueblesService.obtenerInmueble(idInmueble).pipe(catchError((err) => of({ __error: err })))
                : of(null),
          }).pipe(
            finalize(() => {
              if (idInmueble != null) {
                Swal.close();
                this.cargandoDetalle = false;
              }
            }),
          );
        }),
      )
      .subscribe(({ idInmueble, clientes, catServicios, detalle }) => {
        this.asignarListaClientes(clientes);
        if (catServicios != null) {
          this.listaCatServicios = this.extraerFilasCatServicios(catServicios);
        }

        this.idInmueble = idInmueble;
        if (idInmueble != null) {
          this.title = 'Actualizar Inmueble';
          this.submitButton = 'Actualizar';
          const err = (detalle as { __error?: unknown } | null)?.__error;
          if (err) {
            void Swal.fire({
              title: 'No se pudo cargar el inmueble',
              text: 'No fue posible obtener la información. Intente de nuevo.',
              icon: 'error',
              confirmButtonColor: '#3085d6',
              background: '#141a21',
              color: '#ffffff',
            });
            void this.router.navigateByUrl('/inmuebles');
            return;
          }
          if (detalle != null) {
            this.poblarFormularioDesdeApi(extraerInmuebleDetalleApi(detalle));
          }
          return;
        }

        this.title = 'Agregar Inmueble';
        this.submitButton = 'Guardar';
        this.mostrarPromptAutocargaContrato();
      });
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

  ngOnDestroy(): void {
    this.formValueLogSub?.unsubscribe();
  }

  private mostrarPromptAutocargaContrato(): void {
    if (this.promptAutocargaMostrado) return;
    this.promptAutocargaMostrado = true;
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: '¿Quieres Intentar Completar El Formulario Con Un Archivo?',
      text: 'Te llevaremos a la sección de Constancia de Situación Fiscal para subir el PDF y extraer algunos datos.',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, Llevarme',
      cancelButtonText: 'No, Continuar Manualmente',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.autocargaCsfPendiente = true;
      this.enfocarAutocargaCsf();
    });
  }

  /** Mismo scroll suave que «Sí, Llévame» (`scrollIntoView`). */
  private scrollSuaveAElemento(
    elemento: HTMLElement | undefined,
    block: ScrollLogicalPosition,
  ): void {
    if (!elemento) return;
    setTimeout(() => {
      elemento.scrollIntoView({ behavior: 'smooth', block });
    }, 120);
  }

  private enfocarAutocargaCsf(): void {
    const csfCard = this.autocargaCsfCardInmueble?.nativeElement;
    if (csfCard) {
      this.scrollSuaveAElemento(csfCard, 'center');
      this.resaltarAutocargaContrato = true;
      return;
    }
    const docs = this.docsSectionInmueble?.nativeElement;
    if (!docs) return;
    this.scrollSuaveAElemento(docs, 'center');
    this.resaltarAutocargaDocs = true;
  }

  /** Tras OK del OCR: mismo scroll que «Sí, Llévame», hacia arriba (inicio del formulario). */
  private scrollArribaTrasOcrExitoso(): void {
    const arriba =
      this.topFormularioInmueble?.nativeElement ??
      this.inicioFormularioInmueble?.nativeElement;
    this.scrollSuaveAElemento(arriba, 'start');
  }

  private initForm(): void {
    this.inmuebleForm = this.fb.group({
      nombreInmueble: ['', Validators.required],
      rentaMxn: [''],
      direccionInmueble: ['', Validators.required],
      vigenciaAnios: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      idArrendador: [null as number | null, Validators.required],
      tiempoRentaAnios: [''],
      estatusInmueble: [null as string | null, Validators.required],
      nombreRepresentanteLegal: ['', Validators.required],
      telefonoRepresentanteLegal: ['', Validators.required],
      correoRepresentanteLegal: ['', [Validators.required, Validators.email]],
      documentoEscritura: [null],
      documentoBoletaPredial: [null],
      documentoReciboAguaServicios: [null],
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
      estacionamientos: this.fb.array([]),
      pagos: this.fb.array([]),
      socios: this.fb.array([]),
      locales: this.fb.array([]),
      lat: [''],
      lng: [''],
    });
  }

  private initEstatusInmuebleLogic(): void {
    const estatusCtrl = this.inmuebleForm.get('estatusInmueble');
    if (!estatusCtrl) return;

    this.aplicarValidadoresEstatus(estatusCtrl.value);
    estatusCtrl.valueChanges.subscribe((value) => this.aplicarValidadoresEstatus(value));
  }

  /** Renta y tiempo de renta solo obligatorios si el estatus es Rentado. */
  private aplicarValidadoresEstatus(raw: unknown): void {
    const v = String(raw ?? '').toUpperCase().trim();
    const rentado = v === 'RENTADO';
    this.mostrarCamposRenta = rentado;

    const rentaCtrl = this.inmuebleForm.get('rentaMxn');
    const tiempoCtrl = this.inmuebleForm.get('tiempoRentaAnios');
    const contratoCtrl = this.inmuebleForm.get('documentoContratoRenta');
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
    }

    rentaCtrl.updateValueAndValidity({ emitEvent: false });
    tiempoCtrl.updateValueAndValidity({ emitEvent: false });
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
      idTipoServicio: [null as number | null, Validators.required],
      servicioNumeroContrato: ['', Validators.required],
      servicioFechaPago: ['', Validators.required],
      servicioUltimoDiaPago: ['', Validators.required],
      servicioComprobantePago: [null],
      servicioComprobantePagoNombre: [''],
      servicioComprobantePagoUrl: [''],
    });
  }

  private crearZonaFormGroup(): FormGroup {
    return this.fb.group({
      zonaPrincipal: ['', Validators.required],
      zonaSuperficieM2: ['', Validators.required],
      superficieDisponiblePredioM2: ['', Validators.required],
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
      nombreLocal: [''],
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

  etiquetaCatServicio(item: CatServicioItem): string {
    const nombre = item.nombre ?? item.servicio ?? item.descripcion;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Servicio ${item.id}`;
  }

  private cargarCatalogoServicios(): void {
    this.catServiciosService.obtenerServiciosPaginados(1, 30).subscribe({
      next: (res) => {
        this.listaCatServicios = this.extraerFilasCatServicios(res);
      },
      error: () => {
        this.listaCatServicios = [];
      },
    });
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
      servicioComprobantePagoUrl: '',
    });
    if (input) input.value = '';
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

  verArchivoRemoto(url: string | null | undefined, titulo: string): void {
    if (!url?.trim()) return;
    const subtitulo = String(this.inmuebleForm.get('nombreInmueble')?.value ?? '').trim();
    this.docPreview?.abrir(url, titulo, subtitulo);
  }

  /** Edición por id con archivo ya guardado en el servidor (URL remota). */
  layoutArchivoRemoto(url: string | null | undefined): boolean {
    return this.idInmueble != null && !!String(url ?? '').trim();
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

    if (
      controlName === 'documentoConstanciaFiscal' &&
      file &&
      this.autocargaCsfPendiente
    ) {
      if (!this.esArchivoPdf(file)) {
        input.value = '';
        this.inmuebleForm.get(controlName)?.setValue(null);
        this.constanciaFiscalNombre = null;
        void Swal.fire({
          title: 'Solo se acepta PDF',
          text: 'Para completar el formulario automáticamente debes subir la Constancia de Situación Fiscal en formato PDF.',
          icon: 'warning',
          confirmButtonColor: '#3085d6',
          background: '#141a21',
          color: '#ffffff',
        });
        return;
      }
    }

    this.inmuebleForm.get(controlName)?.setValue(file);

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
      if (file && this.autocargaCsfPendiente) {
        this.procesarConstanciaFiscalOcr(file);
        return;
      }
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
    if (controlName === 'documentoReciboAguaServicios')
      this.reciboAguaServiciosNombre = name;
    if (controlName === 'documentoEscritura' && file) {
      this.resaltarAutocargaContrato = false;
      this.resaltarAutocargaDocs = false;
    }
  }

  private esArchivoPdf(file: File): boolean {
    const tipo = (file.type || '').toLowerCase();
    if (tipo === 'application/pdf') return true;
    return /\.pdf$/i.test(file.name || '');
  }

  /** Quita resaltados tras OCR; mantiene autocarga activa para reemplazar el PDF. */
  private finalizarAutocargaCsf(): void {
    this.resaltarAutocargaContrato = false;
    this.resaltarAutocargaDocs = false;
  }

  private completarOcrConstanciaExitoso(
    constancia: NonNullable<ReturnType<typeof extraerConstanciaDeRespuestaOcr>>,
  ): void {
    Swal.close();
    this.aplicarDatosConstanciaAlFormulario(mapearConstanciaAInmueble(constancia));
    this.finalizarAutocargaCsf();
    this.cdr.detectChanges();
    this.scrollArribaTrasOcrExitoso();
    void this.swalToastOcrExito.fire();
  }

  private aplicarDatosConstanciaAlFormulario(
    patch: ReturnType<typeof mapearConstanciaAInmueble>,
  ): void {
    if (patch.direccionInmueble) {
      this.inmuebleForm.patchValue({ direccionInmueble: patch.direccionInmueble });
    }
  }

  private mensajeErrorOcrHttp(err: unknown): string {
    const e = err as {
      error?: { message?: string };
      message?: string;
      status?: number;
    };
    const delApi = String(e?.error?.message ?? '').trim();
    if (delApi) return delApi;
    const generico = String(e?.message ?? '').trim();
    if (generico && !generico.startsWith('Http failure')) return generico;
    if (e?.status) return `El servidor respondió con el código ${e.status}.`;
    return 'No fue posible conectar con el servicio de lectura del PDF.';
  }

  private mostrarAlertaOcrFallido(detalleError: string): void {
    const detalle = detalleError.trim() || 'No se obtuvo un detalle del error.';
    void Swal.fire({
      title: 'No pudimos leer la constancia automáticamente',
      html: `
        <p style="margin:0 0 0.75rem;text-align:left;"><strong>Qué ocurrió:</strong> ${this.escapeHtmlSwal(detalle)}</p>
        <p style="margin:0;text-align:left;">
          Tu PDF de la constancia <strong>sigue adjunto</strong> en el formulario y se enviará al guardar como siempre.
          Por favor, continúa capturando los datos <strong>a mano</strong>; cuando termines, podrás guardar con normalidad.
        </p>
      `,
      icon: 'info',
      confirmButtonText: 'Entendido, continuaré manualmente',
      confirmButtonColor: '#3085d6',
      background: '#141a21',
      color: '#ffffff',
    });
  }

  private escapeHtmlSwal(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private procesarConstanciaFiscalOcr(file: File): void {
    if (this.procesandoConstanciaOcr) return;
    this.procesandoConstanciaOcr = true;

    void Swal.fire({
      title: 'Leyendo constancia fiscal…',
      text: 'Extrayendo datos del PDF, por favor espera.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#141a21',
      color: '#ffffff',
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.pdfOcrService
      .extraerConstanciaFiscal(file)
      .pipe(
        finalize(() => {
          this.procesandoConstanciaOcr = false;
        }),
      )
      .subscribe({
        next: (res) => {
          const constancia = extraerConstanciaDeRespuestaOcr(res);
          if (String(res?.status ?? '').toLowerCase() !== 'success' || !constancia) {
            Swal.close();
            this.finalizarAutocargaCsf();
            this.mostrarAlertaOcrFallido(
              res?.message ||
                'El servicio no devolvió información usable de la constancia fiscal.',
            );
            return;
          }

          this.completarOcrConstanciaExitoso(constancia);
        },
        error: (err) => {
          Swal.close();
          this.finalizarAutocargaCsf();
          this.mostrarAlertaOcrFallido(this.mensajeErrorOcrHttp(err));
        },
      });
  }

  private poblarFormularioDesdeApi(item: InmuebleApiItem): void {
    const estatusStr = estatusInmuebleDesdeApi(item.estatusInmueble);
    const renta =
      item.rentaMxn != null && String(item.rentaMxn).trim() !== ''
        ? item.rentaMxn
        : item.renta;
    const tiempoRenta =
      item.tiempoRentaAnios != null && String(item.tiempoRentaAnios).trim() !== ''
        ? item.tiempoRentaAnios
        : item.tiempoRenta;

    const idArrendador = idArrendadorDesdeApi(item);

    this.inmuebleForm.patchValue(
      {
        nombreInmueble: String(item.inmueble ?? '').trim(),
        direccionInmueble: String(item.direccionFiscal ?? '').trim(),
        idArrendador,
        estatusInmueble: estatusStr,
        rentaMxn: renta ?? '',
        tiempoRentaAnios: tiempoRenta ?? '',
        vigenciaAnios: item.vigenciaAnios != null ? String(item.vigenciaAnios) : '',
        fechaInicio: fechaParaInputDate(item.fechaInicio),
        fechaFin: fechaParaInputDate(item.fechaFin),
        nombreRepresentanteLegal: String(item.nombreRepresentante ?? '').trim(),
        telefonoRepresentanteLegal: String(item.telefonoRepresentante ?? '').trim(),
        correoRepresentanteLegal: String(item.correoRepresentante ?? '').trim(),
        lat: item.lat != null ? String(item.lat) : '',
        lng: item.lng != null ? String(item.lng) : '',
      },
      { emitEvent: false },
    );

    if (item.lat != null && item.lng != null) {
      this.latSeleccionada = Number(item.lat);
      this.lngSeleccionada = Number(item.lng);
    }

    this.aplicarValidadoresEstatus(estatusStr);
    this.inmuebleForm.updateValueAndValidity({ emitEvent: false });

    this.rellenarServiciosDesdeApi(item.servicios);
    this.rellenarZonasDesdeApi(item.zonas);
    const { documentos, galeria } = separarArchivosInmueble(item.archivos, item.imagenes);
    this.rellenarGaleriaDesdeApi(galeria);
    this.asignarDocumentosDesdeApi(documentos);
  }

  private rellenarServiciosDesdeApi(servicios?: InmuebleServicioApi[]): void {
    const arr = this.serviciosFormArray;
    arr.clear();
    const lista = Array.isArray(servicios) ? servicios : [];
    if (!lista.length) {
      arr.push(this.crearServicioFormGroup());
      return;
    }
    lista.forEach((s) => {
      const g = this.crearServicioFormGroup();
      const nombreComprobante = this.nombreArchivoDesdeUrl(s.urlComprobante, 'Comprobante de pago');
      g.patchValue(
        {
          idTipoServicio: s.idTipoServicio != null ? Number(s.idTipoServicio) : null,
          servicioNumeroContrato: s.numeroContrato ?? '',
          servicioFechaPago: fechaParaInputDate(s.fechaPago),
          servicioUltimoDiaPago: fechaParaInputDate(s.ultimoDiaPago),
          servicioComprobantePago: null,
          servicioComprobantePagoNombre: nombreComprobante,
          servicioComprobantePagoUrl: s.urlComprobante?.trim() ?? '',
        },
        { emitEvent: false },
      );
      arr.push(g);
    });
  }

  private rellenarZonasDesdeApi(zonas?: InmuebleZonaApi[]): void {
    const arr = this.zonasFormArray;
    arr.clear();
    const lista = Array.isArray(zonas) ? zonas : [];
    if (!lista.length) {
      arr.push(this.crearZonaFormGroup());
      return;
    }
    lista.forEach((z) => {
      const g = this.crearZonaFormGroup();
      g.patchValue(
        {
          zonaPrincipal: z.zonaPrincipal ?? '',
          zonaSuperficieM2: z.superficieZonaM2 ?? '',
          superficieDisponiblePredioM2: z.superficieDisponibleM2 ?? '',
        },
        { emitEvent: false },
      );
      arr.push(g);
    });
  }

  private rellenarGaleriaDesdeApi(imagenes: InmuebleArchivoApi[]): void {
    const arr = this.galeriaImagenesFormArray;
    arr.clear();
    const lista = Array.isArray(imagenes) ? imagenes : [];
    if (!lista.length) {
      arr.push(this.crearGaleriaImagenFormGroup());
      return;
    }
    lista.forEach((img) => {
      const g = this.crearGaleriaImagenFormGroup();
      g.patchValue(
        {
          archivo: null,
          nombre: img.nombre || this.nombreArchivoDesdeUrl(img.url, 'Imagen'),
          url: img.url?.trim() ?? '',
        },
        { emitEvent: false },
      );
      arr.push(g);
    });
  }

  private asignarDocumentosDesdeApi(
    documentos: Partial<Record<SlotDocumentoInmueble, InmuebleArchivoApi>>,
  ): void {
    this.limpiarArchivosRemotos();
    const asignar = (slot: SlotDocumentoInmueble, archivo?: InmuebleArchivoApi): void => {
      if (!archivo?.url?.trim()) return;
      const nombre = archivo.nombre || this.nombreArchivoDesdeUrl(archivo.url, 'Documento');
      const url = archivo.url.trim();
      switch (slot) {
        case 'licencia':
          this.imagenLicenciaNombre = nombre;
          this.imagenLicenciaUrl = url;
          break;
        case 'fachada':
          this.imagenPlanoNombre = nombre;
          this.imagenPlanoUrl = url;
          break;
        case 'contratoRenta':
          this.contratoRentaNombre = nombre;
          this.contratoRentaUrl = url;
          break;
        case 'constanciaFiscal':
          this.constanciaFiscalNombre = nombre;
          this.constanciaFiscalUrl = url;
          break;
        case 'comprobanteDomicilio':
          this.comprobanteDomicilioNombre = nombre;
          this.comprobanteDomicilioUrl = url;
          break;
        case 'escritura':
          this.archivoEscrituraNombre = nombre;
          this.archivoEscrituraUrl = url;
          break;
        case 'boletaPredial':
          this.boletaPredialNombre = nombre;
          this.boletaPredialUrl = url;
          break;
        case 'constanciaRepLegal':
          this.constanciaRepLegalNombre = nombre;
          this.constanciaRepLegalUrl = url;
          break;
        case 'ineRepresentante':
          this.ineRepresentanteNombre = nombre;
          this.ineRepresentanteUrl = url;
          break;
        default:
          break;
      }
    };

    (Object.keys(documentos) as SlotDocumentoInmueble[]).forEach((slot) => {
      asignar(slot, documentos[slot]);
    });
  }

  private limpiarArchivosRemotos(): void {
    this.archivoEscrituraNombre = null;
    this.imagenLicenciaNombre = null;
    this.imagenPlanoNombre = null;
    this.contratoRentaNombre = null;
    this.constanciaFiscalNombre = null;
    this.constanciaRepLegalNombre = null;
    this.comprobanteDomicilioNombre = null;
    this.ineRepresentanteNombre = null;
    this.boletaPredialNombre = null;
    this.archivoEscrituraUrl = null;
    this.imagenLicenciaUrl = null;
    this.imagenPlanoUrl = null;
    this.contratoRentaUrl = null;
    this.constanciaFiscalUrl = null;
    this.constanciaRepLegalUrl = null;
    this.comprobanteDomicilioUrl = null;
    this.ineRepresentanteUrl = null;
    this.boletaPredialUrl = null;
  }

  private nombreArchivoDesdeUrl(url?: string, fallback = 'Archivo'): string {
    if (!url?.trim()) return fallback;
    const sinQuery = url.split('?')[0];
    const parte = sinQuery.split('/').pop();
    return parte?.trim() || fallback;
  }

  submit(): void {
    if (!this.validarFormularioAntesMapa()) return;

    if (this.idInmueble != null) {
      if (this.tieneCoordenadasEnFormulario()) {
        this.ejecutarActualizacionInmueble();
      } else {
        this.abrirModalMapaParaGuardar();
      }
      return;
    }

    this.abrirModalMapaParaGuardar();
  }

  private tieneCoordenadasEnFormulario(): boolean {
    const lat = Number(this.inmuebleForm.get('lat')?.value);
    const lng = Number(this.inmuebleForm.get('lng')?.value);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  }

  private validarFormularioAntesMapa(): boolean {
    this.aplicarValidadoresEstatus(this.inmuebleForm.get('estatusInmueble')?.value);

    this.inmuebleForm.markAllAsTouched();
    this.serviciosFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());
    this.zonasFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());

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
          Faltan los siguientes campos obligatorios. Las imágenes y documentos son opcionales.
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

  private recopilarCamposFaltantes(): string[] {
    const faltantes: string[] = [];

    Object.keys(this.inmuebleForm.controls).forEach((key) => {
      if (this.controlesExcluidosValidacion.has(key)) return;
      if (!this.mostrarCamposRenta && (key === 'rentaMxn' || key === 'tiempoRentaAnios')) return;

      const control = this.inmuebleForm.get(key);
      if (!control || control.disabled) return;
      if (control.invalid) {
        faltantes.push(this.etiquetasCampos[key] ?? key);
      }
    });

    const etiquetasServicio: Record<string, string> = {
      idTipoServicio: 'Tipo de servicio',
      servicioNumeroContrato: 'Número de contrato',
      servicioFechaPago: 'Fecha de pago',
      servicioUltimoDiaPago: 'Último día de pago',
    };
    this.serviciosFormArray.controls.forEach((ctrl, i) => {
      const g = ctrl as FormGroup;
      Object.keys(g.controls).forEach((key) => {
        if (key === 'servicioComprobantePago' || key === 'servicioComprobantePagoNombre') return;
        const c = g.get(key);
        if (c?.invalid) {
          faltantes.push(`Servicio ${i + 1}: ${etiquetasServicio[key] ?? key}`);
        }
      });
    });

    const etiquetasZona: Record<string, string> = {
      zonaPrincipal: 'Zona principal',
      zonaSuperficieM2: 'Superficie de zona (m²)',
      superficieDisponiblePredioM2: 'Superficie disponible predio (m²)',
    };
    this.zonasFormArray.controls.forEach((ctrl, i) => {
      const g = ctrl as FormGroup;
      Object.keys(g.controls).forEach((key) => {
        const c = g.get(key);
        if (c?.invalid) {
          faltantes.push(`Zona ${i + 1}: ${etiquetasZona[key] ?? key}`);
        }
      });
    });

    return faltantes;
  }

  private ejecutarActualizacionInmueble(): void {
    if (this.idInmueble == null) return;
    this.loadingSubmit = true;
    const inicioPeticion = Date.now();
    this.abrirSwalCargando();
    const fd = this.construirFormDataInmueble();
    this.inmueblesService.actualizarInmueble(this.idInmueble, fd).subscribe({
      next: () => {
        this.cerrarSwalCargandoYRedirigirInmuebles(inicioPeticion);
      },
      error: (err: unknown) => {
        Swal.close();
        this.loadingSubmit = false;
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo actualizar el inmueble. Verifique la información e intente de nuevo.';
        Swal.fire({
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

  private ejecutarCreacionInmueble(): void {
    this.loadingSubmit = true;
    const inicioPeticion = Date.now();
    this.abrirSwalCargando();
    const fd = this.construirFormDataInmueble();
    this.inmueblesService.crearInmueble(fd).subscribe({
      next: () => {
        this.cerrarSwalCargandoYRedirigirInmuebles(inicioPeticion);
      },
      error: (err: unknown) => {
        Swal.close();
        this.loadingSubmit = false;
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo registrar el inmueble. Verifique la información e intente de nuevo.';
        Swal.fire({
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

  /** Oculta el spinner tras al menos 2 s desde el inicio y navega a la lista. */
  private cerrarSwalCargandoYRedirigirInmuebles(inicioPeticion: number): void {
    const restanteMs = Math.max(0, 2000 - (Date.now() - inicioPeticion));
    setTimeout(() => {
      Swal.close();
      this.loadingSubmit = false;
      void this.router.navigateByUrl('/inmuebles');
    }, restanteMs);
  }

  /** Entero en FormData: solo dígitos (evita `""` o decimales en campos int del API). */
  private appendEntero(fd: FormData, key: string, value: unknown): void {
    if (value == null || value === '') return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    fd.append(key, String(Math.trunc(n)));
  }

  /** Decimal en FormData (p. ej. m²). */
  private appendValorNumerico(fd: FormData, key: string, value: unknown): void {
    if (value == null || value === '') return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    fd.append(key, String(n));
  }

  /**
   * Arma el cuerpo multipart alineado con POST `/inmuebles`:
   * escalares, `servicios[i].*`, `zonas[i].*`, `archivos[i].*`, `imagenes[i].*`.
   */
  private construirFormDataInmueble(): FormData {
    const fd = new FormData();
    const v = this.inmuebleForm.getRawValue() as Record<string, unknown>;

    fd.append('inmueble', String(v['nombreInmueble'] ?? '').trim());
    this.appendEntero(fd, 'idArrendador', v['idArrendador']);

    const dirFiscal = String(v['direccionInmueble'] ?? '').trim();
    if (dirFiscal) fd.append('direccionFiscal', dirFiscal);

    const estatusNum = this.estatusInmuebleANumero(v['estatusInmueble']);
    if (estatusNum != null) this.appendEntero(fd, 'estatusInmueble', estatusNum);

    const vig = v['vigenciaAnios'];
    if (vig != null && String(vig).trim() !== '') fd.append('vigenciaAnios', String(vig).trim());

    const fi = String(v['fechaInicio'] ?? '').trim();
    if (fi) fd.append('fechaInicio', fi);
    const ff = String(v['fechaFin'] ?? '').trim();
    if (ff) fd.append('fechaFin', ff);

    const nomRep = String(v['nombreRepresentanteLegal'] ?? '').trim();
    if (nomRep) fd.append('nombreRepresentante', nomRep);
    const telRep = String(v['telefonoRepresentanteLegal'] ?? '').trim();
    if (telRep) fd.append('telefonoRepresentante', telRep);
    const mailRep = String(v['correoRepresentanteLegal'] ?? '').trim();
    if (mailRep) fd.append('correoRepresentante', mailRep);

    this.appendValorNumerico(fd, 'lat', v['lat']);
    this.appendValorNumerico(fd, 'lng', v['lng']);

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

    let zi = 0;
    this.zonasFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      const zp = String(g.get('zonaPrincipal')?.value ?? '').trim();
      const supZ = g.get('zonaSuperficieM2')?.value;
      const supD = g.get('superficieDisponiblePredioM2')?.value;
      const zonaVacia =
        !zp &&
        (supZ === '' || supZ == null) &&
        (supD === '' || supD == null);
      if (zonaVacia) return;

      if (zp) fd.append(`zonas[${zi}].zonaPrincipal`, zp);
      if (supZ !== '' && supZ != null && Number.isFinite(Number(supZ))) {
        this.appendValorNumerico(fd, `zonas[${zi}].superficieZonaM2`, supZ);
      }
      if (supD !== '' && supD != null && Number.isFinite(Number(supD))) {
        this.appendValorNumerico(fd, `zonas[${zi}].superficieDisponibleM2`, supD);
      }
      this.appendEntero(fd, `zonas[${zi}].numeroZona`, zi + 1);
      zi += 1;
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
    pushArchivo(v['constanciaSituacionFiscalRepresentanteLegal'], 'Constancia fiscal representante legal');
    pushArchivo(v['ineRepresentanteLegal'], 'Identificación oficial representante legal');

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

    return fd;
  }

  private estatusInmuebleANumero(raw: unknown): number | null {
    const s = String(raw ?? '').toUpperCase().trim();
    if (s === 'RENTADO') return 1;
    if (s === 'PROPIO') return 2;
    if (raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw))) {
      return Number(raw);
    }
    return null;
  }

  regresar(): void {
    void this.router.navigateByUrl('/inmuebles');
  }

  /** Abre el mapa desde el botón de ubicación (conserva lat/lng del formulario si existen). */
  abrirModalMapa(): void {
    this.mostrarModalMapa = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      void this.loadGoogleMaps()
        .then(() => this.initMapModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 100);
  }

  /** Tras validar el formulario: mapa obligatorio antes de POST. */
  private abrirModalMapaParaGuardar(): void {
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.mostrarModalMapa = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      void this.loadGoogleMaps()
        .then(() => this.initMapModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 100);
  }

  /** Solo vía botón Cancelar: cierra y reinicia el mapa sin guardar. */
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
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Selecciona una ubicación',
        text: 'Debes hacer clic en el mapa para marcar latitud y longitud antes de guardar.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    this.inmuebleForm.patchValue({
      lat: this.latSeleccionada,
      lng: this.lngSeleccionada,
    });
    this.limpiarEstadoMapaModal();
    if (this.idInmueble != null) {
      this.ejecutarActualizacionInmueble();
    } else {
      this.ejecutarCreacionInmueble();
    }
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

    this.map = new w.google.maps.Map(mapElement, {
      center: { lat, lng },
      zoom,
    });

    if (this.latSeleccionada != null && this.lngSeleccionada != null) {
      this.actualizarMarcador({ lat: this.latSeleccionada, lng: this.lngSeleccionada });
    } else if (tieneCoordsGuardadas) {
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
