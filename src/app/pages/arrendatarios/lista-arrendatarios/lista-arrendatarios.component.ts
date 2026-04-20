import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DxTreeListComponent } from 'devextreme-angular';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ArrendatarioTreeRow, buildArrendatariosTreeRows } from '../arrendatarios-demo.data';

@Component({
  selector: 'app-lista-arrendatarios',
  templateUrl: './lista-arrendatarios.component.html',
  styleUrl: './lista-arrendatarios.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class ListaArrendatariosComponent implements OnInit {
  public rows: ArrendatarioTreeRow[] = [];
  /** Inicio contraído: solo filas de inmueble visibles hasta expandir. */
  public expandedAll: boolean = false;
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';

  @ViewChild('treeListRef', { static: false })
  treeListRef!: DxTreeListComponent;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.rows = buildArrendatariosTreeRows();
  }

  agregarArrendatario(): void {
    this.router.navigateByUrl('/arrendatarios/agregar-arrendatario');
  }

  editarInmuebleDesdeFila(row: ArrendatarioTreeRow): void {
    if (row.tipoNodo !== 'inmueble') return;
    const idNum = row.id.replace(/^inmueble-/, '');
    void this.router.navigate(['/arrendatarios/agregar-arrendatario'], {
      queryParams: { demoInmuebleId: idNum },
    });
  }

  eliminarInmuebleDemo(row: ArrendatarioTreeRow, ev: Event): void {
    ev.stopPropagation();
    if (row.tipoNodo !== 'inmueble') return;
    const ok = window.confirm(
      `¿Dar de baja el inmueble «${row.inmueble}»? (solo demostración; no se persiste).`,
    );
    if (!ok) return;
    window.alert('Demostración: la baja de inmueble se procesaría en backend.');
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
