import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';

@Component({
  selector: 'app-pagos-mantenimiento',
  templateUrl: './pagos-mantenimiento.component.html',
  styleUrl: './pagos-mantenimiento.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class PagosMantenimientoComponent implements OnInit, OnDestroy {
  segmentoActivo = 'actual';
  private sub?: Subscription;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.actualizarSegmentoActivo();
    this.sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.actualizarSegmentoActivo());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private actualizarSegmentoActivo(): void {
    const url = this.router.url.split('?')[0];
    const base = '/arrendatarios/pagos-mantenimiento';
    const resto = url.startsWith(base) ? url.slice(base.length).replace(/^\//, '') : '';
    this.segmentoActivo = resto.split('/')[0] || 'actual';
  }
}
