import { animate, style, transition, trigger } from '@angular/animations';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { contractDimAnim, contractModalAnim, routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { EmbudoVentasService } from 'src/app/services/moduleService/embudo-ventas.service';
import { ProspectosService } from 'src/app/services/moduleService/prospectos.service';
import Swal from 'sweetalert2';
import {
  EmbudoCard,
  EventoEmbudo,
  extraerLista,
  extraerObjeto,
  mapearEmbudo,
  mapearMedios,
  MedioComunicacion,
  MEDIOS_COMUNICACION_DEFAULT,
} from './embudo-ventas.mapper';

const ESTATUS_EVENTO_REALIZADO = 1;

/** Único rol que puede consultar el detalle, registrar/actualizar eventos y cambiar de etapa. */
const ID_ROL_EMBUDO = 8;

/** Expande/colapsa en altura y opacidad para que el cambio texto <-> editor no sea de golpe. */
const conclusionSwapAnim = trigger('conclusionSwap', [
  transition(':enter', [
    style({ height: 0, opacity: 0, transform: 'translateY(-4px)', overflow: 'hidden' }),
    animate(
      '240ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ height: '*', opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
  transition(':leave', [
    style({ height: '*', opacity: 1, overflow: 'hidden' }),
    animate('180ms cubic-bezier(0.4, 0, 1, 1)', style({ height: 0, opacity: 0, transform: 'translateY(-4px)' })),
  ]),
]);

type FiltroRapido = 'todos' | 'pendientes' | 'atrasados' | 'sinEvento';

export type ColumnaEmbudo = {
  id: string;
  estatus: number;
  titulo: string;
  tituloCorto: string;
  icono: string;
  vacio: string;
  cards: EmbudoCard[];
};

@Component({
  selector: 'app-embudo-ventas',
  templateUrl: './embudo-ventas.component.html',
  styleUrl: './embudo-ventas.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim, conclusionSwapAnim],
})
export class EmbudoVentasComponent implements OnInit {
  public loading = false;
  public columnas: ColumnaEmbudo[] = [
    { id: 'registro', estatus: 1, titulo: 'Registro', tituloCorto: 'Registro', icono: 'inbox', vacio: 'No hay embudos en registro.', cards: [] },
    { id: 'seguimiento', estatus: 2, titulo: 'Seguimiento', tituloCorto: 'Seguim.', icono: 'autorenew', vacio: 'No hay embudos en seguimiento.', cards: [] },
    { id: 'finalizado', estatus: 3, titulo: 'Finalizado', tituloCorto: 'Finalizado', icono: 'task_alt', vacio: 'No hay embudos finalizados.', cards: [] },
  ];
  public medios: MedioComunicacion[] = MEDIOS_COMUNICACION_DEFAULT;
  public filtro = '';
  /** Filtros rápidos de la barra de herramientas. */
  public filtroRapido: FiltroRapido = 'todos';
  public readonly filtrosRapidos: { id: FiltroRapido; texto: string; icono: string }[] = [
    { id: 'todos', texto: 'Todos', icono: 'apps' },
    { id: 'pendientes', texto: 'Con pendientes', icono: 'pending_actions' },
    { id: 'atrasados', texto: 'Atrasados', icono: 'alarm' },
    { id: 'sinEvento', texto: 'Sin evento', icono: 'event_busy' },
  ];
  /** Circunferencia del anillo de avance (r = 26). */
  public readonly circunferenciaAnillo = 2 * Math.PI * 26;
  private embudos: EmbudoCard[] = [];

  public mostrarModalEvento = false;
  public embudoSeleccionado: EmbudoCard | null = null;
  public guardandoEvento = false;
  public eventoForm: FormGroup;

  public mostrarModalHistorial = false;
  public historialEmbudo: EmbudoCard | null = null;
  public cargandoHistorial = false;

  public editandoConclusionId: number | null = null;
  public borradorConclusion = '';
  public guardandoConclusion = false;
  public errorConclusion = '';
  public conclusionGuardadaId: number | null = null;
  private timerConclusionGuardada: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private embudoService: EmbudoVentasService,
    private prospectosService: ProspectosService,
    private authService: AuthenticationService,
    private fb: FormBuilder,
  ) {
    this.eventoForm = this.fb.group({
      fhProximoEvento: [null, Validators.required],
      medioComunicacion: [null, Validators.required],
      comentario: [''],
    });
  }

  ngOnInit(): void {
    this.obtenerMedios();
    this.obtenerEmbudos();
  }

  obtenerMedios() {
    this.embudoService.obtenerMediosComunicacion().subscribe({
      next: (response) => {
        this.medios = mapearMedios(response);
        // Re-etiqueta medios en caso de que los embudos hayan llegado antes
        this.embudos.forEach((card) =>
          card.eventos.forEach((ev) => {
            const medio = this.medios.find((m) => m.id === ev.medioComunicacion);
            if (medio) ev.medioNombre = medio.nombre;
          }),
        );
        this.distribuir();
      },
      error: () => (this.medios = MEDIOS_COMUNICACION_DEFAULT),
    });
  }

  obtenerEmbudos() {
    this.loading = true;
    this.embudoService
      .obtenerEmbudos()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.embudos = extraerLista(response)
            .map((item: any) => mapearEmbudo(item, this.medios))
            .sort((a, b) => b.id - a.id);
          this.distribuir();
        },
        error: (error) => {
          this.embudos = [];
          this.distribuir();
          this.mostrarError(error, 'Ocurrió un error al obtener el embudo de ventas.');
        },
      });
  }

  private distribuir() {
    this.columnas.forEach((col) => {
      col.cards = this.embudos.filter((c) => c.estatus === col.estatus);
    });
  }

  // ---------- Filtro ----------

  coincideFiltro(card: EmbudoCard): boolean {
    if (!this.cumpleFiltroRapido(card, this.filtroRapido)) return false;
    const q = this.normalizar(this.filtro);
    if (!q) return true;
    return [
      card.nombreCliente,
      card.nombreUsuario,
      card.correo,
      card.telefono,
      card.rfc,
      String(card.id),
    ].some((v) => this.normalizar(v).includes(q));
  }

  visibles(col: ColumnaEmbudo): number {
    return col.cards.filter((c) => this.coincideFiltro(c)).length;
  }

  hayEmbudos(): boolean {
    return this.embudos.length > 0;
  }

  private cumpleFiltroRapido(card: EmbudoCard, filtro: FiltroRapido): boolean {
    switch (filtro) {
      case 'pendientes':
        return card.eventosPendientes > 0;
      case 'atrasados':
        return this.esAtrasado(card);
      case 'sinEvento':
        return !this.fhProximo(card);
      default:
        return true;
    }
  }

  contarFiltroRapido(filtro: FiltroRapido): number {
    return this.embudos.filter((c) => this.cumpleFiltroRapido(c, filtro)).length;
  }

  // ---------- Indicadores ----------

  get totalEmbudos(): number {
    return this.embudos.length;
  }

  get totalEventosPendientes(): number {
    return this.embudos.reduce((n, c) => n + (c.eventosPendientes || 0), 0);
  }

  get totalAtrasados(): number {
    return this.contarFiltroRapido('atrasados');
  }

  /** Próximo evento más cercano (a futuro) de todo el embudo. */
  get proximoGlobal(): { card: EmbudoCard; fh: string } | null {
    const ahora = Date.now();
    let mejor: { card: EmbudoCard; fh: string; t: number } | null = null;
    for (const card of this.embudos) {
      const fh = this.fhProximo(card);
      const t = fh ? new Date(fh).getTime() : NaN;
      if (!Number.isFinite(t) || t < ahora) continue;
      if (!mejor || t < mejor.t) mejor = { card, fh: fh!, t };
    }
    return mejor ? { card: mejor.card, fh: mejor.fh } : null;
  }

  porcentajeColumna(col: ColumnaEmbudo): number {
    return this.embudos.length ? Math.round((col.cards.length / this.embudos.length) * 100) : 0;
  }

  /** % de embudos en la última etapa. */
  get porcentajeFinalizado(): number {
    return this.porcentajeColumna(this.columnas[this.columnas.length - 1]);
  }

  get trazoAnillo(): number {
    return this.circunferenciaAnillo * (1 - this.porcentajeFinalizado / 100);
  }

  // ---------- Presentación de la card ----------

  /** Fecha del próximo evento venga como objeto o como texto. */
  fhProximo(card: EmbudoCard): string | null {
    const prox = card.proximoEvento;
    if (!prox) return null;
    return typeof prox === 'string' ? prox : prox.fhProximoEvento;
  }

  /** El próximo evento ya pasó y no tiene conclusión registrada. */
  esAtrasado(card: EmbudoCard): boolean {
    const fh = this.fhProximo(card);
    if (!fh) return false;
    const t = new Date(fh).getTime();
    if (!Number.isFinite(t) || t >= Date.now()) return false;
    const prox = this.proximoEventoDetalle(card);
    return prox ? !this.eventoConcluido(prox) : true;
  }

  iconoProximo(card: EmbudoCard): string {
    const prox = this.proximoEventoDetalle(card);
    return prox ? this.iconoMedio(prox) : 'event';
  }

  /** "en 2 días", "en 3 h", "hace 5 min"… */
  tiempoRelativo(fh: string | null): string {
    if (!fh) return '';
    const t = new Date(fh).getTime();
    if (!Number.isFinite(t)) return '';
    const diff = t - Date.now();
    const abs = Math.abs(diff);
    const min = Math.round(abs / 60000);
    const horas = Math.round(abs / 3600000);
    const dias = Math.round(abs / 86400000);
    let texto: string;
    if (min < 1) return 'ahora';
    if (min < 60) texto = `${min} min`;
    else if (horas < 24) texto = `${horas} h`;
    else if (dias < 30) texto = `${dias} ${dias === 1 ? 'día' : 'días'}`;
    else {
      const meses = Math.round(dias / 30);
      texto = `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }
    return diff >= 0 ? `en ${texto}` : `hace ${texto}`;
  }

  iniciales(nombre: string): string {
    const partes = String(nombre ?? '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (!partes.length) return '?';
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  }

  /** Tono estable por nombre para el avatar. */
  tonoAvatar(nombre: string): number {
    let h = 0;
    for (const ch of String(nombre ?? '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  iconoMedioId(id: number | null): string {
    return this.iconoMedio({ medioComunicacion: id } as EventoEmbudo);
  }

  private normalizar(v: unknown): string {
    return (v == null ? '' : String(v))
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  // ---------- Drag & Drop ----------

  onDrop(event: CdkDragDrop<ColumnaEmbudo, ColumnaEmbudo, EmbudoCard>) {
    const destino = event.container.data;
    const origen = event.previousContainer.data;
    const card = event.item.data;
    if (!event.isPointerOverContainer || destino.estatus === origen.estatus) return;
    if (!this.validarRolEmbudo('cambiar la etapa del embudo')) return;

    const estatusAnterior = card.estatus;
    this.actualizarEstatusLocal(card.id, destino.estatus);

    this.embudoService.updateEstatus(card.id, destino.estatus).subscribe({
      next: () => {
        Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          title: '¡Operación Exitosa!',
          html: `<strong>${this.escapar(card.nombreCliente)}</strong> ahora se encuentra en la etapa de <strong>${destino.titulo}</strong>.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      },
      error: (error) => {
        this.actualizarEstatusLocal(card.id, estatusAnterior);
        this.mostrarError(error, 'Ocurrió un error al actualizar el estatus del embudo.');
      },
    });
  }

  private actualizarEstatusLocal(id: number, estatus: number) {
    this.embudos = this.embudos.map((c) => (c.id === id ? { ...c, estatus } : c));
    this.distribuir();
  }

  // ---------- Pasar a cliente (PATCH /clientes/prospecto/{idCliente}) ----------

  convertirACliente(card: EmbudoCard) {
    if (card.idCliente == null) {
      this.mostrarError(null, 'El embudo no tiene un prospecto asociado.');
      return;
    }
    Swal.fire({
      title: '¡Pasar a Cliente!',
      background: '#141a21',
      color: '#ffffff',
      html: `¿Está seguro que requiere pasar a cliente el prospecto: <strong>${this.escapar(card.nombreCliente)}</strong>?<br><br>Esta acción no se puede revertir, ya no podrá regresar a prospecto.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.value) return;
      this.prospectosService.convertirACliente(card.idCliente!).subscribe({
        next: () => {
          Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Confirmación Realizada!',
            html: 'El prospecto ha sido convertido a cliente.',
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
          if (this.historialEmbudo?.id === card.id) this.cerrarModalHistorial();
          // El listado solo trae embudos cuyo cliente sigue siendo prospecto
          this.obtenerEmbudos();
        },
        error: (error) => this.mostrarError(error, 'Error al intentar pasar el prospecto a cliente.'),
      });
    });
  }

  private escapar(v: string): string {
    return String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // ---------- Textos de tarjeta (valores vacíos o en 0) ----------

  textoVendedor(card: EmbudoCard): string {
    return card.nombreUsuario || 'Sin vendedor asignado';
  }

  textoTelefono(card: EmbudoCard): string {
    return card.telefono || 'Sin teléfono registrado';
  }

  textoCorreo(card: EmbudoCard): string {
    return card.correo || 'Sin correo registrado';
  }

  /** Clave (`id-campo`) del dato recién copiado, para mostrar la confirmación en la card. */
  datoCopiado: string | null = null;
  private datoCopiadoTimer?: ReturnType<typeof setTimeout>;

  copiarDato(card: EmbudoCard, campo: 'telefono' | 'correo', event: Event): void {
    event.stopPropagation();
    const valor = String(card[campo] ?? '').trim();
    if (!valor) return;
    const clave = `${card.id}-${campo}`;
    const marcar = () => {
      this.datoCopiado = clave;
      clearTimeout(this.datoCopiadoTimer);
      this.datoCopiadoTimer = setTimeout(() => {
        if (this.datoCopiado === clave) this.datoCopiado = null;
      }, 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(valor).then(marcar, () => this.copiarDatoFallback(valor) && marcar());
    } else if (this.copiarDatoFallback(valor)) {
      marcar();
    }
  }

  private copiarDatoFallback(valor: string): boolean {
    const area = document.createElement('textarea');
    area.value = valor;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  textoRfc(card: EmbudoCard): string {
    return card.rfc || 'Sin RFC registrado';
  }

  textoTipo(card: EmbudoCard): string {
    if (card.esProspecto == null) return 'Tipo no especificado';
    return card.esProspecto ? 'Prospecto' : 'Cliente';
  }

  textoEstatus(card: EmbudoCard): string {
    return this.columnas.find((c) => c.estatus === card.estatus)?.titulo ?? `Estatus ${card.estatus || 'sin definir'}`;
  }

  /** Solo cuando el próximo evento viene como objeto (detalle por id). */
  proximoEventoDetalle(card: EmbudoCard): EventoEmbudo | null {
    return card.proximoEvento && typeof card.proximoEvento === 'object' ? card.proximoEvento : null;
  }

  /** Historial sin el próximo evento (ya se muestra arriba). */
  eventosHistorial(card: EmbudoCard): EventoEmbudo[] {
    const prox = this.proximoEventoDetalle(card);
    if (!prox) return card.eventos;
    return card.eventos.filter((ev) => !this.esMismoEvento(ev, prox));
  }

  private esMismoEvento(a: EventoEmbudo, b: EventoEmbudo): boolean {
    if (a.id > 0 && b.id > 0) return a.id === b.id;
    return (
      a.fhProximoEvento === b.fhProximoEvento &&
      a.medioComunicacion === b.medioComunicacion &&
      a.comentario === b.comentario
    );
  }

  /** Fecha corta (dd/mm hh:mm) para columnas muy angostas. */
  fechaCortaProximoEvento(card: EmbudoCard): string {
    const prox = card.proximoEvento;
    const fh = !prox ? null : typeof prox === 'string' ? prox : prox.fhProximoEvento;
    if (!fh) return '—';
    const d = new Date(fh);
    if (!Number.isFinite(d.getTime())) return '—';
    const dos = (n: number) => String(n).padStart(2, '0');
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
  }

  textoEventosPendientes(card: EmbudoCard): string {
    const n = card.eventosPendientes;
    if (!n) return 'Sin eventos pendientes';
    return `${n} ${n === 1 ? 'evento pendiente' : 'eventos pendientes'}`;
  }

  textoEventosRealizados(card: EmbudoCard): string {
    const n = card.eventosRealizados;
    if (!n) return 'Sin eventos realizados';
    return `${n} ${n === 1 ? 'evento realizado' : 'eventos realizados'}`;
  }

  textoProximoEvento(card: EmbudoCard): string {
    const prox = card.proximoEvento;
    if (!prox) return 'Sin próximo evento programado';
    if (typeof prox === 'string') return this.formatearFecha(prox);
    return `${prox.medioNombre} · ${this.formatearFecha(prox.fhProximoEvento)}`;
  }

  // ---------- Eventos ----------

  eventoConcluido(ev: EventoEmbudo): boolean {
    return ev.estatus === ESTATUS_EVENTO_REALIZADO;
  }

  textoEstatusEvento(ev: EventoEmbudo): string {
    return this.eventoConcluido(ev) ? 'Realizado' : 'Pendiente';
  }

  // ---------- Historial (GET /embudo-ventas/{id}) ----------

  verHistorial(card: EmbudoCard) {
    if (!this.validarRolEmbudo('consultar el detalle del embudo')) return;
    this.historialEmbudo = card;
    this.mostrarModalHistorial = true;
    this.cargandoHistorial = true;
    this.embudoService
      .obtenerEmbudo(card.id)
      .pipe(finalize(() => (this.cargandoHistorial = false)))
      .subscribe({
        next: (response) => {
          const actualizado = mapearEmbudo(extraerObjeto(response), this.medios);
          if (!actualizado.id) return;
          this.aplicarEmbudoActualizado(card.id, actualizado);
        },
        error: (error) => this.mostrarError(error, 'Ocurrió un error al obtener el historial de eventos.'),
      });
  }

  cerrarModalHistorial() {
    this.cancelarConclusion(true);
    this.mostrarModalHistorial = false;
    this.historialEmbudo = null;
  }

  iconoMedio(ev: EventoEmbudo): string {
    switch (ev.medioComunicacion) {
      case 1:
        return 'call';
      case 2:
        return 'mail';
      case 3:
        return 'directions_walk';
      default:
        return 'event';
    }
  }

  abrirModalEvento(card: EmbudoCard) {
    if (!this.validarRolEmbudo('registrar eventos')) return;
    this.embudoSeleccionado = card;
    this.eventoForm.reset({ fhProximoEvento: null, medioComunicacion: null, comentario: '' });
    this.mostrarModalEvento = true;
  }

  /** Desde el detalle: cierra el detalle y abre el registro de evento. */
  agregarEventoDesdeDetalle(card: EmbudoCard) {
    this.cerrarModalHistorial();
    this.abrirModalEvento(card);
  }

  seleccionarMedio(id: number) {
    this.eventoForm.patchValue({ medioComunicacion: id });
    this.eventoForm.get('medioComunicacion')?.markAsTouched();
  }

  /** Atajos de fecha/hora para el próximo evento (valor para input datetime-local). */
  aplicarFechaRapida(tipo: 'hoy' | 'manana' | 'tresDias' | 'semana') {
    const d = new Date();
    switch (tipo) {
      case 'hoy':
        d.setHours(16, 0, 0, 0);
        if (d.getTime() <= Date.now()) d.setTime(Date.now() + 60 * 60000); // si ya pasó, en una hora
        break;
      case 'manana':
        d.setDate(d.getDate() + 1);
        d.setHours(10, 0, 0, 0);
        break;
      case 'tresDias':
        d.setDate(d.getDate() + 3);
        d.setHours(10, 0, 0, 0);
        break;
      case 'semana':
        d.setDate(d.getDate() + 7);
        d.setHours(10, 0, 0, 0);
        break;
    }
    const dos = (n: number) => String(n).padStart(2, '0');
    const valor = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
    this.eventoForm.patchValue({ fhProximoEvento: valor });
    this.eventoForm.get('fhProximoEvento')?.markAsTouched();
  }

  campoEventoInvalido(nombre: string): boolean {
    const c = this.eventoForm.get(nombre);
    return !!c && c.invalid && c.touched;
  }

  cerrarModalEvento() {
    if (this.guardandoEvento) return;
    this.mostrarModalEvento = false;
    this.embudoSeleccionado = null;
  }

  guardarEvento() {
    if (!this.validarRolEmbudo('registrar eventos')) return;
    if (this.eventoForm.invalid || !this.embudoSeleccionado) {
      this.eventoForm.markAllAsTouched();
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Revisa los campos!',
        html: 'La fecha del próximo evento y el medio de comunicación son obligatorios.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const v = this.eventoForm.value;
    const card = this.embudoSeleccionado;
    const comentario = String(v.comentario ?? '').trim();
    // datetime-local entrega "YYYY-MM-DDTHH:mm"; la API espera segundos
    const fh = String(v.fhProximoEvento);
    const fhProximoEvento = fh.length === 16 ? `${fh}:00` : fh;

    this.guardandoEvento = true;
    this.embudoService
      .agregarEvento(card.id, {
        fhProximoEvento,
        medioComunicacion: Number(v.medioComunicacion),
        comentario: comentario || null,
      })
      .pipe(finalize(() => (this.guardandoEvento = false)))
      .subscribe({
        next: () => {
          this.mostrarModalEvento = false;
          this.embudoSeleccionado = null;
          this.refrescarCard(card.id);
          Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Operación Exitosa!',
            text: 'Se agregó el evento de manera exitosa.',
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
        },
        error: (error) => this.mostrarError(error, 'Ocurrió un error al agregar el evento.'),
      });
  }

  // ---------- Conclusion de evento (edicion en linea) ----------

  /** El boton del evento abre el editor o, si ya esta abierto, lo cierra. */
  toggleConclusion(ev: EventoEmbudo) {
    if (!this.validarRolEmbudo('actualizar eventos')) return;
    if (this.guardandoConclusion) return;
    if (this.editandoConclusionId === ev.id) {
      this.cancelarConclusion();
      return;
    }
    this.editandoConclusionId = ev.id;
    this.borradorConclusion = ev.conclusionEvento ?? '';
    this.errorConclusion = '';
    // Espera a que el textarea entre al DOM para enfocarlo
    setTimeout(() => {
      const input = document.getElementById(`conclusion-${ev.id}`) as HTMLTextAreaElement | null;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }, 60);
  }

  cancelarConclusion(forzar = false) {
    if (this.guardandoConclusion && !forzar) return;
    this.editandoConclusionId = null;
    this.borradorConclusion = '';
    this.errorConclusion = '';
  }

  onTeclaConclusion(event: KeyboardEvent, card: EmbudoCard, ev: EventoEmbudo) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.cancelarConclusion();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.confirmarConclusion(card, ev);
    }
  }

  confirmarConclusion(card: EmbudoCard, ev: EventoEmbudo) {
    if (!this.validarRolEmbudo('actualizar eventos')) return;
    const conclusion = this.borradorConclusion.trim();
    if (!conclusion) {
      this.errorConclusion = 'La conclusión del evento es obligatoria.';
      return;
    }
    if (conclusion === (ev.conclusionEvento ?? '').trim()) {
      this.cancelarConclusion();
      return;
    }

    this.guardandoConclusion = true;
    this.errorConclusion = '';
    this.embudoService
      .registrarConclusionEvento(ev.id, conclusion)
      .pipe(finalize(() => (this.guardandoConclusion = false)))
      .subscribe({
        next: () => {
          ev.conclusionEvento = conclusion;
          this.editandoConclusionId = null;
          this.borradorConclusion = '';
          this.marcarConclusionGuardada(ev.id);
          this.refrescarCard(card.id);
          this.preguntarNuevoEvento(card);
        },
        error: (error) => {
          const msg = error?.error?.message;
          this.errorConclusion =
            (Array.isArray(msg) ? msg.join(', ') : msg) ||
            'Ocurrió un error al registrar la conclusión del evento.';
        },
      });
  }

  /** Tras registrar la conclusión: "Sí" abre el registro de evento, "No" cierra el modal. */
  private preguntarNuevoEvento(card: EmbudoCard) {
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Operación Exitosa!',
      text: 'La conclusión del evento se guardó correctamente.',
      icon: 'success',
      footer: '<span style="color:#c1c7e6">¿Desea registrar un nuevo evento para este embudo?</span>',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'No',
      reverseButtons: false,
      allowOutsideClick: false,
    }).then((result) => {
      const embudo = this.historialEmbudo?.id === card.id ? this.historialEmbudo : card;
      this.cerrarModalHistorial();
      if (result.isConfirmed) this.abrirModalEvento(embudo);
    });
  }

  /** Resalta brevemente la conclusion recien guardada. */
  private marcarConclusionGuardada(id: number) {
    if (this.timerConclusionGuardada) clearTimeout(this.timerConclusionGuardada);
    this.conclusionGuardadaId = id;
    this.timerConclusionGuardada = setTimeout(() => (this.conclusionGuardadaId = null), 1800);
  }

  /** Recarga un solo embudo para reflejar su historial sin perder la posición de las listas. */
  private refrescarCard(id: number) {
    this.embudoService.obtenerEmbudo(id).subscribe({
      next: (response) => {
        const actualizado = mapearEmbudo(extraerObjeto(response), this.medios);
        if (!actualizado.id) return;
        this.aplicarEmbudoActualizado(id, actualizado);
      },
      error: () => this.obtenerEmbudos(),
    });
  }

  /** El detalle puede no traer los datos del listado (vendedor, prospecto…); solo se reemplaza lo que sí llega. */
  private aplicarEmbudoActualizado(id: number, act: EmbudoCard) {
    const fusionar = (base: EmbudoCard): EmbudoCard => ({
      ...base,
      nombreCliente: act.nombreCliente || base.nombreCliente,
      nombreUsuario: act.nombreUsuario || base.nombreUsuario,
      correo: act.correo || base.correo,
      telefono: act.telefono || base.telefono,
      rfc: act.rfc || base.rfc,
      esProspecto: act.esProspecto ?? base.esProspecto,
      eventos: act.eventos,
      eventosPendientes: act.eventosPendientes,
      eventosRealizados: act.eventosRealizados,
      proximoEvento: act.proximoEvento ?? base.proximoEvento,
      fechaCreacion: act.fechaCreacion ?? base.fechaCreacion,
      fechaActualizacion: act.fechaActualizacion ?? base.fechaActualizacion,
    });
    this.embudos = this.embudos.map((c) => (c.id === id ? fusionar(c) : c));
    if (this.historialEmbudo?.id === id) this.historialEmbudo = fusionar(this.historialEmbudo);
    this.distribuir();
  }

  // ---------- Permiso por rol ----------

  /** `user.rol` / `user.idRol` como número u objeto con id (mismo criterio que lista-arrendatarios). */
  private obtenerIdRolUsuario(): number | null {
    const user = this.authService.getUser() as Record<string, unknown> | null;
    if (user == null) return null;
    const rolRaw = user['idRol'] ?? user['rol'];
    if (rolRaw != null && typeof rolRaw === 'object' && !Array.isArray(rolRaw)) {
      const o = rolRaw as Record<string, unknown>;
      const id = Number(o['id'] ?? o['idRol'] ?? o['rol']);
      return Number.isFinite(id) ? id : null;
    }
    const n = Number(rolRaw);
    return rolRaw != null && Number.isFinite(n) ? n : null;
  }

  private validarRolEmbudo(accion: string): boolean {
    if (this.obtenerIdRolUsuario() === ID_ROL_EMBUDO) return true;
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Acceso restringido!',
      text: `Tu rol no tiene permitido ${accion}. Solicita el acceso a un administrador.`,
      icon: 'warning',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
    });
    return false;
  }

  // ---------- Utilidades ----------

  formatearFecha(v: string | null): string {
    if (!v) return '—';
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return String(v);
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackById = (_: number, item: { id: number }) => item.id;

  private mostrarError(error: any, fallback: string) {
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
