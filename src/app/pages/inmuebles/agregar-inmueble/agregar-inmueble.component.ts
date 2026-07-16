import { animate, style, transition, trigger } from '@angular/animations';
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
  InmuebleLocalApi,
  InmuebleServicioApi,
  InmuebleZonaApi,
  separarArchivosInmueble,
  archivosImagenGaleriaInmueble,
  urlArchivoNavegador,
  SlotDocumentoInmueble,
  urlFachadaLocal,
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

/** Estado inicial al editar (GET por id); el PUT solo envía lo que cambió. */
interface SnapshotServicioEdicion {
  id: number;
  idTipoServicio: number | null;
  numeroContrato: string;
  fechaPago: string;
  ultimoDiaPago: string;
  urlComprobante: string;
}

interface SnapshotLocalEdicion {
  id: number;
  nombre: string;
  areaM2: string;
  estatus: number | null;
  mensualidad: string;
  mantenimientoSinIva: string;
  aplicaIva: number;
  rentaConIva: string;
  mantenimientoConIva: string;
  giro: string;
  fachadaUrl: string;
}

interface SnapshotZonaEdicion {
  id: number;
  zonaPrincipal: string;
  zonaSuperficieM2: string;
  superficieDisponiblePredioM2: string;
  numeroZona: number | null;
  locales: SnapshotLocalEdicion[];
}

interface SnapshotArchivoEdicion {
  id: number;
  nombre: string;
  url: string;
}

interface SnapshotEscalaresEdicion {
  inmueble: string;
  idArrendador: number | null;
  direccionFiscal: string;
  estatusInmueble: string | null;
  vigenciaAnios: string;
  fechaInicio: string;
  fechaFin: string;
  nombreRepresentanteLegal: string;
  telefonoRepresentanteLegal: string;
  correoRepresentanteLegal: string;
  lat: string;
  lng: string;
}

interface SnapshotEdicionInmueble {
  escalares: SnapshotEscalaresEdicion;
  servicios: SnapshotServicioEdicion[];
  zonas: SnapshotZonaEdicion[];
  slotsDocumento: Partial<Record<SlotDocumentoInmueble, SnapshotArchivoEdicion>>;
  galeria: SnapshotArchivoEdicion[];
}

