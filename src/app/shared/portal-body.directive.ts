import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';

/**
 * Mueve el elemento al final de `<body>` mientras existe.
 * Útil para menús con `position: fixed` que viven dentro de contenedores con `transform`/`overflow`
 * (p. ej. el hub de pagos), que los desplazarían o recortarían. Los bindings de Angular siguen funcionando.
 */
@Directive({
  selector: '[appPortalBody]',
  standalone: true,
})
export class PortalBodyDirective implements OnInit, OnDestroy {
  private padreOriginal: Node | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const nodo = this.el.nativeElement;
    this.padreOriginal = nodo.parentNode;
    document.body.appendChild(nodo);
  }

  ngOnDestroy(): void {
    const nodo = this.el.nativeElement;
    if (nodo.parentNode === document.body) {
      document.body.removeChild(nodo);
    }
    this.padreOriginal = null;
  }
}
