import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
}

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

@Component({
  selector: 'app-assistant-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assistant-chat.component.html',
  styleUrl: './assistant-chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantChatComponent {
  open = false;
  busy = false;

  readonly actions: QuickAction[] = [
    {
      id: 'ocupacion-resumen',
      label: 'Resumen De Ocupación Por Inmueble',
      prompt: 'Necesito un resumen de ocupación por inmueble: ocupados vs disponibles y qué contratos están activos.',
    },
    {
      id: 'contratos-vencer',
      label: 'Contratos Próximos A Vencer (30 Días)',
      prompt: 'Quiero ver qué contratos vencen en los próximos 30 días y con qué arrendatarios están ligados.',
    },
    {
      id: 'arrendatario-historial',
      label: 'Revisar Arrendatario + Historial',
      prompt: 'Quiero revisar un arrendatario, su estatus y el historial relacionado (contratos/ocupación).',
    },
  ];

  readonly input = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.maxLength(600)],
  });

  messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Hola. Dime qué estás intentando lograr y te lo voy guiando paso a paso.',
      createdAt: Date.now(),
    },
  ];

  @ViewChild('scrollViewport') private scrollViewport?: ElementRef<HTMLDivElement>;

  toggle() {
    this.open = !this.open;
    if (this.open) queueMicrotask(() => this.scrollToBottom(true));
  }

  close() {
    this.open = false;
  }

  send(text?: string) {
    const raw = (text ?? this.input.value).trim();
    if (!raw || this.busy) return;

    this.pushMessage('user', raw);
    this.input.setValue('');

    this.busy = true;
    this.scrollToBottom();

    const reply = this.getMockReply(raw);
    const delay = Math.min(950, 450 + reply.length * 8);
    window.setTimeout(() => {
      this.pushMessage('assistant', reply);
      this.busy = false;
      this.scrollToBottom();
    }, delay);
  }

  onQuickAction(a: QuickAction) {
    this.send(a.prompt);
  }

  onKeydownEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return; // permite saltos de línea si conviertes input a textarea
    e.preventDefault();
    this.send();
  }

  private pushMessage(role: ChatRole, text: string) {
    this.messages = [
      ...this.messages,
      { id: crypto.randomUUID(), role, text, createdAt: Date.now() },
    ];
  }

  private scrollToBottom(instant = false) {
    const el = this.scrollViewport?.nativeElement;
    if (!el) return;
    const top = el.scrollHeight;
    el.scrollTo({ top, behavior: instant ? 'auto' : 'smooth' });
  }

  private getMockReply(userText: string): string {
    const q = userText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    if (
      q.includes('ocupacion') ||
      q.includes('ocupacion por inmueble') ||
      (q.includes('ocup') && q.includes('inmueble'))
    ) {
      return pick([
        'Va. ¿Lo quieres por inmueble (cada uno con % de ocupación) o un resumen general primero? Si me dices el rango de fechas, lo dejo más aterrizado.',
        'Perfecto. Yo lo armaría así: 1) Lista de inmuebles 2) Activos/Disponibles 3) Arrendatario y contrato ligado. ¿Quieres que prioricemos “ocupados” o “disponibles”?',
      ]);
    }

    if (q.includes('contrato') && (q.includes('venc') || q.includes('30'))) {
      return pick([
        'Buenísimo. Para “próximos 30 días” lo más útil es: inmueble + arrendatario + fecha de fin + estatus del contrato. ¿Quieres que también te marque los que ya están por vencer “esta semana”?',
        'Ok. Dime si te interesa por arrendatario o por inmueble. Yo empezaría por un listado con fecha de vencimiento y una alerta visual para los más próximos.',
      ]);
    }

    if (q.includes('serie') || q.includes('numero de serie') || q.includes('incidencia') || q.includes('monitoreo')) {
      return pick([
        'Pásame el número de serie (tal cual aparece) y te digo qué buscar: instalación, último hit y el listado de incidencias recientes. ¿Es una falla de hoy o viene arrastrándose?',
        'Va. Si ya tienes el número de serie, lo siguiente es revisar “último hit” y las incidencias de hoy. ¿Quieres ver solo las críticas o todo el historial?',
      ]);
    }

    if (q.includes('arrendatario') || q.includes('arrendadores') || q.includes('cliente')) {
      return pick([
        'Ok, ¿me dices el nombre o un identificador? Normalmente reviso: estatus, inmuebles ligados, contratos activos y si hay algo por renovar.',
        'Va. Para no perdernos: ¿lo que necesitas es “ver info” o “cambiar estatus”? Si me dices cuál, te guío con el flujo más corto.',
      ]);
    }

    if (q.includes('permiso') || q.includes('rol') || q.includes('roles')) {
      return pick([
        'Perfecto. Para auditar acceso a Monitoreo yo revisaría: rol → permisos → usuario. ¿Estás investigando a un usuario en específico o quieres un listado general?',
        'Ok. ¿Qué te preocupa: que alguien “vea” Monitoreo sin permiso o que el menú no aparece? Son dos causas distintas y se resuelven diferente.',
      ]);
    }

    return pick([
      'Va. Dime qué pantalla estás viendo ahora y qué esperas que pase, y lo aterrizamos.',
      'Entendido. ¿Esto es más de “buscar algo” o de “hacer un cambio”? Con eso te doy la ruta más directa.',
      'Ok. Dame un ejemplo concreto (un inmueble, un arrendatario o un número de serie) y lo resolvemos con ese caso.',
    ]);
  }
}

