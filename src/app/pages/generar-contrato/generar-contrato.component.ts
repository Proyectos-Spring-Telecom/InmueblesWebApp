import { animate, style, transition, trigger } from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { catchError, debounce, EMPTY, finalize, Subject, Subscription, switchMap, tap, timer } from 'rxjs';
import { contractDimAnim, contractModalAnim, routeAnimation } from 'src/app/pipe/module-open.animation';
import {
  CampoPlantilla,
  PlantillaContrato,
  PlantillaContratoService,
  SeccionPlantilla,
  TipoCampoPlantilla,
} from 'src/app/services/moduleService/plantilla-contrato.service';
import Swal from 'sweetalert2';
import {
  ContratoGeneradoRow,
  extraerListaGenerados,
  extraerPlantillaGenerada,
  mapearContratoGenerado,
} from './contratos-generados.mapper';

/** Campos de porcentaje: no pueden pasar de 100. */
const CLAVES_PORCENTAJE = ['porcentajeMantenimiento', 'tasaMoratoriaDiaria', 'topeMoratorioMensual'];
const CLAVES_MONEDA = ['rentaMensual', 'deposito', 'penaConvencional'];

const ICONO_POR_TIPO: Record<TipoCampoPlantilla, string> = {
  texto: 'edit_note',
  fecha: 'event',
  numero: 'tag',
  decimal: 'payments',
  correo: 'alternate_email',
  telefono: 'call',
};

/** Íconos y descripciones por sección (si llega una sección nueva se usa el genérico). */
const INFO_SECCION: Record<string, { icono: string; descripcion: string }> = {
  documento: { icono: 'description', descripcion: 'Identificación del documento.' },
  subarrendador: { icono: 'apartment', descripcion: 'Quien otorga el uso del local y su representación legal.' },
  inmueble: { icono: 'storefront', descripcion: 'Ubicación, superficie y destino del local comercial.' },
  subarrendatario: { icono: 'person', descripcion: 'Quien recibe el local en subarrendamiento.' },
  obligadoSolidario: { icono: 'handshake', descripcion: 'Persona que responde solidariamente por el subarrendatario.' },
  condiciones: { icono: 'gavel', descripcion: 'Vigencia, renta, depósito y penalizaciones.' },
  pago: { icono: 'account_balance', descripcion: 'Cuenta donde se depositará la renta.' },
  extras: { icono: 'local_parking', descripcion: 'Estacionamiento, corporativo y exclusividad de giro.' },
};

/** Ejemplos realistas por campo; si no hay, se usa uno según el tipo. */
const PLACEHOLDERS: Record<string, string> = {
  folio: 'SUB-2026-001',
  razonSocial: 'Desarrollos MTH S.A. de C.V.',
  representante: 'Nombre completo del representante',
  numeroEscrituraConstitutiva: '12345',
  numeroEscrituraPoder: '67890',
  notarioPoder: 'Lic. Nombre del notario',
  numeroNotariaPoder: '15',
  ciudadNotariaPoder: 'Ciudad de México',
  domicilio: 'Calle, número, colonia, C.P. y ciudad',
  domicilioAlterno: 'Calle, número, colonia, C.P. y ciudad',
  domicilioFiscal: 'Calle, número, colonia, C.P. y ciudad',
  calle: 'Av. Insurgentes Sur 1234',
  interior: 'Piso 3',
  local: 'L-12',
  colonia: 'Del Valle',
  municipio: 'Benito Juárez',
  cp: '03100',
  estado: 'Ciudad de México',
  superficieM2: '85.50',
  usoSuelo: 'Comercial',
  destino: 'Venta de alimentos y bebidas',
  nombre: 'Nombre completo',
  nacionalidad: 'Mexicana',
  rfc: 'XAXX010101000',
  curp: 'ABCD900101HDFRRR09',
  beneficiario: 'Nombre del titular de la cuenta',
  banco: 'BBVA México',
  clabe: '012180001234567891',
  corporativo: 'Nombre del corporativo',
  exclusividadGiro: 'Cafetería',
};

/** Obligatorio: rechaza null, vacío y solo espacios. */
const requeridoSinEspacios: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value;
  if (v == null) return { required: true };
  if (typeof v === 'string' && v.trim() === '') return { required: true };
  return null;
};

