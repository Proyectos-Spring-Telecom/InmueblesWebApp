import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  ConversacionDetalle,
  ConversacionResumen,
  TextAgentError,
  TextAgentService,
} from 'src/app/services/moduleService/text-agent.service';
import { renderAgentMarkdown } from './agent-markdown';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  createdAt: number;
  text?: string;
  html?: string;
  /** Respuestas rápidas cuando el agente pregunta "¿Quisiste decir…?" o "¿Es alguna de estas?". */
  opciones?: OpcionRapida[];
}

interface OpcionRapida {
  /** Texto del botón. */
  label: string;
  /** Lo que se envía al agente ("sí", "no", "1"…). */
  valor: string;
}

/** Sugerencias al abrir el chat (agente_consumo_front.md §9). */
const SUGERENCIAS = ['¿Quién me debe?', 'Cobrado este mes', 'Contratos por vencer', '¿Cómo van las rentas de este mes?'];

@Component({
  selector: 'app-assistant-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assistant-chat.component.html',
  styleUrl: './assistant-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantChatComponent implements OnDestroy {
  open = false;
  busy = false;
  agentDown = false;
  cooldownSec = 0;

  readonly input = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.maxLength(4000)],
  });

  messages: ChatMessage[] = [];
  readonly sugerencias = SUGERENCIAS;

  /** Vista del panel: el chat o la lista de conversaciones anteriores. */
  vista: 'chat' | 'historial' = 'chat';
  historial: ConversacionResumen[] = [];
  historialPagina = 1;
  historialUltimaPagina = 1;
  historialCargando = false;
  historialError = '';
  /** Borrado en curso y borrado pendiente de confirmar (confirmación en línea). */
  borrandoId: string | null = null;
  confirmarBorrarId: string | null = null;
  /** Al abrir el chat por primera vez se recupera la conversación en curso (sobrevive a recargar). */
  private restaurada = false;

  @ViewChild('scrollViewport') private scrollViewport?: ElementRef<HTMLDivElement>;

  private askSub: Subscription | null = null;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private agent: TextAgentService,
    private cdr: ChangeDetectorRef,
  ) {
    this.messages = [this.welcome()];
  }

  ngOnDestroy() {
    this.clearAsk();
    this.clearCooldown();
  }

  get sendDisabled(): boolean {
    return this.busy || this.cooldownSec > 0 || !this.input.value.trim();
  }

  /** Solo la bienvenida en pantalla: se muestran las sugerencias. */
  get mostrarSugerencias(): boolean {
    return !this.busy && this.messages.length === 1 && this.vista === 'chat';
  }

  /** Respuestas rápidas del último mensaje del agente (desaparecen al seguir conversando). */
  get opcionesActuales(): OpcionRapida[] {
    if (this.busy || this.cooldownSec > 0) return [];
    const ultimo = this.messages[this.messages.length - 1];
    return ultimo?.role === 'assistant' ? ultimo.opciones ?? [] : [];
  }

  toggle() {
    this.open = !this.open;
    if (this.open) {
      this.checkHealth();
      this.restaurarConversacion();
      queueMicrotask(() => this.scrollToBottom(true));
    }
    this.cdr.detectChanges();
  }

  close() {
    this.open = false;
    this.cdr.detectChanges();
  }

  /** Nueva conversación: limpia conversation_id y vuelve a la bienvenida. */
  nuevaConversacion() {
    this.clearAsk();
    this.busy = false;
    this.vista = 'chat';
    this.agent.nuevaConversacion();
    this.input.setValue('');
    this.messages = [this.welcome()];
    this.cdr.detectChanges();
    queueMicrotask(() => this.scrollToBottom(true));
  }

  send(text?: string) {
    const raw = (text ?? this.input.value).trim();
    if (!raw || this.busy || this.cooldownSec > 0) return;
    // Si se escribe desde el historial, se regresa al chat para ver la respuesta.
    this.vista = 'chat';

    this.messages = [
      ...this.messages,
      { id: crypto.randomUUID(), role: 'user', text: raw, createdAt: Date.now() },
    ];
    this.input.setValue('');
    this.busy = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    this.clearAsk();
    this.askSub = this.agent.preguntar(raw).subscribe({
      next: (res) => {
        this.messages = [
          ...this.messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            createdAt: Date.now(),
            html: renderAgentMarkdown(res.response),
            opciones: detectarOpciones(res.response),
          },
        ];
        this.busy = false;
        this.agentDown = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: (err: unknown) => {
        this.busy = false;
        this.pushSystemError(err);
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
    });
  }

  onKeydownEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    this.send();
  }

  // ─── Historial de conversaciones (GET / DELETE /conversations) ──────────────

  verHistorial() {
    this.vista = 'historial';
    this.confirmarBorrarId = null;
    this.cargarHistorial(1);
  }

  volverAlChat() {
    this.vista = 'chat';
    this.cdr.detectChanges();
    queueMicrotask(() => this.scrollToBottom(true));
  }

  cargarHistorial(pagina: number) {
    this.historialCargando = true;
    this.historialError = '';
    this.cdr.detectChanges();
    this.agent.listarConversaciones(pagina, 20).subscribe({
      next: (res) => {
        const nuevas = res?.data ?? [];
        this.historial = pagina === 1 ? nuevas : [...this.historial, ...nuevas];
        this.historialPagina = res?.paginated?.page ?? pagina;
        this.historialUltimaPagina = res?.paginated?.last_page ?? pagina;
        this.historialCargando = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.historialCargando = false;
        this.historialError = err instanceof TextAgentError ? err.message : 'No se pudo cargar el historial.';
        this.cdr.detectChanges();
      },
    });
  }

  esConversacionActual(id: string): boolean {
    return this.agent.conversationId === id;
  }

  abrirDelHistorial(c: ConversacionResumen) {
    if (this.historialCargando) return;
    this.historialCargando = true;
    this.historialError = '';
    this.cdr.detectChanges();
    this.agent.abrirConversacion(c.id).subscribe({
      next: (conv) => {
        this.historialCargando = false;
        this.mostrarConversacion(conv);
        this.vista = 'chat';
        this.cdr.detectChanges();
        queueMicrotask(() => this.scrollToBottom(true));
      },
      error: (err: unknown) => {
        this.historialCargando = false;
        // 404: ya no existe (borrada o de otro usuario): se quita de la lista.
        if (err instanceof TextAgentError && err.code === 'NO_ENCONTRADA') {
          this.historial = this.historial.filter((h) => h.id !== c.id);
          this.historialError = 'Esa conversación ya no está disponible.';
        } else {
          this.historialError = err instanceof TextAgentError ? err.message : 'No se pudo abrir la conversación.';
        }
        this.cdr.detectChanges();
      },
    });
  }

  pedirBorrar(id: string) {
    this.confirmarBorrarId = this.confirmarBorrarId === id ? null : id;
    this.cdr.detectChanges();
  }

  borrar(id: string) {
    if (this.borrandoId) return;
    this.borrandoId = id;
    this.cdr.detectChanges();
    const eraActual = this.esConversacionActual(id);
    this.agent.borrarConversacion(id).subscribe({
      next: () => {
        this.borrandoId = null;
        this.confirmarBorrarId = null;
        this.historial = this.historial.filter((h) => h.id !== id);
        if (eraActual) this.messages = [this.welcome()];
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.borrandoId = null;
        this.historialError = err instanceof TextAgentError ? err.message : 'No se pudo borrar la conversación.';
        this.cdr.detectChanges();
      },
    });
  }

  /** Recupera la conversación en curso (conversation_id en sessionStorage) tras recargar la página. */
  private restaurarConversacion() {
    if (this.restaurada) return;
    this.restaurada = true;
    const id = this.agent.conversationId;
    if (!id || this.messages.length > 1) return;
    this.busy = true;
    this.agent.abrirConversacion(id).subscribe({
      next: (conv) => {
        this.busy = false;
        this.mostrarConversacion(conv);
        this.cdr.detectChanges();
        queueMicrotask(() => this.scrollToBottom(true));
      },
      error: () => {
        // Ya no existe o el agente no responde: se empieza de cero sin mostrar error.
        this.busy = false;
        this.agent.nuevaConversacion();
        this.cdr.detectChanges();
      },
    });
  }

  private mostrarConversacion(conv: ConversacionDetalle) {
    const mensajes: ChatMessage[] = (conv.messages ?? []).map((m) => {
      const fecha = Date.parse(m.created_at);
      const createdAt = Number.isFinite(fecha) ? fecha : Date.now();
      return m.role === 'user'
        ? { id: crypto.randomUUID(), role: 'user' as const, text: m.content, createdAt }
        : { id: crypto.randomUUID(), role: 'assistant' as const, html: renderAgentMarkdown(m.content), createdAt };
    });
    // Solo el último mensaje del agente puede llevar respuestas rápidas.
    const ultimo = mensajes[mensajes.length - 1];
    if (ultimo?.role === 'assistant') {
      ultimo.opciones = detectarOpciones(conv.messages[conv.messages.length - 1]?.content ?? '');
    }
    this.messages = [this.welcome(), ...mensajes];
  }

  private checkHealth() {
    this.agent.health().subscribe((ok) => {
      this.agentDown = !ok;
      this.cdr.detectChanges();
    });
  }

  private pushSystemError(err: unknown) {
    let text = 'El asistente no está disponible. Intenta más tarde.';
    if (err instanceof TextAgentError) {
      text = err.message;
      if (err.code === 'DEMASIADAS_PREGUNTAS') {
        this.startCooldown(err.retryAfterSec ?? 30);
      }
      if (err.code === 'AGENTE_NO_DISPONIBLE') this.agentDown = true;
    }
    this.messages = [
      ...this.messages,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        createdAt: Date.now(),
        html: renderAgentMarkdown(text),
      },
    ];
  }

  private startCooldown(sec: number) {
    this.clearCooldown();
    this.cooldownSec = Math.max(1, Math.ceil(sec));
    this.cooldownTimer = setInterval(() => {
      this.cooldownSec -= 1;
      if (this.cooldownSec <= 0) this.clearCooldown();
      this.cdr.detectChanges();
    }, 1000);
  }

  private clearCooldown() {
    if (this.cooldownTimer != null) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.cooldownSec = 0;
  }

  private clearAsk() {
    if (this.askSub) {
      this.askSub.unsubscribe();
      this.askSub = null;
    }
  }


  private welcome(): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      createdAt: Date.now(),
      html: renderAgentMarkdown(
        '👋 ¡Hola! Soy **Spring**, tu asistente virtual.\n\n' +
        'Estoy aquí para ayudarte a consultar información sobre tus cuentas, adeudos, inmuebles, locales, arrendatarios y contratos de forma rápida y sencilla.\n\n' +
        '💬 **¿Cómo puedo ayudarte hoy?**\n\n' +
        'Puedes preguntarme con tus propias palabras, por ejemplo: *¿Tengo pagos pendientes?* o *¿Cuál es el estado de mi cuenta?*\n\n' +
        '🔒 Recuerda que puedo ayudarte con consultas. Para registrar o modificar información, utiliza las opciones de la plataforma.',
      ),
    };
  }


  private scrollToBottom(instant = false) {
    const el = this.scrollViewport?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  }
}