@Component({
  selector: 'app-agregar-inmueble',
  templateUrl: './agregar-inmueble.component.html',
  styleUrl: './agregar-inmueble.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    trigger('camposRentaReveal', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px) scale(0.97)' }),
        animate(
          '340ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '220ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateY(-14px) scale(0.98)' }),
        ),
      ]),
    ]),
  ],
})
export class AgregarInmuebleComponent implements OnInit, OnDestroy {
  private static readonly IVA_LOCAL = 0.16;

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
  /** SweetAlert de guardado activo tras confirmar ubicación en el mapa. */
  private swalGuardadoInmuebleActivo = false;
  public cargandoDetalle = false;
  public mostrarCamposRenta = false;
  /** Fachada y galería: solo imágenes. Plano: imágenes o PDF (como licencia). */
  readonly acceptSoloImagenes = 'image/png,image/jpeg,image/jpg';
  readonly etiquetaSoloImagenes = 'PNG · JPG · JPEG';
  /** Resto de documentos y comprobantes. */
  readonly acceptPdfImagenes = 'application/pdf,image/png,image/jpeg,image/jpg';
  readonly etiquetaPdfImagenes = 'PDF · PNG · JPG · JPEG';
  readonly acceptSoloPdf = 'application/pdf';
  readonly etiquetaSoloPdf = 'PDF';
  archivoEscrituraNombre: string | null = null;
  imagenLicenciaFuncionamientoNombre: string | null = null;
  imagenUsoSueloNombre: string | null = null;
  imagenFachadaNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  contratoRentaNombre: string | null = null;
  constanciaFiscalNombre: string | null = null;
  constanciaRepLegalNombre: string | null = null;
  comprobanteDomicilioNombre: string | null = null;
  ineRepresentanteNombre: string | null = null;
  boletaPredialNombre: string | null = null;
  reciboAguaServiciosNombre: string | null = null;
  imagenLicenciaFuncionamientoUrl: string | null = null;
  imagenUsoSueloUrl: string | null = null;
  imagenFachadaUrl: string | null = null;
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
    lat: 'Latitud',
    lng: 'Longitud',
  };
  mostrarModalMapa = false;
  /** Copia al cargar edición; base para enviar solo cambios en PUT. */
  private snapshotEdicion: SnapshotEdicionInmueble | null = null;
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
  @ViewChild('imagenLicenciaFuncionamientoInput') imagenLicenciaFuncionamientoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenUsoSueloInput') imagenUsoSueloInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenFachadaInput') imagenFachadaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('imagenPlanoInput') imagenPlanoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('contratoRentaInput') contratoRentaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaFiscalInput') constanciaFiscalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaRepLegalInput') constanciaRepLegalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('comprobanteDomicilioInput') comprobanteDomicilioInput?: ElementRef<HTMLInputElement>;
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
          }          ).pipe(
            finalize(() => {
              if (idInmueble != null) {
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
        this.snapshotEdicion = null;
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
      direccionInmueble: [''],
      fechaInicio: [''],
      fechaFin: [''],
      idArrendador: [null as number | null, Validators.required],
      tiempoRentaAnios: [''],
      estatusInmueble: [null as string | null],
      nombreRepresentanteLegal: [''],
      telefonoRepresentanteLegal: [''],
      correoRepresentanteLegal: ['', Validators.email],
      documentoEscritura: [null],
      documentoBoletaPredial: [null],
      documentoReciboAguaServicios: [null],
      documentoLicenciaFuncionamiento: [null],
      documentoUsoSuelo: [null],
      documentoFachada: [null],
      documentoPlano: [null],
      documentoContratoRenta: [null],
      documentoConstanciaFiscal: [null],
      constanciaSituacionFiscalRepresentanteLegal: [null],
      documentoComprobanteDomicilio: [null],
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

  /** Muestra u oculta campos de renta según estatus; ninguno es obligatorio. */
  private aplicarValidadoresEstatus(raw: unknown): void {
    const v = String(raw ?? '').toUpperCase().trim();
    const rentado = v === 'RENTADO';
    this.mostrarCamposRenta = rentado;

    const rentaCtrl = this.inmuebleForm.get('rentaMxn');
    const tiempoCtrl = this.inmuebleForm.get('tiempoRentaAnios');
    const contratoCtrl = this.inmuebleForm.get('documentoContratoRenta');
    if (!rentaCtrl || !tiempoCtrl) return;

    if (!rentado) {
      rentaCtrl.setValue('', { emitEvent: false });
      tiempoCtrl.setValue('', { emitEvent: false });
      contratoCtrl?.setValue(null, { emitEvent: false });
      this.contratoRentaNombre = null;
    }

    rentaCtrl.clearValidators();
    tiempoCtrl.clearValidators();
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
    });
  }

  private crearGaleriaImagenFormGroup(): FormGroup {
    return this.fb.group({
      idArchivo: [null as number | null],
      archivo: [null],
      nombre: [''],
      url: [''],
    });
  }

  private crearServicioFormGroup(): FormGroup {
    return this.fb.group({
      idServicio: [null as number | null],
      idTipoServicio: [null as number | null],
      servicioNumeroContrato: [''],
      servicioFechaPago: [''],
      servicioUltimoDiaPago: [''],
      servicioComprobantePago: [null],
      servicioComprobantePagoNombre: [''],
      servicioComprobantePagoUrl: [''],
    });
  }

  private crearZonaFormGroup(): FormGroup {
    return this.fb.group({
      idZona: [null as number | null],
      zonaPrincipal: [''],
      zonaSuperficieM2: [''],
      superficieDisponiblePredioM2: [''],
      numeroZona: [null as number | null],
      locales: this.fb.array([this.crearLocalZonaFormGroup()]),
    });
  }

  /** Local anidado en `zonas[i].locales[j]` (POST multipart). */
  private crearLocalZonaFormGroup(): FormGroup {
    return this.fb.group({
      idLocal: [null as number | null],
      nombre: [''],
      areaM2: [''],
      estatus: [null],
      mensualidad: [''],
      mantenimientoSinIva: [''],
      aplicaIva: [0],
      rentaConIva: [''],
      mantenimientoConIva: [''],
      giro: [''],
      fachada: [null],
      fachadaNombre: [''],
      fachadaUrl: [''],
    });
  }

  localesZonaFormArray(zonaIndex: number): FormArray {
    return (this.zonasFormArray.at(zonaIndex) as FormGroup).get('locales') as FormArray;
  }

  agregarLocalZona(zonaIndex: number): void {
    this.localesZonaFormArray(zonaIndex).push(this.crearLocalZonaFormGroup());
    const nuevoIndex = this.localesZonaFormArray(zonaIndex).length - 1;
    this.localAccordionIndicesAbiertos[zonaIndex] = this.abrirIndiceAccordion(
      this.localAccordionIndicesAbiertosDeZona(zonaIndex),
      nuevoIndex,
    );
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

  /** Ítems expandidos en acordeones de arreglos dinámicos. */
  servicioAccordionIndicesAbiertos: number[] = [0];
  zonaAccordionIndicesAbiertos: number[] = [0];
  localAccordionIndicesAbiertos: Record<number, number[]> = { 0: [0] };

  onServicioAccordionIndicesChange(raw: number | number[]): void {
    if (Array.isArray(raw)) {
      this.servicioAccordionIndicesAbiertos = raw;
      return;
    }
    this.servicioAccordionIndicesAbiertos = raw >= 0 ? [raw] : [];
  }

  onZonaAccordionIndicesChange(raw: number | number[]): void {
    if (Array.isArray(raw)) {
      this.zonaAccordionIndicesAbiertos = raw;
      return;
    }
    this.zonaAccordionIndicesAbiertos = raw >= 0 ? [raw] : [];
  }

  onLocalAccordionIndicesChange(zonaIndex: number, raw: number | number[]): void {
    if (Array.isArray(raw)) {
      this.localAccordionIndicesAbiertos[zonaIndex] = raw;
      return;
    }
    this.localAccordionIndicesAbiertos[zonaIndex] = raw >= 0 ? [raw] : [];
  }

  localAccordionIndicesAbiertosDeZona(zonaIndex: number): number[] {
    if (!this.localAccordionIndicesAbiertos[zonaIndex]) {
      this.localAccordionIndicesAbiertos[zonaIndex] = [0];
    }
    return this.localAccordionIndicesAbiertos[zonaIndex];
  }

  tituloAccordionCaption(data: unknown): string {
    if (typeof data === 'string') return data;
    if (data != null && typeof data === 'object' && 'title' in data) {
      return String((data as { title: unknown }).title ?? '');
    }
    return '';
  }

  tituloServicioAccordion(index: number): string {
    const grupo = this.serviciosFormArray.at(index) as FormGroup;
    const idTipo = Number(grupo.get('idTipoServicio')?.value);
    const cat = this.listaCatServicios.find((x) => x.id === idTipo);
    const partes = [`Servicio ${index + 1}`];
    if (cat) partes.push(this.etiquetaCatServicio(cat));
    return partes.join(' | ');
  }

  /** Clave estable para el acordeón; evita recrear el ítem al cambiar campos del servicio. */
  claveEstableServicioAccordion(index: number): string {
    return `servicio-${index}`;
  }

  tituloServicioAccordionDesdeClave(data: unknown): string {
    const clave = this.tituloAccordionCaption(data);
    const match = /^servicio-(\d+)$/.exec(clave);
    if (!match) return clave;
    return this.tituloServicioAccordion(Number(match[1]));
  }

  tituloZonaAccordion(index: number): string {
    const grupo = this.zonasFormArray.at(index) as FormGroup;
    const nombre = String(grupo.get('zonaPrincipal')?.value ?? '').trim();
    const partes = [`Zona ${index + 1}`];
    if (nombre) partes.push(nombre);
    return partes.join(' | ');
  }

  /** Clave estable para el acordeón; evita recrear el ítem al escribir el nombre de la zona. */
  claveEstableZonaAccordion(index: number): string {
    return `zona-${index}`;
  }

  tituloZonaAccordionDesdeClave(data: unknown): string {
    const clave = this.tituloAccordionCaption(data);
    const match = /^zona-(\d+)$/.exec(clave);
    if (!match) return clave;
    return this.tituloZonaAccordion(Number(match[1]));
  }

  tituloLocalAccordion(zonaIndex: number, localIndex: number): string {
    const grupo = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup;
    const nombre = String(grupo.get('nombre')?.value ?? '').trim();
    const partes = [`Local ${localIndex + 1}`];
    if (nombre) partes.push(nombre);
    return partes.join(' | ');
  }

  /** Clave estable para el acordeón; evita recrear el ítem al escribir el nombre del local. */
  claveEstableLocalAccordion(zonaIndex: number, localIndex: number): string {
    return `local-${zonaIndex}-${localIndex}`;
  }

  tituloLocalAccordionDesdeClave(data: unknown): string {
    const clave = this.tituloAccordionCaption(data);
    const match = /^local-(\d+)-(\d+)$/.exec(clave);
    if (!match) return clave;
    return this.tituloLocalAccordion(Number(match[1]), Number(match[2]));
  }

  localAplicaIva(zonaIndex: number, localIndex: number): boolean {
    const g = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup | null;
    return Number(g?.get('aplicaIva')?.value) === 1;
  }

  localSwitchIvaHabilitado(zonaIndex: number, localIndex: number): boolean {
    const g = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup | null;
    if (!g) return false;
    const renta = Number(g.get('mensualidad')?.value);
    return Number.isFinite(renta) && renta > 0;
  }

  onLocalAplicaIvaClick(event: Event, zonaIndex: number, localIndex: number): void {
    event.stopPropagation();
    if (this.localSwitchIvaHabilitado(zonaIndex, localIndex)) return;
    event.preventDefault();
    this.forzarLocalAplicaIvaOffSiSinRenta(zonaIndex, localIndex);
  }

  onLocalAplicaIvaChange(zonaIndex: number, localIndex: number, activo: boolean): void {
    const g = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup;
    if (!g) return;
    if (!this.localSwitchIvaHabilitado(zonaIndex, localIndex)) {
      this.forzarLocalAplicaIvaOffSiSinRenta(zonaIndex, localIndex);
      return;
    }
    g.get('aplicaIva')?.setValue(activo ? 1 : 0, { emitEvent: false });
    if (!activo) {
      g.patchValue({ rentaConIva: '', mantenimientoConIva: '' }, { emitEvent: false });
    } else {
      this.recalcularMontosConIvaLocal(g);
    }
    this.cdr.markForCheck();
  }

  onLocalMontosSinIvaInput(zonaIndex: number, localIndex: number): void {
    const g = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup;
    if (!g) return;
    this.forzarLocalAplicaIvaOffSiSinRenta(zonaIndex, localIndex);
    if (Number(g.get('aplicaIva')?.value) === 1) {
      this.recalcularMontosConIvaLocal(g);
    }
  }

  private forzarLocalAplicaIvaOffSiSinRenta(zonaIndex: number, localIndex: number): void {
    if (this.localSwitchIvaHabilitado(zonaIndex, localIndex)) return;
    const g = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup;
    if (!g) return;
    if (Number(g.get('aplicaIva')?.value) === 0) {
      g.patchValue({ rentaConIva: '', mantenimientoConIva: '' }, { emitEvent: false });
      return;
    }
    g.patchValue(
      { aplicaIva: 0, rentaConIva: '', mantenimientoConIva: '' },
      { emitEvent: false },
    );
    this.cdr.markForCheck();
  }

  private redondearMontoLocal(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private recalcularMontosConIvaLocal(g: FormGroup): void {
    const rentaSin = Number(g.get('mensualidad')?.value);
    const mantSin = Number(g.get('mantenimientoSinIva')?.value);
    const patch: Record<string, string | number> = {};
    if (Number.isFinite(rentaSin) && rentaSin >= 0) {
      patch['rentaConIva'] = this.redondearMontoLocal(
        rentaSin * (1 + AgregarInmuebleComponent.IVA_LOCAL),
      );
    } else {
      patch['rentaConIva'] = '';
    }
    if (Number.isFinite(mantSin) && mantSin >= 0) {
      patch['mantenimientoConIva'] = this.redondearMontoLocal(
        mantSin * (1 + AgregarInmuebleComponent.IVA_LOCAL),
      );
    } else {
      patch['mantenimientoConIva'] = '';
    }
    g.patchValue(patch, { emitEvent: false });
  }

  private valorApiLocal(l: Record<string, unknown>, ...keys: string[]): unknown {
    for (const k of keys) {
      if (l[k] != null && String(l[k]).trim() !== '') return l[k];
    }
    return '';
  }

  private aplicaIvaDesdeApi(l: Record<string, unknown>): number {
    const raw = l['aplicaIva'] ?? l['AplicaIva'] ?? l['aplicaIVA'];
    if (raw === true || raw === 1 || raw === '1') return 1;
    if (raw === false || raw === 0 || raw === '0') return 0;
    const rentaCon = Number(
      this.valorApiLocal(l, 'mensualidadIva', 'rentaConIva', 'mensualidadConIva'),
    );
    const mantCon = Number(this.valorApiLocal(l, 'mantenimientoIva', 'mantenimientoConIva'));
    if ((Number.isFinite(rentaCon) && rentaCon > 0) || (Number.isFinite(mantCon) && mantCon > 0)) {
      return 1;
    }
    return 0;
  }

  trackServicioPorIndice(index: number): number {
    return index;
  }

  trackZonaPorIndice(index: number): number {
    return index;
  }

  trackLocalPorIndice(index: number): number {
    return index;
  }

  private abrirIndiceAccordion(indices: number[], nuevoIndex: number): number[] {
    const abiertos = new Set(indices);
    abiertos.add(nuevoIndex);
    return [...abiertos].sort((a, b) => a - b);
  }

  private reiniciarIndicesAccordionServicios(): void {
    this.servicioAccordionIndicesAbiertos =
      this.serviciosFormArray.length > 0
        ? Array.from({ length: this.serviciosFormArray.length }, (_, i) => i)
        : [];
  }

  private reiniciarIndicesAccordionZonas(): void {
    this.zonaAccordionIndicesAbiertos =
      this.zonasFormArray.length > 0
        ? Array.from({ length: this.zonasFormArray.length }, (_, i) => i)
        : [];
    const locales: Record<number, number[]> = {};
    for (let i = 0; i < this.zonasFormArray.length; i++) {
      const count = this.localesZonaFormArray(i).length;
      locales[i] =
        count > 0 ? Array.from({ length: count }, (_, j) => j) : [];
    }
    this.localAccordionIndicesAbiertos = locales;
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

  openSocioFilePicker(input: HTMLInputElement): void {
    input.click();
  }

  onSocioFileSelected(
    event: Event,
    index: number,
    field: 'socioConstanciaSituacionFiscal' | 'socioComprobanteDomicilio',
    nameField: 'socioConstanciaSituacionFiscalNombre' | 'socioComprobanteDomicilioNombre',
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
    const nuevoIndex = this.serviciosFormArray.length - 1;
    this.servicioAccordionIndicesAbiertos = this.abrirIndiceAccordion(
      this.servicioAccordionIndicesAbiertos,
      nuevoIndex,
    );
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

  agregarZona(): void {
    this.zonasFormArray.push(this.crearZonaFormGroup());
    const nuevoIndex = this.zonasFormArray.length - 1;
    this.zonaAccordionIndicesAbiertos = this.abrirIndiceAccordion(
      this.zonaAccordionIndicesAbiertos,
      nuevoIndex,
    );
    this.localAccordionIndicesAbiertos[nuevoIndex] = [0];
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

  onLocalFachadaFileSelected(event: Event, zonaIndex: number, localIndex: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.localesZonaFormArray(zonaIndex).at(localIndex) as FormGroup;
    group.patchValue({
      fachada: file,
      fachadaNombre: file?.name ?? '',
      fachadaUrl: '',
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
    const urlSegura = urlArchivoNavegador(url);
    if (!urlSegura) return;
    const subtitulo = String(this.inmuebleForm.get('nombreInmueble')?.value ?? '').trim();
    this.docPreview?.abrir(urlSegura, titulo, subtitulo);
  }

  /** Edición por id con archivo ya guardado en el servidor (URL remota). */
  layoutArchivoRemoto(url: string | null | undefined): boolean {
    return this.idInmueble != null && !!String(url ?? '').trim();
  }

  abrirSelectorArchivo(
    ref:
      | 'escritura'
      | 'licenciaFuncionamiento'
      | 'usoSuelo'
      | 'fachada'
      | 'plano'
      | 'contratoRenta'
      | 'constanciaFiscal'
      | 'constanciaRepLegal'
      | 'comprobanteDomicilio'
      | 'ineRepresentante'
      | 'boletaPredial'
      | 'reciboAgua',
  ): void {
    const map = {
      escritura: this.archivoEscrituraInput,
      boletaPredial: this.boletaPredialInput,
      reciboAgua: this.reciboAguaServiciosInput,
      licenciaFuncionamiento: this.imagenLicenciaFuncionamientoInput,
      usoSuelo: this.imagenUsoSueloInput,
      fachada: this.imagenFachadaInput,
      plano: this.imagenPlanoInput,
      contratoRenta: this.contratoRentaInput,
      constanciaFiscal: this.constanciaFiscalInput,
      constanciaRepLegal: this.constanciaRepLegalInput,
      comprobanteDomicilio: this.comprobanteDomicilioInput,
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
    if (controlName === 'documentoLicenciaFuncionamiento') {
      this.imagenLicenciaFuncionamientoNombre = name;
      this.imagenLicenciaFuncionamientoUrl = null;
    }
    if (controlName === 'documentoUsoSuelo') {
      this.imagenUsoSueloNombre = name;
      this.imagenUsoSueloUrl = null;
    }
    if (controlName === 'documentoFachada') {
      this.imagenFachadaNombre = name;
      this.imagenFachadaUrl = null;
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
      item.vigenciaAnios != null && String(item.vigenciaAnios).trim() !== ''
        ? item.vigenciaAnios
        : item.tiempoRentaAnios != null && String(item.tiempoRentaAnios).trim() !== ''
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
    const { documentos } = separarArchivosInmueble(item.archivos, item.imagenes);
    this.rellenarGaleriaDesdeApi(archivosImagenGaleriaInmueble(item));
    this.asignarDocumentosDesdeApi(documentos);
    this.capturarSnapshotEdicion(item, documentos, archivosImagenGaleriaInmueble(item));
    this.cdr.detectChanges();
  }

  private rellenarServiciosDesdeApi(servicios?: InmuebleServicioApi[]): void {
    const arr = this.serviciosFormArray;
    arr.clear();
    const lista = Array.isArray(servicios) ? servicios : [];
    if (!lista.length) {
      arr.push(this.crearServicioFormGroup());
      this.reiniciarIndicesAccordionServicios();
      return;
    }
    lista.forEach((s) => {
      const g = this.crearServicioFormGroup();
      const nombreComprobante = this.nombreArchivoDesdeUrl(s.urlComprobante, 'Comprobante de pago');
      const idServ = Number(s.id);
      g.patchValue(
        {
          idServicio: Number.isFinite(idServ) && idServ > 0 ? idServ : null,
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
    this.reiniciarIndicesAccordionServicios();
  }

  private rellenarLocalesZonaDesdeApi(zonaGroup: FormGroup, localesApi: unknown): void {
    const arr = zonaGroup.get('locales') as FormArray;
    arr.clear();
    const lista = Array.isArray(localesApi) ? localesApi : [];
    if (!lista.length) {
      arr.push(this.crearLocalZonaFormGroup());
      return;
    }
    lista.forEach((raw) => {
      if (raw == null || typeof raw !== 'object') return;
      const l = raw as Record<string, unknown>;
      const g = this.crearLocalZonaFormGroup();
      const estatusRaw = l['estatus'];
      const estatusNum =
        estatusRaw != null && estatusRaw !== '' && Number.isFinite(Number(estatusRaw))
          ? Number(estatusRaw)
          : null;
      const idLocal = Number(l['id']);
      const fachadaUrl = this.urlFachadaLocalDesdeApi(l);
      g.patchValue(
        {
          idLocal: Number.isFinite(idLocal) && idLocal > 0 ? idLocal : null,
          nombre: l['nombre'] != null ? String(l['nombre']) : '',
          areaM2: l['areaM2'] ?? l['superficieM2'] ?? '',
          estatus: estatusNum,
          mensualidad: this.valorApiLocal(l, 'mensualidad', 'mensualidadMxn', 'rentaSinIva'),
          mantenimientoSinIva: this.valorApiLocal(
            l,
            'mantenimiento',
            'mantenimientoSinIva',
            'mantenimientoMxn',
          ),
          aplicaIva: this.aplicaIvaDesdeApi(l),
          rentaConIva: this.valorApiLocal(l, 'mensualidadIva', 'rentaConIva', 'mensualidadConIva'),
          mantenimientoConIva: this.valorApiLocal(l, 'mantenimientoIva', 'mantenimientoConIva'),
          giro: l['giro'] != null ? String(l['giro']) : '',
          fachada: null,
          fachadaNombre: fachadaUrl
            ? this.nombreArchivoDesdeUrl(fachadaUrl, 'Fachada')
            : '',
          fachadaUrl,
        },
        { emitEvent: false },
      );
      if (Number(g.get('aplicaIva')?.value) === 1) {
        const rentaCon = g.get('rentaConIva')?.value;
        const mantCon = g.get('mantenimientoConIva')?.value;
        const faltaCalc =
          (rentaCon === '' || rentaCon == null) && (mantCon === '' || mantCon == null);
        if (faltaCalc) this.recalcularMontosConIvaLocal(g);
      }
      arr.push(g);
    });
    if (!arr.length) {
      arr.push(this.crearLocalZonaFormGroup());
    }
  }

  private rellenarZonasDesdeApi(zonas?: InmuebleZonaApi[]): void {
    const arr = this.zonasFormArray;
    arr.clear();
    const lista = Array.isArray(zonas) ? zonas : [];
    if (!lista.length) {
      arr.push(this.crearZonaFormGroup());
      this.reiniciarIndicesAccordionZonas();
      return;
    }
    lista.forEach((z) => {
      const g = this.crearZonaFormGroup();
      const idZona = Number(z.id);
      const numZona = z.numeroZona != null ? Number(z.numeroZona) : null;
      g.patchValue(
        {
          idZona: Number.isFinite(idZona) && idZona > 0 ? idZona : null,
          zonaPrincipal: z.zonaPrincipal ?? '',
          zonaSuperficieM2: z.superficieZonaM2 ?? '',
          superficieDisponiblePredioM2: z.superficieDisponibleM2 ?? '',
          numeroZona: numZona != null && Number.isFinite(numZona) ? numZona : null,
        },
        { emitEvent: false },
      );
      const localesApi = (z as Record<string, unknown>)['locales'];
      this.rellenarLocalesZonaDesdeApi(g, localesApi);
      arr.push(g);
    });
    this.reiniciarIndicesAccordionZonas();
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
      const idArch = Number(img.id);
      const urlRaw = String(img.url ?? '').trim();
      g.patchValue(
        {
          idArchivo: Number.isFinite(idArch) && idArch > 0 ? idArch : null,
          archivo: null,
          nombre: img.nombre || this.nombreArchivoDesdeUrl(urlRaw, 'Imagen'),
          url: urlArchivoNavegador(urlRaw),
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
      const urlRaw = String(
        archivo?.url ?? (archivo as Record<string, unknown> | undefined)?.['archivoUrl'] ?? '',
      ).trim();
      if (!urlRaw) return;
      const nombre = archivo?.nombre || this.nombreArchivoDesdeUrl(urlRaw, 'Documento');
      const url = urlArchivoNavegador(urlRaw);
      switch (slot) {
        case 'licenciaFuncionamiento':
          this.imagenLicenciaFuncionamientoNombre = nombre;
          this.imagenLicenciaFuncionamientoUrl = url;
          break;
        case 'usoSuelo':
          this.imagenUsoSueloNombre = nombre;
          this.imagenUsoSueloUrl = url;
          break;
        case 'fachada':
          this.imagenFachadaNombre = nombre;
          this.imagenFachadaUrl = url;
          break;
        case 'plano':
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

  private capturarSnapshotEdicion(
    item: InmuebleApiItem,
    documentos: Partial<Record<SlotDocumentoInmueble, InmuebleArchivoApi>>,
    galeria: InmuebleArchivoApi[],
  ): void {
    if (this.idInmueble == null) {
      this.snapshotEdicion = null;
      return;
    }

    const estatusStr = estatusInmuebleDesdeApi(item.estatusInmueble);
    const tiempoRenta =
      item.vigenciaAnios != null && String(item.vigenciaAnios).trim() !== ''
        ? String(item.vigenciaAnios).trim()
        : item.tiempoRentaAnios != null && String(item.tiempoRentaAnios).trim() !== ''
          ? String(item.tiempoRentaAnios).trim()
          : String(item.tiempoRenta ?? '').trim();

    const slotsDocumento: Partial<Record<SlotDocumentoInmueble, SnapshotArchivoEdicion>> = {};
    (Object.keys(documentos) as SlotDocumentoInmueble[]).forEach((slot) => {
      const a = documentos[slot];
      const id = Number(a?.id);
      if (!a?.url?.trim() || !Number.isFinite(id) || id <= 0) return;
      slotsDocumento[slot] = {
        id,
        nombre: a.nombre || this.nombreArchivoDesdeUrl(a.url, 'Documento'),
        url: a.url.trim(),
      };
    });

    this.snapshotEdicion = {
      escalares: {
        inmueble: String(item.inmueble ?? '').trim(),
        idArrendador: idArrendadorDesdeApi(item),
        direccionFiscal: String(item.direccionFiscal ?? '').trim(),
        estatusInmueble: estatusStr,
        vigenciaAnios: tiempoRenta,
        fechaInicio: fechaParaInputDate(item.fechaInicio),
        fechaFin: fechaParaInputDate(item.fechaFin),
        nombreRepresentanteLegal: String(item.nombreRepresentante ?? '').trim(),
        telefonoRepresentanteLegal: String(item.telefonoRepresentante ?? '').trim(),
        correoRepresentanteLegal: String(item.correoRepresentante ?? '').trim(),
        lat: item.lat != null ? String(item.lat) : '',
        lng: item.lng != null ? String(item.lng) : '',
      },
      servicios: (Array.isArray(item.servicios) ? item.servicios : [])
        .map((s) => {
          const id = Number(s.id);
          if (!Number.isFinite(id) || id <= 0) return null;
          return {
            id,
            idTipoServicio:
              s.idTipoServicio != null ? Number(s.idTipoServicio) : null,
            numeroContrato: String(s.numeroContrato ?? '').trim(),
            fechaPago: fechaParaInputDate(s.fechaPago),
            ultimoDiaPago: fechaParaInputDate(s.ultimoDiaPago),
            urlComprobante: String(s.urlComprobante ?? '').trim(),
          };
        })
        .filter((s): s is SnapshotServicioEdicion => s != null),
      zonas: (Array.isArray(item.zonas) ? item.zonas : [])
        .map((z) => {
          const id = Number(z.id);
          if (!Number.isFinite(id) || id <= 0) return null;
          const localesApi = (z as Record<string, unknown>)['locales'];
          const locales: SnapshotLocalEdicion[] = [];
          if (Array.isArray(localesApi)) {
            localesApi.forEach((raw) => {
              if (raw == null || typeof raw !== 'object') return;
              const l = raw as Record<string, unknown>;
              const idLocal = Number(l['id']);
              if (!Number.isFinite(idLocal) || idLocal <= 0) return;
              const estatusRaw = l['estatus'];
              const estatusNum =
                estatusRaw != null &&
                estatusRaw !== '' &&
                Number.isFinite(Number(estatusRaw))
                  ? Number(estatusRaw)
                  : null;
              locales.push({
                id: idLocal,
                nombre: l['nombre'] != null ? String(l['nombre']).trim() : '',
                areaM2: String(l['areaM2'] ?? l['superficieM2'] ?? '').trim(),
                estatus: estatusNum,
                mensualidad: String(
                  this.valorApiLocal(l, 'mensualidad', 'mensualidadMxn', 'rentaSinIva') ?? '',
                ).trim(),
                mantenimientoSinIva: String(
                  this.valorApiLocal(
                    l,
                    'mantenimiento',
                    'mantenimientoSinIva',
                    'mantenimientoMxn',
                  ) ?? '',
                ).trim(),
                aplicaIva: this.aplicaIvaDesdeApi(l),
                rentaConIva: String(
                  this.valorApiLocal(l, 'mensualidadIva', 'rentaConIva', 'mensualidadConIva') ?? '',
                ).trim(),
                mantenimientoConIva: String(
                  this.valorApiLocal(l, 'mantenimientoIva', 'mantenimientoConIva') ?? '',
                ).trim(),
                giro: l['giro'] != null ? String(l['giro']).trim() : '',
                fachadaUrl: this.urlFachadaLocalDesdeApi(l),
              });
            });
          }
          const numZona = z.numeroZona != null ? Number(z.numeroZona) : null;
          return {
            id,
            zonaPrincipal: String(z.zonaPrincipal ?? '').trim(),
            zonaSuperficieM2: String(z.superficieZonaM2 ?? '').trim(),
            superficieDisponiblePredioM2: String(z.superficieDisponibleM2 ?? '').trim(),
            numeroZona:
              numZona != null && Number.isFinite(numZona) ? numZona : null,
            locales,
          };
        })
        .filter((z): z is SnapshotZonaEdicion => z != null),
      slotsDocumento,
      galeria: (Array.isArray(galeria) ? galeria : [])
        .map((img) => {
          const id = Number(img.id);
          if (!img.url?.trim() || !Number.isFinite(id) || id <= 0) return null;
          return {
            id,
            nombre: img.nombre || this.nombreArchivoDesdeUrl(img.url, 'Imagen'),
            url: img.url.trim(),
          };
        })
        .filter((g): g is SnapshotArchivoEdicion => g != null),
    };
  }

  private limpiarArchivosRemotos(): void {
    this.archivoEscrituraNombre = null;
    this.imagenLicenciaFuncionamientoNombre = null;
    this.imagenUsoSueloNombre = null;
    this.imagenFachadaNombre = null;
    this.imagenPlanoNombre = null;
    this.contratoRentaNombre = null;
    this.constanciaFiscalNombre = null;
    this.constanciaRepLegalNombre = null;
    this.comprobanteDomicilioNombre = null;
    this.ineRepresentanteNombre = null;
    this.boletaPredialNombre = null;
    this.archivoEscrituraUrl = null;
    this.imagenLicenciaFuncionamientoUrl = null;
    this.imagenUsoSueloUrl = null;
    this.imagenFachadaUrl = null;
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

  /** URL de fachada del local (GET) antes de subir archivo nuevo. */
  private urlFachadaLocalDesdeApi(l: Record<string, unknown>): string {
    return urlFachadaLocal(l as InmuebleLocalApi);
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
    this.inmuebleForm.get('nombreInmueble')?.markAsTouched();
    this.inmuebleForm.get('idArrendador')?.markAsTouched();

    // Lat/lng se capturan en el mapa al guardar; aquí solo Inmueble y Arrendador.
    const faltantesKeys = this.recopilarCamposFaltantes();
    if (faltantesKeys.length === 0) return true;

    void this.mostrarAlertaCamposFaltantes(
      faltantesKeys.map((key) => {
        if (key.startsWith('zonaPrincipal_')) {
          const idx = Number(key.split('_')[1]);
          return `Nombre de la Zona ${idx + 1} (tiene locales capturados)`;
        }
        return this.etiquetasCampos[key] ?? key;
      }),
    );
    return false;
  }

  /** Claves de control en orden de aparición en el formulario. */
  private recopilarCamposFaltantes(): string[] {
    const faltantes: string[] = [];

    const nombre = String(this.inmuebleForm.get('nombreInmueble')?.value ?? '').trim();
    if (!nombre) {
      faltantes.push('nombreInmueble');
    }

    const idArrendador = this.inmuebleForm.get('idArrendador')?.value;
    if (idArrendador == null || idArrendador === '') {
      faltantes.push('idArrendador');
    }

    for (let zi = 0; zi < this.zonasFormArray.length; zi++) {
      const zonaGrupo = this.zonasFormArray.at(zi) as FormGroup;
      const zonaNombre = String(zonaGrupo.get('zonaPrincipal')?.value ?? '').trim();
      const localesArr = zonaGrupo.get('locales') as FormArray;
      const tieneLocalConDatos = localesArr.controls.some(
        (c) => !this.localZonaVacio(c as FormGroup),
      );
      if (tieneLocalConDatos && !zonaNombre) {
        faltantes.push(`zonaPrincipal_${zi}`);
      }
    }

    return faltantes;
  }

  private mostrarAlertaCamposFaltantes(faltantes: string[]): void {
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
          Faltan los siguientes campos obligatorios.
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
  }

  private ejecutarActualizacionInmueble(): void {
    if (this.idInmueble == null) return;
    this.loadingSubmit = true;
    const fd = this.construirFormDataInmueble();
    this.inmueblesService.actualizarInmueble(this.idInmueble, fd).subscribe({
      next: () => {
        this.cerrarSwalGuardandoInmuebleTrasExito(() =>
          this.mostrarExitoInmuebleYRedirigir(true),
        );
      },
      error: (err: unknown) => {
        this.loadingSubmit = false;
        this.cerrarSwalGuardandoInmuebleInmediato();
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo actualizar el inmueble. Verifique la información e intente de nuevo.';
        void Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: String(text),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      },
    });
  }

  private ejecutarCreacionInmueble(): void {
    this.loadingSubmit = true;
    const fd = this.construirFormDataInmueble();
    this.inmueblesService.crearInmueble(fd).subscribe({
      next: () => {
        this.cerrarSwalGuardandoInmuebleTrasExito(() =>
          this.mostrarExitoInmuebleYRedirigir(false),
        );
      },
      error: (err: unknown) => {
        this.loadingSubmit = false;
        this.cerrarSwalGuardandoInmuebleInmediato();
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo registrar el inmueble. Verifique la información e intente de nuevo.';
        void Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: String(text),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      },
    });
  }

  /** Muestra carga al confirmar ubicación en el mapa (antes del POST/PUT). */
  private mostrarSwalGuardandoInmueble(): void {
    this.swalGuardadoInmuebleActivo = true;
    void Swal.fire({
      title: 'Guardando inmueble…',
      text: 'Registrando la ubicación y los datos, por favor espera.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#141a21',
      color: '#ffffff',
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  /** Tras respuesta OK del servicio: espera 1 s y cierra la alerta de carga. */
  private cerrarSwalGuardandoInmuebleTrasExito(onCerrado: () => void): void {
    if (!this.swalGuardadoInmuebleActivo) {
      onCerrado();
      return;
    }
    this.swalGuardadoInmuebleActivo = false;
    setTimeout(() => {
      Swal.close();
      onCerrado();
    }, 1000);
  }

  private cerrarSwalGuardandoInmuebleInmediato(): void {
    if (!this.swalGuardadoInmuebleActivo) return;
    this.swalGuardadoInmuebleActivo = false;
    Swal.close();
  }

  /** Muestra el mismo éxito que en el resto del sistema; luego navega. */
  private mostrarExitoInmuebleYRedirigir(esActualizacion: boolean): void {
    this.loadingSubmit = false;
    const text = esActualizacion
      ? 'Los datos del inmueble se actualizaron correctamente.'
      : 'Se registró el inmueble de manera exitosa.';
    void Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Operación Exitosa!',
      text,
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
    }).then(() => {
      void this.router.navigateByUrl('/inmuebles');
    });
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

  private textoIgual(a: unknown, b: unknown): boolean {
    return String(a ?? '').trim() === String(b ?? '').trim();
  }

  private appendIdRegistro(fd: FormData, key: string, id: unknown): void {
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) {
      fd.append(key, String(Math.trunc(n)));
    }
  }

  private localZonaVacio(lg: FormGroup): boolean {
    const nombre = String(lg.get('nombre')?.value ?? '').trim();
    const area = lg.get('areaM2')?.value;
    const estatus = lg.get('estatus')?.value;
    const mensualidad = lg.get('mensualidad')?.value;
    const mantSin = lg.get('mantenimientoSinIva')?.value;
    const giro = String(lg.get('giro')?.value ?? '').trim();
    return (
      !nombre &&
      (area === '' || area == null) &&
      (estatus === '' || estatus == null) &&
      (mensualidad === '' || mensualidad == null) &&
      (mantSin === '' || mantSin == null) &&
      !giro
    );
  }

  private zonaVacia(g: FormGroup): boolean {
    const zp = String(g.get('zonaPrincipal')?.value ?? '').trim();
    const supZ = g.get('zonaSuperficieM2')?.value;
    const supD = g.get('superficieDisponiblePredioM2')?.value;
    return (
      !zp &&
      (supZ === '' || supZ == null) &&
      (supD === '' || supD == null) &&
      (g.get('locales') as FormArray).controls.every((c) =>
        this.localZonaVacio(c as FormGroup),
      )
    );
  }

  private servicioRequiereEnvio(g: FormGroup): boolean {
    const idTipo = g.get('idTipoServicio')?.value;
    if (idTipo == null || idTipo === '') return false;

    const idServ = Number(g.get('idServicio')?.value);
    if (!Number.isFinite(idServ) || idServ <= 0) return true;

    const snap = this.snapshotEdicion?.servicios.find((s) => s.id === idServ);
    if (!snap) return true;
    if (g.get('servicioComprobantePago')?.value instanceof File) return true;

    return (
      !this.textoIgual(g.get('idTipoServicio')?.value, snap.idTipoServicio) ||
      !this.textoIgual(g.get('servicioNumeroContrato')?.value, snap.numeroContrato) ||
      !this.textoIgual(g.get('servicioFechaPago')?.value, snap.fechaPago) ||
      !this.textoIgual(g.get('servicioUltimoDiaPago')?.value, snap.ultimoDiaPago)
    );
  }

  private localRequiereEnvio(lg: FormGroup, snapZona: SnapshotZonaEdicion | undefined): boolean {
    if (this.localZonaVacio(lg)) return false;

    const idLocal = Number(lg.get('idLocal')?.value);
    if (!Number.isFinite(idLocal) || idLocal <= 0) return true;

    const snap = snapZona?.locales.find((l) => l.id === idLocal);
    if (!snap) return true;
    if (lg.get('fachada')?.value instanceof File) return true;

    return (
      !this.textoIgual(lg.get('nombre')?.value, snap.nombre) ||
      !this.textoIgual(lg.get('areaM2')?.value, snap.areaM2) ||
      !this.textoIgual(lg.get('estatus')?.value, snap.estatus) ||
      !this.textoIgual(lg.get('mensualidad')?.value, snap.mensualidad) ||
      !this.textoIgual(lg.get('mantenimientoSinIva')?.value, snap.mantenimientoSinIva) ||
      !this.textoIgual(lg.get('aplicaIva')?.value, snap.aplicaIva) ||
      !this.textoIgual(lg.get('rentaConIva')?.value, snap.rentaConIva) ||
      !this.textoIgual(lg.get('mantenimientoConIva')?.value, snap.mantenimientoConIva) ||
      !this.textoIgual(lg.get('giro')?.value, snap.giro)
    );
  }

  private zonaRequiereEnvio(g: FormGroup): boolean {
    if (this.zonaVacia(g)) return false;

    const idZona = Number(g.get('idZona')?.value);
    if (!Number.isFinite(idZona) || idZona <= 0) return true;

    const snap = this.snapshotEdicion?.zonas.find((z) => z.id === idZona);
    if (!snap) return true;

    if (
      !this.textoIgual(g.get('zonaPrincipal')?.value, snap.zonaPrincipal) ||
      !this.textoIgual(g.get('zonaSuperficieM2')?.value, snap.zonaSuperficieM2) ||
      !this.textoIgual(
        g.get('superficieDisponiblePredioM2')?.value,
        snap.superficieDisponiblePredioM2,
      ) ||
      !this.textoIgual(g.get('numeroZona')?.value, snap.numeroZona)
    ) {
      return true;
    }

    const locales = g.get('locales') as FormArray;
    return locales.controls.some((c) => this.localRequiereEnvio(c as FormGroup, snap));
  }

  private appendEscalaresActualizacion(fd: FormData, v: Record<string, unknown>): void {
    const snap = this.snapshotEdicion!.escalares;
    const inmueble = String(v['nombreInmueble'] ?? '').trim();
    if (!this.textoIgual(inmueble, snap.inmueble) && inmueble) {
      fd.append('inmueble', inmueble);
    }

    const idArr = v['idArrendador'];
    if (!this.textoIgual(idArr, snap.idArrendador)) {
      this.appendEntero(fd, 'idArrendador', idArr);
    }

    const dir = String(v['direccionInmueble'] ?? '').trim();
    if (!this.textoIgual(dir, snap.direccionFiscal) && dir) {
      fd.append('direccionFiscal', dir);
    }

    const estatusNum = this.estatusInmuebleANumero(v['estatusInmueble']);
    const estatusSnap = this.estatusInmuebleANumero(snap.estatusInmueble);
    if (estatusNum != null && estatusNum !== estatusSnap) {
      this.appendEntero(fd, 'estatusInmueble', estatusNum);
    }

    const vigencia = String(v['tiempoRentaAnios'] ?? '').trim();
    if (!this.textoIgual(vigencia, snap.vigenciaAnios) && vigencia) {
      fd.append('vigenciaAnios', vigencia);
    }

    const fi = String(v['fechaInicio'] ?? '').trim();
    if (!this.textoIgual(fi, snap.fechaInicio) && fi) fd.append('fechaInicio', fi);

    const ff = String(v['fechaFin'] ?? '').trim();
    if (!this.textoIgual(ff, snap.fechaFin) && ff) fd.append('fechaFin', ff);

    const nomRep = String(v['nombreRepresentanteLegal'] ?? '').trim();
    if (!this.textoIgual(nomRep, snap.nombreRepresentanteLegal) && nomRep) {
      fd.append('nombreRepresentante', nomRep);
    }

    const telRep = String(v['telefonoRepresentanteLegal'] ?? '').trim();
    if (!this.textoIgual(telRep, snap.telefonoRepresentanteLegal) && telRep) {
      fd.append('telefonoRepresentante', telRep);
    }

    const mailRep = String(v['correoRepresentanteLegal'] ?? '').trim();
    if (!this.textoIgual(mailRep, snap.correoRepresentanteLegal) && mailRep) {
      fd.append('correoRepresentante', mailRep);
    }

    const lat = v['lat'];
    const lng = v['lng'];
    if (!this.textoIgual(lat, snap.lat)) this.appendValorNumerico(fd, 'lat', lat);
    if (!this.textoIgual(lng, snap.lng)) this.appendValorNumerico(fd, 'lng', lng);
  }

  private appendDocumentoSlotActualizacion(
    fd: FormData,
    contadores: { archivos: number; imagenes: number },
    slot: SlotDocumentoInmueble,
    nombreCanonico: string,
    controlName: string,
    nombreUi: string | null,
    esImagen: boolean,
  ): void {
    const file = this.inmuebleForm.get(controlName)?.value;
    const hayArchivoNuevo = file instanceof File;
    const snap = this.snapshotEdicion?.slotsDocumento[slot];
    const nombreUiTrim = String(nombreUi ?? '').trim();

    if (!snap && !hayArchivoNuevo) return;

    if (snap && !hayArchivoNuevo && nombreUiTrim === snap.nombre) return;

    const idx = esImagen ? contadores.imagenes++ : contadores.archivos++;
    const pref = esImagen ? `imagenes[${idx}]` : `archivos[${idx}]`;

    if (snap) this.appendIdRegistro(fd, `${pref}.id`, snap.id);

    const nombreEnvio = hayArchivoNuevo
      ? nombreCanonico
      : nombreUiTrim || nombreCanonico;
    fd.append(`${pref}.nombre`, nombreEnvio);

    if (hayArchivoNuevo) {
      fd.append(`${pref}.archivo`, file, file.name);
    }
  }

  /**
   * PUT `/inmuebles/{id}`: solo campos y registros modificados; con `id` actualiza, sin `id` crea.
   */
  private construirFormDataActualizacion(): FormData {
    const fd = new FormData();
    const v = this.inmuebleForm.getRawValue() as Record<string, unknown>;
    this.appendEscalaresActualizacion(fd, v);

    let si = 0;
    this.serviciosFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      if (!this.servicioRequiereEnvio(g)) return;

      const idServ = g.get('idServicio')?.value;
      const snap = Number(idServ) > 0
        ? this.snapshotEdicion?.servicios.find((s) => s.id === Number(idServ))
        : undefined;

      if (snap) this.appendIdRegistro(fd, `servicios[${si}].id`, snap.id);

      const idTipo = g.get('idTipoServicio')?.value;
      if (idTipo != null && idTipo !== '') {
        this.appendEntero(fd, `servicios[${si}].idTipoServicio`, idTipo);
      }

      const nc = g.get('servicioNumeroContrato')?.value;
      if (!snap || !this.textoIgual(nc, snap.numeroContrato)) {
        if (nc != null && String(nc).trim() !== '') {
          fd.append(`servicios[${si}].numeroContrato`, String(nc).trim());
        }
      }

      const fp = String(g.get('servicioFechaPago')?.value ?? '').trim();
      if (!snap || !this.textoIgual(fp, snap.fechaPago)) {
        if (fp) fd.append(`servicios[${si}].fechaPago`, fp);
      }

      const ulp = String(g.get('servicioUltimoDiaPago')?.value ?? '').trim();
      if (!snap || !this.textoIgual(ulp, snap.ultimoDiaPago)) {
        if (ulp) fd.append(`servicios[${si}].ultimoDiaPago`, ulp);
      }

      const arch = g.get('servicioComprobantePago')?.value;
      if (arch instanceof File) {
        fd.append(`servicios[${si}].archivo`, arch, arch.name);
      }

      si += 1;
    });

    let zi = 0;
    this.zonasFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      if (!this.zonaRequiereEnvio(g)) return;

      const idZona = Number(g.get('idZona')?.value);
      const snapZona =
        Number.isFinite(idZona) && idZona > 0
          ? this.snapshotEdicion?.zonas.find((z) => z.id === idZona)
          : undefined;

      if (snapZona) this.appendIdRegistro(fd, `zonas[${zi}].id`, snapZona.id);

      const zp = String(g.get('zonaPrincipal')?.value ?? '').trim();
      if (!snapZona || !this.textoIgual(zp, snapZona.zonaPrincipal)) {
        if (zp) fd.append(`zonas[${zi}].zonaPrincipal`, zp);
      }

      const supZ = g.get('zonaSuperficieM2')?.value;
      if (!snapZona || !this.textoIgual(supZ, snapZona.zonaSuperficieM2)) {
        if (supZ !== '' && supZ != null && Number.isFinite(Number(supZ))) {
          this.appendValorNumerico(fd, `zonas[${zi}].superficieZonaM2`, supZ);
        }
      }

      const supD = g.get('superficieDisponiblePredioM2')?.value;
      if (!snapZona || !this.textoIgual(supD, snapZona.superficieDisponiblePredioM2)) {
        if (supD !== '' && supD != null && Number.isFinite(Number(supD))) {
          this.appendValorNumerico(fd, `zonas[${zi}].superficieDisponibleM2`, supD);
        }
      }

      const numZona = g.get('numeroZona')?.value;
      if (!snapZona || !this.textoIgual(numZona, snapZona.numeroZona)) {
        if (numZona != null && numZona !== '' && Number.isFinite(Number(numZona))) {
          this.appendEntero(fd, `zonas[${zi}].numeroZona`, numZona);
        }
      } else if (!snapZona && numZona != null && numZona !== '') {
        this.appendEntero(fd, `zonas[${zi}].numeroZona`, numZona);
      }

      let lj = 0;
      const localesArr = g.get('locales') as FormArray;
      localesArr.controls.forEach((lCtrl) => {
        const lg = lCtrl as FormGroup;
        if (!this.localRequiereEnvio(lg, snapZona)) return;

        const idLocal = Number(lg.get('idLocal')?.value);
        const snapLocal = snapZona?.locales.find((l) => l.id === idLocal);

        if (snapLocal) {
          this.appendIdRegistro(fd, `zonas[${zi}].locales[${lj}].id`, snapLocal.id);
        }

        const nombre = String(lg.get('nombre')?.value ?? '').trim();
        if (!snapLocal || !this.textoIgual(nombre, snapLocal.nombre)) {
          if (nombre) fd.append(`zonas[${zi}].locales[${lj}].nombre`, nombre);
        }

        const area = lg.get('areaM2')?.value;
        if (!snapLocal || !this.textoIgual(area, snapLocal.areaM2)) {
          if (area !== '' && area != null && Number.isFinite(Number(area))) {
            this.appendValorNumerico(fd, `zonas[${zi}].locales[${lj}].areaM2`, area);
          }
        }

        const estatus = lg.get('estatus')?.value;
        if (!snapLocal || !this.textoIgual(estatus, snapLocal.estatus)) {
          if (estatus !== '' && estatus != null && Number.isFinite(Number(estatus))) {
            this.appendEntero(fd, `zonas[${zi}].locales[${lj}].estatus`, estatus);
          }
        }

        const mensualidad = lg.get('mensualidad')?.value;
        if (!snapLocal || !this.textoIgual(mensualidad, snapLocal.mensualidad)) {
          if (mensualidad !== '' && mensualidad != null && Number.isFinite(Number(mensualidad))) {
            this.appendValorNumerico(
              fd,
              `zonas[${zi}].locales[${lj}].mensualidad`,
              mensualidad,
            );
          }
        }

        const mantSin = lg.get('mantenimientoSinIva')?.value;
        if (!snapLocal || !this.textoIgual(mantSin, snapLocal.mantenimientoSinIva)) {
          if (mantSin !== '' && mantSin != null && Number.isFinite(Number(mantSin))) {
            this.appendValorNumerico(
              fd,
              `zonas[${zi}].locales[${lj}].mantenimiento`,
              mantSin,
            );
          }
        }

        // `aplicaIva` es solo un switch de la UI; el API ya no acepta esa propiedad.
        const aplicaIva = Number(lg.get('aplicaIva')?.value) === 1 ? 1 : 0;
        if (aplicaIva === 1) {
          const rentaCon = lg.get('rentaConIva')?.value;
          if (!snapLocal || !this.textoIgual(rentaCon, snapLocal.rentaConIva)) {
            if (rentaCon !== '' && rentaCon != null && Number.isFinite(Number(rentaCon))) {
              this.appendValorNumerico(
                fd,
                `zonas[${zi}].locales[${lj}].mensualidadIva`,
                rentaCon,
              );
            }
          }
          const mantCon = lg.get('mantenimientoConIva')?.value;
          if (!snapLocal || !this.textoIgual(mantCon, snapLocal.mantenimientoConIva)) {
            if (mantCon !== '' && mantCon != null && Number.isFinite(Number(mantCon))) {
              this.appendValorNumerico(
                fd,
                `zonas[${zi}].locales[${lj}].mantenimientoIva`,
                mantCon,
              );
            }
          }
        }

        const giro = String(lg.get('giro')?.value ?? '').trim();
        if (!snapLocal || !this.textoIgual(giro, snapLocal.giro)) {
          if (giro) fd.append(`zonas[${zi}].locales[${lj}].giro`, giro);
        }

        const fachada = lg.get('fachada')?.value;
        if (fachada instanceof File) {
          fd.append(`zonas[${zi}].locales[${lj}].fachada`, fachada, fachada.name);
        }

        lj += 1;
      });

      zi += 1;
    });

    const contadores = { archivos: 0, imagenes: 0 };

    if (this.mostrarCamposRenta) {
      this.appendDocumentoSlotActualizacion(
        fd,
        contadores,
        'contratoRenta',
        'Contrato de renta',
        'documentoContratoRenta',
        this.contratoRentaNombre,
        false,
      );
    }
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'constanciaFiscal',
      'Constancia de situación fiscal',
      'documentoConstanciaFiscal',
      this.constanciaFiscalNombre,
      false,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'comprobanteDomicilio',
      'Comprobante de domicilio',
      'documentoComprobanteDomicilio',
      this.comprobanteDomicilioNombre,
      false,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'escritura',
      'Escrituras o título de propiedad',
      'documentoEscritura',
      this.archivoEscrituraNombre,
      false,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'boletaPredial',
      'Boleta predial vigente',
      'documentoBoletaPredial',
      this.boletaPredialNombre,
      false,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'constanciaRepLegal',
      'Constancia fiscal representante legal',
      'constanciaSituacionFiscalRepresentanteLegal',
      this.constanciaRepLegalNombre,
      false,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'ineRepresentante',
      'Identificación oficial representante legal',
      'ineRepresentanteLegal',
      this.ineRepresentanteNombre,
      false,
    );

    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'licenciaFuncionamiento',
      'Licencia de funcionamiento',
      'documentoLicenciaFuncionamiento',
      this.imagenLicenciaFuncionamientoNombre,
      true,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'usoSuelo',
      'Uso de suelo',
      'documentoUsoSuelo',
      this.imagenUsoSueloNombre,
      true,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'fachada',
      'Fachada',
      'documentoFachada',
      this.imagenFachadaNombre,
      true,
    );
    this.appendDocumentoSlotActualizacion(
      fd,
      contadores,
      'plano',
      'Plano',
      'documentoPlano',
      this.imagenPlanoNombre,
      true,
    );

    this.galeriaImagenesFormArray.controls.forEach((galCtrl) => {
      const g = galCtrl as FormGroup;
      const file = g.get('archivo')?.value;
      const hayArchivoNuevo = file instanceof File;
      const nom = String(g.get('nombre')?.value ?? '').trim();
      const idArch = Number(g.get('idArchivo')?.value);
      const snap =
        Number.isFinite(idArch) && idArch > 0
          ? this.snapshotEdicion?.galeria.find((x) => x.id === idArch)
          : undefined;

      if (!snap && !hayArchivoNuevo) return;
      if (snap && !hayArchivoNuevo && nom === snap.nombre) return;

      const idx = contadores.imagenes++;
      if (snap) this.appendIdRegistro(fd, `imagenes[${idx}].id`, snap.id);
      fd.append(`imagenes[${idx}].nombre`, nom || (hayArchivoNuevo ? file.name : 'Imagen'));
      if (hayArchivoNuevo) {
        fd.append(`imagenes[${idx}].archivo`, file, file.name);
      }
    });

    return fd;
  }

  /**
   * Arma el cuerpo multipart para POST `/inmuebles` (alta completa).
   */
  private construirFormDataCreacion(): FormData {
    const fd = new FormData();
    const v = this.inmuebleForm.getRawValue() as Record<string, unknown>;

    fd.append('inmueble', String(v['nombreInmueble'] ?? '').trim());
    this.appendEntero(fd, 'idArrendador', v['idArrendador']);

    const dirFiscal = String(v['direccionInmueble'] ?? '').trim();
    if (dirFiscal) fd.append('direccionFiscal', dirFiscal);

    const estatusNum = this.estatusInmuebleANumero(v['estatusInmueble']);
    if (estatusNum != null) this.appendEntero(fd, 'estatusInmueble', estatusNum);

    const vigencia = String(v['tiempoRentaAnios'] ?? '').trim();
    if (vigencia) fd.append('vigenciaAnios', vigencia);

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

      let lj = 0;
      const localesArr = g.get('locales') as FormArray;
      localesArr?.controls.forEach((lCtrl) => {
        const lg = lCtrl as FormGroup;
        const nombre = String(lg.get('nombre')?.value ?? '').trim();
        const area = lg.get('areaM2')?.value;
        const estatus = lg.get('estatus')?.value;
        const mensualidad = lg.get('mensualidad')?.value;
        const mantSin = lg.get('mantenimientoSinIva')?.value;
        const giro = String(lg.get('giro')?.value ?? '').trim();
        const localVacio =
          !nombre &&
          (area === '' || area == null) &&
          (estatus === '' || estatus == null) &&
          (mensualidad === '' || mensualidad == null) &&
          (mantSin === '' || mantSin == null) &&
          !giro;
        if (localVacio) return;

        if (nombre) fd.append(`zonas[${zi}].locales[${lj}].nombre`, nombre);
        if (area !== '' && area != null && Number.isFinite(Number(area))) {
          this.appendValorNumerico(fd, `zonas[${zi}].locales[${lj}].areaM2`, area);
        }
        if (estatus !== '' && estatus != null && Number.isFinite(Number(estatus))) {
          this.appendEntero(fd, `zonas[${zi}].locales[${lj}].estatus`, estatus);
        }
        if (mensualidad !== '' && mensualidad != null && Number.isFinite(Number(mensualidad))) {
          this.appendValorNumerico(fd, `zonas[${zi}].locales[${lj}].mensualidad`, mensualidad);
        }
        if (mantSin !== '' && mantSin != null && Number.isFinite(Number(mantSin))) {
          this.appendValorNumerico(
            fd,
            `zonas[${zi}].locales[${lj}].mantenimiento`,
            mantSin,
          );
        }
        // `aplicaIva` es solo un switch de la UI; el API ya no acepta esa propiedad.
        const aplicaIva = Number(lg.get('aplicaIva')?.value) === 1 ? 1 : 0;
        if (aplicaIva === 1) {
          const rentaCon = lg.get('rentaConIva')?.value;
          const mantCon = lg.get('mantenimientoConIva')?.value;
          if (rentaCon !== '' && rentaCon != null && Number.isFinite(Number(rentaCon))) {
            this.appendValorNumerico(fd, `zonas[${zi}].locales[${lj}].mensualidadIva`, rentaCon);
          }
          if (mantCon !== '' && mantCon != null && Number.isFinite(Number(mantCon))) {
            this.appendValorNumerico(
              fd,
              `zonas[${zi}].locales[${lj}].mantenimientoIva`,
              mantCon,
            );
          }
        }
        if (giro) fd.append(`zonas[${zi}].locales[${lj}].giro`, giro);
        const fachada = lg.get('fachada')?.value;
        if (fachada instanceof File) {
          fd.append(`zonas[${zi}].locales[${lj}].fachada`, fachada, fachada.name);
        }
        lj += 1;
      });

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
    pushArchivo(v['documentoReciboAguaServicios'], 'Recibo de agua o servicios');
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

    pushImagen(v['documentoLicenciaFuncionamiento'], 'Licencia de funcionamiento');
    pushImagen(v['documentoUsoSuelo'], 'Uso de suelo');
    pushImagen(v['documentoFachada'], 'Fachada');
    pushImagen(v['documentoPlano'], 'Plano');

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

  private construirFormDataInmueble(): FormData {
    if (this.idInmueble != null && this.snapshotEdicion) {
      return this.construirFormDataActualizacion();
    }
    return this.construirFormDataCreacion();
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
      this.mostrarAlertaCamposFaltantes([
        this.etiquetasCampos['lat'],
        this.etiquetasCampos['lng'],
      ]);
      return;
    }
    this.inmuebleForm.patchValue({
      lat: this.latSeleccionada,
      lng: this.lngSeleccionada,
    });
    this.limpiarEstadoMapaModal();
    this.mostrarSwalGuardandoInmueble();
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