const entero: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value;
  if (v == null || v === '') return null;
  return Number.isInteger(Number(v)) ? null : { entero: true };
};

/** Transición suave al cambiar de sección. */
const seccionTabAnim = trigger('seccionTab', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px)' }),
    animate('260ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);

type EstadoVivo = 'inactivo' | 'pendiente' | 'cargando' | 'listo' | 'error';

@Component({
  selector: 'app-generar-contrato',
  templateUrl: './generar-contrato.component.html',
  styleUrl: './generar-contrato.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim, seccionTabAnim],
})
export class GenerarContratoComponent implements OnInit, OnDestroy {
  public plantilla: PlantillaContrato | null = null;
  /** Respuesta original del GET: se reenvía tal cual, solo cambiando "valor". */
  private plantillaOriginal: any = null;
  public seccionActiva = 0;

  // Grid de contratos generados (GET /contratos/generados)
  public contratosGenerados: ContratoGeneradoRow[] = [];
  public cargandoGenerados = false;
  public mensajeAgrupar = 'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  /** JSON enviado a la vista previa; es el mismo que se guarda en /contratos/generados. */
  private ultimoPayload: PlantillaContrato | null = null;
  public guardandoContrato = false;
  /** Con valor: se está editando un contrato guardado (PATCH /contratos/generados/{id}). */
  public idContratoEditando: number | null = null;
  public nombreContratoEditando = '';
  public idCargandoEdicion: number | null = null;
  public form: FormGroup | null = null;
  public cargandoPlantilla = false;
  public generandoPdf = false;
  public intentoEnviar = false;

  // Visor final (Guardar / Cancelar)
  public mostrarVisorPdf = false;
  public pdfBlob: Blob | null = null;
  public pdfUrl: string | null = null;
  public pdfNombreArchivo = 'contrato-subarrendamiento.pdf';

  // Vista previa en vivo mientras se captura
  public vivoPdf: Blob | null = null;
  public vivoEstado: EstadoVivo = 'inactivo';
  public vivoActualizado: Date | null = null;
  public vivoZoom = 1;
  public vivoTotalPaginas = 0;
  /** En pantallas angostas se muestra una sola vista a la vez. */
  public vistaMovil: 'form' | 'preview' = 'form';
  public vivoNuevoSinVer = false;
  private vivo$ = new Subject<boolean>();
  private vivoSub: Subscription;
  private cambiosSub?: Subscription;

  constructor(private plantillaService: PlantillaContratoService) {
    // inmediato = true (refresco manual / carga inicial); false = espera a que deje de escribir
    this.vivoSub = this.vivo$
      .pipe(
        debounce((inmediato) => timer(inmediato ? 0 : 1200)),
        tap(() => (this.vivoEstado = 'cargando')),
        switchMap(() => {
          if (!this.form || !this.plantillaOriginal) return EMPTY;
          return this.plantillaService.vistaPreviaSubarrendamiento(this.construirPayload()).pipe(
            catchError(() => {
              this.vivoEstado = 'error';
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe((pdf) => {
        this.vivoPdf = pdf;
        this.vivoEstado = 'listo';
        this.vivoActualizado = new Date();
        if (this.vistaMovil === 'form') this.vivoNuevoSinVer = true;
      });
  }

  ngOnInit(): void {
    this.obtenerContratosGenerados();
  }

  obtenerContratosGenerados() {
    this.cargandoGenerados = true;
    this.plantillaService
      .obtenerContratosGenerados()
      .pipe(finalize(() => (this.cargandoGenerados = false)))
      .subscribe({
        next: (response) => {
          this.contratosGenerados = extraerListaGenerados(response)
            .map(mapearContratoGenerado)
            .sort((a, b) => b.id - a.id);
        },
        error: (error) => {
          this.contratosGenerados = [];
          this.alertaError(error, 'Ocurrió un error al obtener los contratos generados.');
        },
      });
  }

  ngOnDestroy(): void {
    this.vivoSub.unsubscribe();
    this.cambiosSub?.unsubscribe();
    this.liberarPdf();
  }

  // ---------- Plantilla (GET /contratos/plantilla/subarrendamiento) ----------

  generarContrato() {
    this.cargandoPlantilla = true;
    this.plantillaService
      .obtenerPlantillaSubarrendamiento()
      .pipe(finalize(() => (this.cargandoPlantilla = false)))
      .subscribe({
        next: (response: any) => {
          const plantilla: PlantillaContrato = response?.data ?? response;
          if (!Array.isArray(plantilla?.secciones) || !plantilla.secciones.length) {
            this.alertaError(null, 'La plantilla del contrato no trae secciones para capturar.');
            return;
          }
          this.idContratoEditando = null;
          this.nombreContratoEditando = '';
          this.cargarEnFormulario(plantilla);
        },
        error: (error) => this.alertaError(error, 'Ocurrió un error al obtener la plantilla del contrato.'),
      });
  }

  // ---------- Editar (GET /contratos/generados/{id}) ----------

  editarContrato(row: ContratoGeneradoRow) {
    if (this.idCargandoEdicion != null) return;
    this.idCargandoEdicion = row.id;
    this.plantillaService
      .obtenerContratoGenerado(row.id)
      .pipe(finalize(() => (this.idCargandoEdicion = null)))
      .subscribe({
        next: (response) => {
          const plantilla = extraerPlantillaGenerada(response);
          if (!plantilla) {
            this.alertaError(null, 'El contrato guardado no trae la información para editarlo.');
            return;
          }
          this.idContratoEditando = row.id;
          this.nombreContratoEditando = row.nombre;
          this.cargarEnFormulario(plantilla as PlantillaContrato);
          // Muestra de una vez si algún campo guardado no cumple las validaciones
          this.intentoEnviar = true;
          this.form?.markAllAsTouched();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (error) => this.alertaError(error, 'Ocurrió un error al obtener el contrato para editarlo.'),
      });
  }

  /** Arma el formulario con la plantilla; lo que se reenvía es esta misma plantilla con "valor" actualizado. */
  private cargarEnFormulario(plantilla: PlantillaContrato) {
    this.plantillaOriginal = JSON.parse(JSON.stringify(plantilla));
    this.plantilla = plantilla;
    this.form = this.construirFormulario(plantilla);
    this.intentoEnviar = false;
    this.seccionActiva = 0;
    this.vistaMovil = 'form';

    // Vista previa en vivo: cada cambio la programa; se pide una de inmediato al abrir
    this.cambiosSub?.unsubscribe();
    this.cambiosSub = this.form.valueChanges.subscribe(() => {
      this.vivoEstado = 'pendiente';
      this.vivo$.next(false);
    });
    this.vivoPdf = null;
    this.vivoTotalPaginas = 0;
    this.vivoActualizado = null;
    this.vivoEstado = 'pendiente';
    this.vivo$.next(true);
  }

  // ---------- Cancelar / salir del formulario ----------

  /** true si al menos un campo tiene algo escrito. */
  private hayCamposLlenos(): boolean {
    if (!this.form) return false;
    return Object.values(this.form.controls).some((grupo) =>
      Object.values((grupo as FormGroup).controls).some((c) => c.value != null && String(c.value).trim() !== ''),
    );
  }

  /** Pregunta antes de perder lo capturado; si no hay nada escrito, deja salir sin preguntar. */
  private confirmarPerdidaDeDatos(): Promise<boolean> {
    if (!this.hayCamposLlenos()) return Promise.resolve(true);
    return Swal.fire({
      title: '¿Desea salir del contrato?',
      background: '#141a21',
      color: '#ffffff',
      html: 'Si sale, <strong>se perderán los datos llenados</strong> en el formulario.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Seguir capturando',
      reverseButtons: true,
    }).then((result) => result.isConfirmed);
  }

  /** Botón Cancelar del formulario: regresa a la pantalla inicial. */
  cancelarContrato() {
    this.confirmarPerdidaDeDatos().then((salir) => {
      if (salir) this.descartarContrato();
    });
  }

  /** Usado por el guard al cambiar de módulo con el formulario abierto. */
  puedeSalir(): boolean | Promise<boolean> {
    if (!this.form) return true;
    return this.confirmarPerdidaDeDatos();
  }

  /** Un FormGroup por sección (las claves se repiten entre secciones, p. ej. correo/telefono). */
  private construirFormulario(plantilla: PlantillaContrato): FormGroup {
    const grupos: Record<string, FormGroup> = {};
    for (const seccion of plantilla.secciones) {
      const controles: Record<string, FormControl> = {};
      for (const campo of seccion.campos) {
        controles[campo.clave] = new FormControl(this.valorInicial(campo), this.validadores(campo));
      }
      grupos[seccion.clave] = new FormGroup(controles);
    }
    return new FormGroup(grupos);
  }

  private valorInicial(campo: CampoPlantilla): string | number | null {
    if (campo.valor == null) return campo.tipo === 'numero' || campo.tipo === 'decimal' ? null : '';
    if (campo.tipo === 'fecha') return String(campo.valor).slice(0, 10);
    return campo.valor;
  }

  /** Todos los campos con "valor" son obligatorios; además se valida el formato según tipo/clave. */
  private validadores(campo: CampoPlantilla): ValidatorFn[] {
    const v: ValidatorFn[] = [requeridoSinEspacios];
    switch (campo.tipo) {
      case 'correo':
        v.push(Validators.email);
        break;
      case 'telefono':
        v.push(Validators.pattern(/^\d{10}$/));
        break;
      case 'numero':
        v.push(entero, Validators.min(campo.clave === 'vigenciaMeses' ? 1 : 0));
        if (campo.clave === 'diaLimitePago') v.push(Validators.min(1), Validators.max(31));
        break;
      case 'decimal':
        v.push(Validators.min(0));
        if (CLAVES_PORCENTAJE.includes(campo.clave)) v.push(Validators.max(100));
        break;
      case 'texto':
        v.push(Validators.maxLength(500));
        if (campo.clave === 'cp') v.push(Validators.pattern(/^\d{5}$/));
        if (campo.clave === 'clabe') v.push(Validators.pattern(/^\d{18}$/));
        if (campo.clave === 'rfc') v.push(Validators.pattern(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i));
        if (campo.clave === 'curp') v.push(Validators.pattern(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/i));
        break;
    }
    return v;
  }

  // ---------- Helpers de plantilla ----------

  control(seccion: SeccionPlantilla, campo: CampoPlantilla): FormControl {
    return this.form!.get([seccion.clave, campo.clave]) as FormControl;
  }

  grupo(seccion: SeccionPlantilla): FormGroup {
    return this.form!.get(seccion.clave) as FormGroup;
  }

  idCampo(seccion: SeccionPlantilla, campo: CampoPlantilla): string {
    return `campo-${seccion.clave}-${campo.clave}`;
  }

  icono(campo: CampoPlantilla): string {
    return ICONO_POR_TIPO[campo.tipo] ?? 'edit_note';
  }

  iconoSeccion(seccion: SeccionPlantilla): string {
    return INFO_SECCION[seccion.clave]?.icono ?? 'article';
  }

  descripcionSeccion(seccion: SeccionPlantilla): string {
    return INFO_SECCION[seccion.clave]?.descripcion ?? 'Completa la información de esta sección.';
  }

  tipoInput(campo: CampoPlantilla): string {
    switch (campo.tipo) {
      case 'fecha':
        return 'date';
      case 'numero':
      case 'decimal':
        return 'number';
      case 'correo':
        return 'email';
      case 'telefono':
        return 'tel';
      default:
        return 'text';
    }
  }

  paso(campo: CampoPlantilla): string | null {
    if (campo.tipo === 'numero') return '1';
    if (campo.tipo === 'decimal') return '0.01';
    return null;
  }

  maxLength(campo: CampoPlantilla): number | null {
    if (campo.tipo === 'telefono') return 10;
    if (campo.clave === 'cp') return 5;
    if (campo.clave === 'clabe') return 18;
    if (campo.clave === 'rfc') return 13;
    if (campo.clave === 'curp') return 18;
    return campo.tipo === 'texto' ? 500 : null;
  }

  inputMode(campo: CampoPlantilla): string | null {
    if (campo.tipo === 'telefono' || campo.clave === 'cp' || campo.clave === 'clabe') return 'numeric';
    if (campo.tipo === 'decimal') return 'decimal';
    if (campo.tipo === 'numero') return 'numeric';
    return null;
  }

  placeholder(campo: CampoPlantilla): string {
    if (PLACEHOLDERS[campo.clave]) return PLACEHOLDERS[campo.clave];
    switch (campo.tipo) {
      case 'correo':
        return 'correo@empresa.com';
      case 'telefono':
        return '5512345678';
      case 'decimal':
        return '0.00';
      case 'numero':
        return '0';
      default:
        return campo.etiqueta;
    }
  }

  prefijo(campo: CampoPlantilla): string | null {
    return CLAVES_MONEDA.includes(campo.clave) ? '$' : null;
  }

  sufijo(campo: CampoPlantilla): string | null {
    if (CLAVES_PORCENTAJE.includes(campo.clave)) return '%';
    if (campo.clave === 'superficieM2') return 'm²';
    if (/meses/i.test(campo.clave)) return 'meses';
    if (/^dias/i.test(campo.clave)) return 'días';
    return null;
  }

  /** Pista de formato debajo del campo (cuando no hay error). */
  ayuda(campo: CampoPlantilla): string | null {
    if (campo.tipo === 'telefono') return '10 dígitos, sin espacios.';
    if (campo.clave === 'cp') return '5 dígitos.';
    if (campo.clave === 'clabe') return '18 dígitos.';
    if (campo.clave === 'rfc') return '12 o 13 caracteres.';
    if (campo.clave === 'curp') return '18 caracteres.';
    if (campo.clave === 'diaLimitePago') return 'Del 1 al 31.';
    if (CLAVES_PORCENTAJE.includes(campo.clave)) return 'De 0 a 100.';
    return null;
  }

  /** Teléfono, CP y CLABE solo aceptan dígitos; RFC y CURP en mayúsculas. */
  normalizarEntrada(seccion: SeccionPlantilla, campo: CampoPlantilla) {
    const ctrl = this.control(seccion, campo);
    const v = ctrl.value;
    if (typeof v !== 'string') return;
    let limpio = v;
    if (campo.tipo === 'telefono' || campo.clave === 'cp' || campo.clave === 'clabe') {
      limpio = v.replace(/\D/g, '');
    } else if (campo.clave === 'rfc' || campo.clave === 'curp') {
      limpio = v.toUpperCase().replace(/\s/g, '');
    }
    if (limpio !== v) ctrl.setValue(limpio, { emitEvent: false });
  }

  campoConError(seccion: SeccionPlantilla, campo: CampoPlantilla): boolean {
    const ctrl = this.control(seccion, campo);
    return ctrl.invalid && (ctrl.touched || this.intentoEnviar);
  }

  campoValido(seccion: SeccionPlantilla, campo: CampoPlantilla): boolean {
    const ctrl = this.control(seccion, campo);
    return ctrl.valid && (ctrl.dirty || ctrl.touched);
  }

  mensajeError(seccion: SeccionPlantilla, campo: CampoPlantilla): string {
    const e = this.control(seccion, campo).errors;
    if (!e) return '';
    if (e['required']) return 'Este campo es obligatorio.';
    if (e['email']) return 'Ingresa un correo válido.';
    if (e['entero']) return 'Ingresa un número entero.';
    if (e['min']) return `El valor mínimo es ${e['min'].min}.`;
    if (e['max']) return `El valor máximo es ${e['max'].max}.`;
    if (e['maxlength']) return `Máximo ${e['maxlength'].requiredLength} caracteres.`;
    if (e['pattern']) {
      if (campo.tipo === 'telefono') return 'El teléfono debe tener 10 dígitos.';
      if (campo.clave === 'cp') return 'El código postal debe tener 5 dígitos.';
      if (campo.clave === 'clabe') return 'La CLABE debe tener 18 dígitos.';
      if (campo.clave === 'rfc') return 'Ingresa un RFC válido.';
      if (campo.clave === 'curp') return 'Ingresa una CURP válida.';
      return 'Formato no válido.';
    }
    return 'Valor no válido.';
  }

  // ---------- Avance ----------

  completosSeccion(seccion: SeccionPlantilla): number {
    const g = this.grupo(seccion);
    return seccion.campos.filter((c) => g.get(c.clave)?.valid).length;
  }

  porcentajeSeccion(seccion: SeccionPlantilla): number {
    return seccion.campos.length ? Math.round((this.completosSeccion(seccion) / seccion.campos.length) * 100) : 0;
  }

  seccionCompleta(seccion: SeccionPlantilla): boolean {
    return this.grupo(seccion).valid;
  }

  get totalCampos(): number {
    return this.plantilla?.secciones.reduce((n, s) => n + s.campos.length, 0) ?? 0;
  }

  get totalCompletos(): number {
    return this.plantilla?.secciones.reduce((n, s) => n + this.completosSeccion(s), 0) ?? 0;
  }

  get porcentajeAvance(): number {
    return this.totalCampos ? Math.round((this.totalCompletos / this.totalCampos) * 100) : 0;
  }

  /** Longitud del trazo del anillo de avance (circunferencia r = 26). */
  readonly circunferenciaAnillo = 2 * Math.PI * 26;

  get trazoAnillo(): number {
    return this.circunferenciaAnillo * (1 - this.porcentajeAvance / 100);
  }

  get esUltimaSeccion(): boolean {
    const total = this.plantilla?.secciones.length ?? 0;
    return total > 0 && this.seccionActiva === total - 1;
  }

  formatearFechaGrid(v: Date | null): string {
    if (!v || !Number.isFinite(v.getTime())) return '—';
    return v.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ---------- Secciones ----------

  seleccionarSeccion(indice: number) {
    const total = this.plantilla?.secciones.length ?? 0;
    if (indice < 0 || indice >= total) return;
    this.seccionActiva = indice;
    // Mantiene visible el paso activo en el carrusel de pasos
    setTimeout(() =>
      document
        .getElementById(`tab-${this.plantilla!.secciones[indice].clave}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }),
    );
  }

  /** Flechas izquierda/derecha, Inicio y Fin para moverse entre pasos. */
  onTeclaTabs(event: KeyboardEvent) {
    const total = this.plantilla?.secciones.length ?? 0;
    let destino: number | null = null;
    if (event.key === 'ArrowRight') destino = (this.seccionActiva + 1) % total;
    else if (event.key === 'ArrowLeft') destino = (this.seccionActiva - 1 + total) % total;
    else if (event.key === 'Home') destino = 0;
    else if (event.key === 'End') destino = total - 1;
    if (destino == null) return;
    event.preventDefault();
    this.seleccionarSeccion(destino);
    setTimeout(() => document.getElementById(`tab-${this.plantilla!.secciones[destino!].clave}`)?.focus());
  }

  // ---------- Vista previa en vivo ----------

  cambiarVistaMovil(vista: 'form' | 'preview') {
    this.vistaMovil = vista;
    if (vista === 'preview') this.vivoNuevoSinVer = false;
  }

  refrescarVivo() {
    this.vivoEstado = 'pendiente';
    this.vivo$.next(true);
  }

  zoomVivo(delta: number) {
    this.vivoZoom = Math.min(2, Math.max(0.5, Math.round((this.vivoZoom + delta) * 100) / 100));
  }

  abrirVivoEnPestana() {
    if (!this.vivoPdf) return;
    const url = URL.createObjectURL(this.vivoPdf);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  get textoEstadoVivo(): string {
    switch (this.vivoEstado) {
      case 'pendiente':
        return 'Cambios por reflejar';
      case 'cargando':
        return 'Actualizando…';
      case 'listo':
        return this.vivoActualizado
          ? `Actualizado ${this.vivoActualizado.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          : 'Actualizado';
      case 'error':
        return 'No se pudo actualizar';
      default:
        return '';
    }
  }

  onVivoRenderizado(paginas: number) {
    this.vivoTotalPaginas = paginas;
  }

  onVivoErrorRender() {
    this.vivoEstado = 'error';
  }

  // ---------- Vista previa final (POST /contratos/plantilla/subarrendamiento/vista-previa) ----------

  generarPdf() {
    if (!this.plantilla || !this.form) return;
    this.intentoEnviar = true;
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.avisarCamposFaltantes();
      return;
    }

    this.generandoPdf = true;
    const payload = this.construirPayload();
    this.plantillaService
      .vistaPreviaSubarrendamiento(payload)
      .pipe(finalize(() => (this.generandoPdf = false)))
      .subscribe({
        next: (pdf) => {
          this.ultimoPayload = payload;
          this.abrirVisorPdf(pdf);
        },
        error: async (error) => {
          // Con responseType "blob" el mensaje del backend llega como Blob
          let detalle = error;
          if (error?.error instanceof Blob) {
            try {
              detalle = { error: JSON.parse(await error.error.text()) };
            } catch {
              detalle = null;
            }
          }
          this.alertaError(detalle, 'Ocurrió un error al generar el contrato.');
        },
      });
  }

  /**
   * Mismo JSON obtenido del GET; solo se reemplaza "valor" con lo capturado (tipado según el campo).
   * Los campos vacíos van en null (la vista previa los imprime en blanco).
   */
  private construirPayload(): PlantillaContrato {
    const payload = JSON.parse(JSON.stringify(this.plantillaOriginal));
    for (const seccion of payload.secciones ?? []) {
      for (const campo of seccion.campos ?? []) {
        const crudo = this.form!.get([seccion.clave, campo.clave])?.value;
        const vacio = crudo == null || String(crudo).trim() === '';
        if (vacio) campo.valor = null;
        else campo.valor = campo.tipo === 'numero' || campo.tipo === 'decimal' ? Number(crudo) : String(crudo).trim();
      }
    }
    return payload;
  }

  private avisarCamposFaltantes() {
    const faltantes = this.plantilla!.secciones
      .map((s) => ({
        titulo: s.titulo,
        campos: s.campos.filter((c) => this.control(s, c).invalid).map((c) => c.etiqueta),
      }))
      .filter((s) => s.campos.length);
    const total = faltantes.reduce((n, s) => n + s.campos.length, 0);

    const lista = faltantes
      .map((s) => {
        const visibles = s.campos.slice(0, 4).map((c) => this.escapar(c)).join(', ');
        const resto = s.campos.length > 4 ? ` y ${s.campos.length - 4} más` : '';
        return `<li><strong>${this.escapar(s.titulo)}:</strong> ${visibles}${resto}</li>`;
      })
      .join('');

    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Revisa los campos!',
      html: `Faltan ${total} ${total === 1 ? 'campo' : 'campos'} por completar o corregir:
        <ul style="text-align:left;margin:12px 0 0;padding-left:18px;font-size:0.9rem;line-height:1.5">${lista}</ul>`,
      icon: 'warning',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
    }).then(() => this.enfocarPrimerInvalido());
  }

  private enfocarPrimerInvalido() {
    const secciones = this.plantilla!.secciones;
    for (let i = 0; i < secciones.length; i++) {
      const s = secciones[i];
      const campo = s.campos.find((c) => this.control(s, c).invalid);
      if (campo) {
        this.vistaMovil = 'form';
        this.seleccionarSeccion(i);
        // Espera a que la sección se renderice
        setTimeout(() => {
          const el = document.getElementById(this.idCampo(s, campo));
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.focus({ preventScroll: true });
        }, 250);
        return;
      }
    }
  }

  private abrirVisorPdf(pdf: Blob) {
    this.liberarPdf();
    this.pdfBlob = pdf.type === 'application/pdf' ? pdf : new Blob([pdf], { type: 'application/pdf' });
    this.pdfUrl = URL.createObjectURL(this.pdfBlob);
    const folio = String(this.form?.get(['documento', 'folio'])?.value ?? '').trim();
    this.pdfNombreArchivo = `contrato-subarrendamiento${folio ? '-' + folio.replace(/[^\w-]+/g, '_') : ''}.pdf`;
    this.mostrarVisorPdf = true;
  }

  cerrarVisorPdf() {
    this.mostrarVisorPdf = false;
    this.liberarPdf();
  }

  // ---------- Guardar (POST o PATCH /contratos/generados) + descarga ----------

  guardarContrato() {
    if (!this.ultimoPayload || !this.pdfUrl || this.guardandoContrato) return;
    this.guardandoContrato = true;
    const editando = this.idContratoEditando != null;

    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: 'Cargando...',
      html: editando
        ? 'Actualizando el contrato y preparando la descarga.'
        : 'Guardando el contrato y preparando la descarga.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    // Mismo JSON en ambos casos: el que se envió a la vista previa
    const peticion = editando
      ? this.plantillaService.actualizarContratoGenerado(this.idContratoEditando!, this.ultimoPayload)
      : this.plantillaService.guardarContratoGenerado(this.ultimoPayload);

    peticion
      .pipe(finalize(() => (this.guardandoContrato = false)))
      .subscribe({
        next: async () => {
          await this.descargarPdf();
          // El "Cargando" se quita solo cuando el servicio respondió y la descarga terminó
          Swal.close();
          await Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Operación Exitosa!',
            html: `El contrato se ${editando ? 'actualizó' : 'guardó'} correctamente y se descargó como <strong>${this.escapar(this.pdfNombreArchivo)}</strong>.`,
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
          this.descartarContrato();
          this.obtenerContratosGenerados();
        },
        error: (error) =>
          this.alertaError(error, `Ocurrió un error al ${editando ? 'actualizar' : 'guardar'} el contrato.`),
      });
  }

  /** Descarga el PDF de la vista previa (generado con el mismo JSON que se guardó). */
  private descargarPdf(): Promise<void> {
    return new Promise((resolve) => {
      const a = document.createElement('a');
      a.href = this.pdfUrl!;
      a.download = this.pdfNombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // El blob ya está en memoria; se da un respiro para que el navegador inicie la descarga
      setTimeout(resolve, 400);
    });
  }

  // ---------- Cancelar desde la vista previa ----------

  solicitarCancelar() {
    if (this.guardandoContrato) return;
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¿Qué desea hacer?',
      html:
        this.idContratoEditando != null
          ? 'Puede <strong>regresar al formulario</strong> para seguir modificando el contrato o <strong>cancelar la edición</strong>. Si cancela, el contrato guardado no cambia.'
          : 'Puede <strong>regresar al formulario</strong> para modificar la información capturada o <strong>cancelar por completo</strong> la generación del contrato. Si cancela, se perderá todo lo capturado.',
      icon: 'question',
      showDenyButton: true,
      showCloseButton: true,
      confirmButtonColor: '#3085d6',
      denyButtonColor: '#d33',
      confirmButtonText: 'Regresar a modificar',
      denyButtonText: this.idContratoEditando != null ? 'Cancelar edición' : 'Cancelar contrato',
    }).then((result) => {
      if (result.isConfirmed) {
        // Regresa al formulario con todo lo capturado
        this.cerrarVisorPdf();
      } else if (result.isDenied) {
        this.descartarContrato();
      }
    });
  }

  /** Limpia todo y regresa a la pantalla inicial. */
  private descartarContrato() {
    this.cerrarVisorPdf();
    this.cambiosSub?.unsubscribe();
    this.cambiosSub = undefined;
    this.plantilla = null;
    this.plantillaOriginal = null;
    this.form = null;
    this.ultimoPayload = null;
    this.seccionActiva = 0;
    this.intentoEnviar = false;
    this.idContratoEditando = null;
    this.nombreContratoEditando = '';
    this.vivoPdf = null;
    this.vivoEstado = 'inactivo';
    this.vivoActualizado = null;
    this.vivoTotalPaginas = 0;
    this.vivoNuevoSinVer = false;
  }

  abrirPdfEnPestana() {
    if (this.pdfUrl) window.open(this.pdfUrl, '_blank');
  }

  private liberarPdf() {
    if (this.pdfUrl) URL.revokeObjectURL(this.pdfUrl);
    this.pdfUrl = null;
    this.pdfBlob = null;
  }

  // ---------- Utilidades ----------

  private escapar(v: string): string {
    return String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  private alertaError(error: any, fallback: string) {
    const msg = error?.error?.message;
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Ops!',
      text: (Array.isArray(msg) ? msg.join(', ') : msg) || fallback,
      icon: 'error',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
    });
  }
}
