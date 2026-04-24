import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { INMUEBLES_FORM_DEMO } from '../inmuebles-demo.data';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';

@Component({
  selector: 'app-agregar-inmueble',
  templateUrl: './agregar-inmueble.component.html',
  styleUrl: './agregar-inmueble.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    trigger('arrayItemAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(6px) scale(0.995)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-4px) scale(0.992)' })),
      ]),
    ]),
  ],
})
export class AgregarInmuebleComponent implements OnInit {
  public title = 'Agregar Inmueble';
  public submitButton: string = 'Guardar';
  public inmuebleForm!: FormGroup;
  public idInmueble!: number;
  archivoEscrituraNombre: string | null = null;
  imagenLicenciaNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  mostrarModalMapa = false;
  map: any = null;
  marker: any = null;
  latSeleccionada: number | null = null;
  lngSeleccionada: number | null = null;
  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly PIN_URL = 'assets/images/logos/marker_spring.webp';
  public listaClientes: any[] = [];

  @ViewChild('archivoEscrituraInput') archivoEscrituraInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imagenLicenciaInput') imagenLicenciaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imagenPlanoInput') imagenPlanoInput!: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private clieService: ClientesService,
  ) {}

  ngOnInit(): void {
    this.obtenerClientes();
    this.initForm();
    this.activatedRoute.params.subscribe((params) => {
      this.idInmueble = Number(params['idInmueble']);
      if (this.idInmueble) {
        this.title = 'Actualizar Inmueble';
        this.submitButton = 'Actualizar';
        this.cargarDemoEdicion(this.idInmueble);
      }
    });
  }

  obtenerClientes(): void {
    this.clieService.obtenerClientes().subscribe((response) => {
      this.listaClientes = (response.data || []).map((c: any) => ({
        ...c,
        id: Number(c.id),
      }));
    });
  }

  private initForm(): void {
    this.inmuebleForm = this.fb.group({
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
      galeriaImagenes: this.fb.array([this.crearGaleriaImagenFormGroup()]),
      servicios: this.fb.array([this.crearServicioFormGroup()]),
      zonas: this.fb.array([this.crearZonaFormGroup()]),
      estacionamientos: this.fb.array([this.crearEstacionamientoFormGroup()]),
      pagos: this.fb.array([this.crearPagoFormGroup()]),
      vigencias: this.fb.array([this.crearVigenciaFormGroup()]),
      lat: [''],
      lng: [''],
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

  private crearServicioFormGroup(): FormGroup {
    return this.fb.group({
      servicioAguaContrato: [''],
      servicioLuzContrato: [''],
      servicioMantenimientoContrato: [''],
    });
  }

  private crearGaleriaImagenFormGroup(): FormGroup {
    return this.fb.group({
      archivo: [null],
      nombre: [''],
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

  private crearVigenciaFormGroup(): FormGroup {
    return this.fb.group({
      vigenciaDocumento: [''],
      vigenciaDiasRestantes: [''],
      vigenciaEstatus: [''],
    });
  }

  get localesFormArray(): FormArray {
    return this.inmuebleForm.get('locales') as FormArray;
  }

  get serviciosFormArray(): FormArray {
    return this.inmuebleForm.get('servicios') as FormArray;
  }

  get galeriaImagenesFormArray(): FormArray {
    return this.inmuebleForm.get('galeriaImagenes') as FormArray;
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

  get vigenciasFormArray(): FormArray {
    return this.inmuebleForm.get('vigencias') as FormArray;
  }

  agregarLocal(): void {
    this.localesFormArray.push(this.crearLocalFormGroup());
  }

  eliminarLocal(index: number): void {
    if (this.localesFormArray.length === 1) return;
    this.localesFormArray.removeAt(index);
  }

  agregarServicio(): void {
    this.serviciosFormArray.push(this.crearServicioFormGroup());
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

  agregarVigencia(): void {
    this.vigenciasFormArray.push(this.crearVigenciaFormGroup());
  }

  eliminarVigencia(index: number): void {
    if (this.vigenciasFormArray.length === 1) return;
    this.vigenciasFormArray.removeAt(index);
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

  abrirSelectorArchivo(ref: 'escritura' | 'licencia' | 'plano'): void {
    const map = {
      escritura: this.archivoEscrituraInput,
      licencia: this.imagenLicenciaInput,
      plano: this.imagenPlanoInput,
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
        lat: '',
        lng: '',
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
