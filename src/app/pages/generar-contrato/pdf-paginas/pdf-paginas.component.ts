import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

type PdfJs = typeof import('pdfjs-dist');

const WORKER_SRC = 'assets/pdfjs/pdf.worker.min.mjs';

let pdfjsCargado: Promise<PdfJs> | null = null;

/** El worker se copia a /assets/pdfjs desde angular.json (requiere reiniciar `ng serve` tras agregarlo). */
async function workerDisponible(): Promise<boolean> {
  try {
    const r = await fetch(WORKER_SRC, { method: 'HEAD', cache: 'no-store' });
    // Algunos servidores responden index.html (200) en rutas inexistentes
    return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}

/** pdf.js se carga bajo demanda (solo en este módulo) y una sola vez. */
function cargarPdfJs(): Promise<PdfJs> {
  if (!pdfjsCargado) {
    pdfjsCargado = (async () => {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      if (!(await workerDisponible())) {
        // Respaldo: pdf.js usa globalThis.pdfjsWorker y procesa el PDF en el hilo principal
        console.warn(`pdf.js: no se encontró ${WORKER_SRC}; se usa el worker en el hilo principal.`);
        (globalThis as any).pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs');
      }
      return pdfjs;
    })();
    // Si algo falla, permite reintentar en la siguiente carga
    pdfjsCargado.catch(() => (pdfjsCargado = null));
  }
  return pdfjsCargado;
}

/**
 * Dibuja un PDF como hojas (canvas) con pdf.js.
 * Funciona igual en escritorio y móvil (los iframes con PDF no se ven en Android/iOS) y,
 * al recibir un PDF nuevo, renderiza fuera de pantalla y reemplaza las hojas conservando el scroll.
 */
@Component({
  selector: 'app-pdf-paginas',
  templateUrl: './pdf-paginas.component.html',
  styleUrl: './pdf-paginas.component.scss',
  standalone: false,
})
export class PdfPaginasComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() pdf: Blob | null = null;
  /** 1 = ajustar al ancho del panel. */
  @Input() zoom = 1;
  @Output() paginasRenderizadas = new EventEmitter<number>();
  @Output() errorRender = new EventEmitter<void>();

  @ViewChild('scroller', { static: true }) scroller!: ElementRef<HTMLDivElement>;
  @ViewChild('hojas', { static: true }) hojas!: ElementRef<HTMLDivElement>;

  public totalPaginas = 0;
  public renderizando = false;

  private turno = 0;
  private anchoRenderizado = 0;
  private resizeObserver?: ResizeObserver;
  private resizeTimer?: ReturnType<typeof setTimeout>;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    // Re-render al cambiar el ancho del panel (rotar pantalla, abrir sidebar…)
    this.resizeObserver = new ResizeObserver(() => {
      const ancho = this.anchoDisponible();
      if (!this.pdf || Math.abs(ancho - this.anchoRenderizado) < 24) return;
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.zone.run(() => this.render()), 250);
    });
    this.resizeObserver.observe(this.scroller.nativeElement);
    if (this.pdf) this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['pdf'] || changes['zoom']) && this.scroller) this.render();
  }

  ngOnDestroy(): void {
    this.turno++;
    this.resizeObserver?.disconnect();
    clearTimeout(this.resizeTimer);
  }

  private anchoDisponible(): number {
    // 32px = padding horizontal del área de hojas
    return Math.max(160, this.scroller.nativeElement.clientWidth - 32);
  }

  private async render() {
    const turno = ++this.turno;
    if (!this.pdf) {
      this.hojas.nativeElement.replaceChildren();
      this.totalPaginas = 0;
      return;
    }

    this.renderizando = true;
    let doc: import('pdfjs-dist').PDFDocumentProxy | null = null;
    try {
      const pdfjs = await cargarPdfJs();
      const data = new Uint8Array(await this.pdf.arrayBuffer());
      if (turno !== this.turno) return;
      doc = await pdfjs.getDocument({ data }).promise;

      const ancho = this.anchoDisponible();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nuevas: HTMLElement[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const pagina = await doc.getPage(i);
        if (turno !== this.turno) return;
        const base = pagina.getViewport({ scale: 1 });
        const escala = ((ancho * this.zoom) / base.width) * dpr;
        const viewport = pagina.getViewport({ scale: escala });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        if (turno !== this.turno) return;

        const hoja = document.createElement('div');
        hoja.className = 'pp-hoja';
        hoja.appendChild(canvas);
        const etiqueta = document.createElement('span');
        etiqueta.className = 'pp-hoja__num';
        etiqueta.textContent = `${i} / ${doc.numPages}`;
        hoja.appendChild(etiqueta);
        nuevas.push(hoja);
      }

      // Reemplazo en un solo paso, conservando la posición relativa del scroll
      const sc = this.scroller.nativeElement;
      const proporcion = sc.scrollHeight > sc.clientHeight ? sc.scrollTop / sc.scrollHeight : 0;
      this.hojas.nativeElement.replaceChildren(...nuevas);
      sc.scrollTop = proporcion * sc.scrollHeight;

      this.anchoRenderizado = ancho;
      this.totalPaginas = doc.numPages;
      this.paginasRenderizadas.emit(doc.numPages);
    } catch (e) {
      if (turno === this.turno) {
        console.error('No se pudo dibujar el PDF', e);
        this.errorRender.emit();
      }
    } finally {
      doc?.destroy();
      if (turno === this.turno) this.renderizando = false;
    }
  }
}
