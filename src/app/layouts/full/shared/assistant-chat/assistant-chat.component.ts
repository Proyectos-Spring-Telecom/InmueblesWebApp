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
}

/** Sugerencias UX (agente_consumo_front.md §9 + capacidades §8 / cobranza). */
const QUICK_PROMPTS: { id: string; label: string; prompt: string }[] = [
  { id: 'deuda', label: '¿Quién me debe?', prompt: '¿quién me debe?' },
  { id: 'cobrado', label: 'Cobrado del mes', prompt: '¿cuánto me pagaron este mes?' },
  { id: 'vencer', label: 'Contratos por vencer', prompt: '¿qué contratos vencen pronto?' },
  { id: 'rentas', label: 'Rentas del mes', prompt: '¿cómo van las rentas de este mes?' },
  { id: 'saldo', label: 'Saldo a favor', prompt: '¿quién tiene saldo a favor?' },
  { id: 'ocupacion', label: 'Ocupación', prompt: '¿qué tan ocupadas están mis plazas?' },
];

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
  historyOpen = false;
  historyLoading = false;
  agentDown = false;
  cooldownSec = 0;

  readonly actions = QUICK_PROMPTS;
  history: ConversacionResumen[] = [];

  readonly input = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.maxLength(4000)],
  });

  messages: ChatMessage[] = [];

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

  toggle() {
    this.open = !this.open;
    if (this.open) {
      this.historyOpen = false;
      this.checkHealth();
      queueMicrotask(() => this.scrollToBottom(true));
    }
    this.cdr.detectChanges();
  }

  close() {
    this.open = false;
    this.historyOpen = false;
    this.cdr.detectChanges();
  }

  /** Nueva conversación: limpia conversation_id y el hilo. */
  nuevaConversacion() {
    this.clearAsk();
    this.busy = false;
    this.agent.nuevaConversacion();
    this.input.setValue('');
    this.messages = [this.welcome()];
    this.historyOpen = false;
    this.cdr.detectChanges();
    queueMicrotask(() => this.scrollToBottom(true));
  }

  toggleHistory() {
    this.historyOpen = !this.historyOpen;
    if (this.historyOpen) this.loadHistory();
    this.cdr.detectChanges();
  }

  cerrarHistorial() {
    this.historyOpen = false;
    this.cdr.detectChanges();
  }

  loadHistory() {
    this.historyLoading = true;
    this.cdr.detectChanges();
    this.agent.listarConversaciones(1, 20).subscribe({
      next: (res) => {
        this.history = res.data ?? [];
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.historyLoading = false;
        this.history = [];
        this.pushSystemError(err);
        this.cdr.detectChanges();
      },
    });
  }

  abrirHistorial(item: ConversacionResumen) {
    this.busy = true;
    this.historyOpen = false;
    this.cdr.detectChanges();
    this.agent.abrirConversacion(item.id).subscribe({
      next: (conv) => {
        this.messages = (conv.messages ?? []).map((m) => {
          const role: ChatRole = m.role === 'assistant' ? 'assistant' : 'user';
          if (role === 'assistant') {
            return {
              id: crypto.randomUUID(),
              role,
              createdAt: Date.parse(m.created_at) || Date.now(),
              html: renderAgentMarkdown(m.content),
            };
          }
          return {
            id: crypto.randomUUID(),
            role,
            createdAt: Date.parse(m.created_at) || Date.now(),
            text: m.content,
          };
        });
        if (!this.messages.length) this.messages = [this.welcome()];
        this.busy = false;
        this.cdr.detectChanges();
        queueMicrotask(() => this.scrollToBottom(true));
      },
      error: (err: unknown) => {
        this.busy = false;
        this.pushSystemError(err);
        this.cdr.detectChanges();
      },
    });
  }

  borrarHistorial(item: ConversacionResumen, ev: Event) {
    ev.stopPropagation();
    this.agent.borrarConversacion(item.id).subscribe({
      next: () => {
        this.history = this.history.filter((h) => h.id !== item.id);
        if (this.agent.conversationId == null && this.messages.length > 1) {
          // Si borramos la conversación activa, empezamos de cero.
          this.messages = [this.welcome()];
        }
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.pushSystemError(err);
        this.cdr.detectChanges();
      },
    });
  }

  send(text?: string) {
    const raw = (text ?? this.input.value).trim();
    if (!raw || this.busy || this.cooldownSec > 0) return;

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

  onQuickAction(a: { prompt: string }) {
    this.send(a.prompt);
  }

  onKeydownEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    this.send();
  }

  formatConvDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
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
        'Hola, soy **Claudia**. Puedo consultar cobranza, adeudos, estado de cuenta, inmuebles, locales, arrendatarios y contratos.\n\n' +
          'Soy de **sólo consulta**: para registrar o modificar algo, usa las pantallas de la aplicación.\n\n' +
          'Prueba un atajo o pregunta en lenguaje natural (ej. *estado de cuenta de…*, *¿quién me debe?*).',
      ),
    };
  }

  private scrollToBottom(instant = false) {
    const el = this.scrollViewport?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' });
  }
}
