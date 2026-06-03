import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { OperacionPagosHubConfig } from './operacion-pagos-hub.model';

@Component({
  selector: 'app-operacion-pagos-hub',
  templateUrl: './operacion-pagos-hub.component.html',
  styleUrl: './operacion-pagos-hub.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class OperacionPagosHubComponent implements OnInit, OnDestroy {
  config!: OperacionPagosHubConfig;
  segmentoActivo = '';

  private sub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.config = this.route.snapshot.data['operacionHub'] as OperacionPagosHubConfig;
    this.actualizarSegmentoActivo();
    this.sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.actualizarSegmentoActivo());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  rutaSegmento(segmento: string): string[] {
    return [this.config.rutaBase, segmento];
  }

  private actualizarSegmentoActivo(): void {
    const url = this.router.url.split('?')[0];
    const base = this.config.rutaBase.replace(/\/$/, '');
    const resto = url.startsWith(base) ? url.slice(base.length).replace(/^\//, '') : '';
    const segmento = resto.split('/')[0] || 'actual';
    this.segmentoActivo = segmento;
  }
}