/**
 * Respuestas rápidas para las preguntas de aclaración del agente (agente_consumo_front.md §8 y §9):
 *  - "¿Es alguna de estas? 1) … 2) …" → un botón por número + No.
 *  - "¿Quisiste decir …?"            → Sí / No (o un botón por nombre si sugiere varios).
 * Solo prepara los botones: nunca se contestan automáticamente.
 */
function detectarOpciones(md: string): OpcionRapida[] | undefined {
  const texto = String(md ?? '');
  const limpiar = (t: string) => t.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const corto = (t: string) => (t.length > 42 ? t.slice(0, 40) + '…' : t);

  // Opciones numeradas "1) …" o "1. …", en líneas propias o seguidas en el mismo renglón.
  const numeradas: { n: string; t: string }[] = [];
  const re = /(?:^|\s)(\d{1,2})[).]\s+(.+?)(?=\s+\d{1,2}[).]\s|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const t = limpiar(m[2]);
    if (t && !numeradas.some((o) => o.n === m![1])) numeradas.push({ n: m[1], t });
  }

  if (/¿\s*es alguna de estas/i.test(texto) && numeradas.length) {
    return [...numeradas.map((o) => ({ label: `${o.n}) ${corto(o.t)}`, valor: o.n })), { label: 'No', valor: 'no' }];
  }

  if (/¿\s*quisiste decir/i.test(texto)) {
    const vinetas = [...texto.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((v) => limpiar(v[1])).filter(Boolean);
    const nombres = numeradas.length > 1 ? numeradas.map((o) => o.t) : vinetas.length > 1 ? vinetas : [];
    if (nombres.length) {
      return [...nombres.slice(0, 6).map((n) => ({ label: corto(n), valor: n })), { label: 'No', valor: 'no' }];
    }
    return [
      { label: 'Sí', valor: 'sí' },
      { label: 'No', valor: 'no' },
    ];
  }
  return undefined;
}
