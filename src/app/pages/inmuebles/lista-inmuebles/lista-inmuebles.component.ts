import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxTreeListComponent } from 'devextreme-angular';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { InmuebleTreeRow, buildInmueblesTreeRows } from '../inmuebles-demo.data';

@Component({
  selector: 'app-lista-inmuebles',
  templateUrl: './lista-inmuebles.component.html',
  styleUrl: './lista-inmuebles.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaInmueblesComponent implements OnInit {
  public rows: InmuebleTreeRow[] = [];
  public expandedAll = false;

  @ViewChild('treeListRef', { static: false })
  treeListRef!: DxTreeListComponent;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.rows = buildInmueblesTreeRows();
  }

  agregarInmueble(): void {
    void this.router.navigateByUrl('/inmuebles/agregar-inmueble');
  }

  editarInmuebleDesdeFila(row: InmuebleTreeRow): void {
    if (row.tipoNodo !== 'inmueble') return;
    const idNum = row.id.replace(/^inmueble-/, '');
    void this.router.navigate(['/inmuebles/editar-inmueble', idNum]);
  }

  eliminarInmuebleDemo(row: InmuebleTreeRow, ev: Event): void {
    ev.stopPropagation();
    if (row.tipoNodo !== 'inmueble') return;
    const ok = window.confirm(
      `¿Dar de baja el inmueble «${row.inmueble}»? (demostración)`,
    );
    if (!ok) return;
    window.alert('Demostración: baja procesada en backend.');
  }

  limpiarVista(): void {
    const inst = this.treeListRef?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.option('searchPanel.text', '');
    this.expandedAll = false;
    inst.option('autoExpandAll', this.expandedAll);
    inst.refresh();
  }

  toggleExpandirContraer(): void {
    const inst = this.treeListRef?.instance;
    if (!inst) return;
    this.expandedAll = !this.expandedAll;
    inst.option('autoExpandAll', this.expandedAll);
    inst.refresh();
  }
}
