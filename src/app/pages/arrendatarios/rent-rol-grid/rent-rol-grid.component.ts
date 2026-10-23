import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DxDataGridModule } from 'devextreme-angular';
import { routeAnimation } from 'src/app/pipe/module-open.animation';

/** Vista Rent Rol (desde el header): solo el primer header y el grid, sin información. */
@Component({
  selector: 'app-rent-rol-grid',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, DxDataGridModule],
  templateUrl: './rent-rol-grid.component.html',
  styleUrl: './rent-rol-grid.component.scss',
  animations: [routeAnimation],
})
export class RentRolGridComponent {
  /** Sin información por ahora: el grid va vacío. */
  readonly registros: unknown[] = [];
  readonly showFilterRow = true;
  readonly filasPorPagina = 20;
  readonly porcentajeCobrado = 0;
  readonly conteoPagadas = 0;
  readonly conteoPendientes = 0;
}
