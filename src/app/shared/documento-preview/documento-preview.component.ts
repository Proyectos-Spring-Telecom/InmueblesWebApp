import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export type DocumentoPreviewAbrirOpciones = {
  /** Forzar vista de imagen (p. ej. blob sin extensión en la URL). */
  esImagen?: boolean;
};

@Component({
  selector: 'app-documento-preview',
  templateUrl: './documento-preview.component.html',
  styleUrl: './documento-preview.component.scss',
  standalone: false,
})
export class DocumentoPreviewComponent {
  @Input() visible = false;
  @Input() titulo = '';
  @Input() subtitulo = '';
  @Input() eyebrow = 'Documento';
  @Input() url = '';

  @Output() closed = new EventEmitter<void>();

  safeUrl: SafeResourceUrl | null = null;
  private forzarImagen = false;

  constructor(private sanitizer: DomSanitizer) {}

  abrir(
    url: string,
    titulo: string,
    subtitulo = '',
    opciones?: DocumentoPreviewAbrirOpciones,
  ): void {
    if (!url?.trim()) return;
    this.url = url.trim();
    this.titulo = titulo;
    this.subtitulo = subtitulo;
    this.forzarImagen = !!opciones?.esImagen;
    this.safeUrl = this.esImagen(this.url)
      ? null
      : this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    this.visible = true;
  }

  cerrar(): void {
    this.visible = false;
    this.safeUrl = null;
    this.url = '';
    this.forzarImagen = false;
    this.closed.emit();
  }

  esImagen(url: string): boolean {
    if (this.forzarImagen) return true;
    return /\.(png|jpe?g|gif|webp|jfif)(\?|$|#)/i.test(url ?? '');
  }

  esPdf(url: string): boolean {
    return /\.pdf(\?|$)/i.test(url ?? '') || (url ?? '').includes('pdf');
  }

  iconoArchivo(url: string, nombre: string): string {
    const ref = `${url} ${nombre}`.toLowerCase();
    if (this.esImagen(url)) return 'fa-file-image-o';
    if (this.esPdf(url) || ref.includes('pdf')) return 'fa-file-pdf-o';
    return 'fa-file-o';
  }
}
