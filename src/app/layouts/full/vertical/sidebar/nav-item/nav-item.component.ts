import {
  Component,
  HostBinding,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  Output,
  EventEmitter,
} from '@angular/core';
import { NavItem } from './nav-item';
import { Router, NavigationEnd } from '@angular/router';
import { NavService } from '../../../../../services/nav.service';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-nav-item',
  imports: [TranslateModule, TablerIconsModule, MaterialModule, CommonModule],
  templateUrl: './nav-item.component.html',
  styleUrls: [],
  animations: [
    trigger('indicatorRotate', [
      state('collapsed', style({ transform: 'rotate(0deg)' })),
      state('expanded', style({ transform: 'rotate(180deg)' })),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4,0.0,0.2,1)')),
    ]),
  ],
  standalone: true,
})
export class AppNavItemComponent implements OnInit, OnChanges, OnDestroy {

  // === Registro de instancias para colapsar por nivel (depth) ===
  private static instances = new Set<AppNavItemComponent>();

  @Output() toggleMobileLink: any = new EventEmitter<void>();
  @Output() notify: EventEmitter<boolean> = new EventEmitter<boolean>();

  expanded = false;
  disabled: any = false;
  twoLines: any = false;

  @HostBinding('attr.aria-expanded') ariaExpanded = this.expanded;
  @Input() item: NavItem | any;
  @Input() depth: any;

  private sub?: Subscription;

  constructor(public navService: NavService, public router: Router) {}

  // -------- Utils ----------
  private numericDepth(): number {
    const d = Number(this.depth);
    return Number.isFinite(d) ? d : 0;
  }

  // Colapsa TODAS las instancias en el mismo nivel
  private static collapseAllAtDepth(depth: number) {
    for (const inst of AppNavItemComponent.instances) {
      if (inst.numericDepth() === depth) {
        inst.expanded = false;
        inst.ariaExpanded = false;
      }
    }
  }

  // Abre solo esta instancia en su nivel (colapsa las demás)
  private openExclusivelyAtMyDepth() {
    const d = this.numericDepth();
    AppNavItemComponent.collapseAllAtDepth(d);
    this.expanded = true;
    this.ariaExpanded = true;
  }

  // Mantener abierto si alguno de sus hijos es la ruta activa
  private ensureOpenIfHasActiveRoute() {
    if (this.isChildActive(this.item) || this.isDirectlyActive(this.item)) {
      this.openExclusivelyAtMyDepth();
    }
  }

  // -------- Ciclo de vida ----------
  ngOnInit(): void {
    if (this.depth === undefined || this.depth === null) this.depth = 0;
    AppNavItemComponent.instances.add(this);

    // Si al iniciar ya contiene la ruta activa, debe quedar abierto en su nivel
    this.ensureOpenIfHasActiveRoute();

    // En cada navegación, si este grupo contiene la ruta activa,
    // lo abrimos exclusivo; si no, no lo tocamos (sigue como esté).
    this.sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.ensureOpenIfHasActiveRoute();
      });
  }

  ngOnChanges(): void {
    // Compatibilidad con tu lógica original
    const url = this.navService.currentUrl();
    if (this.item?.route && url) {
      const mine = url.indexOf(`/${this.item.route}`) === 0;
      if (mine) this.openExclusivelyAtMyDepth();
      this.ariaExpanded = this.expanded;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    AppNavItemComponent.instances.delete(this);
  }

  // -------- Interacciones ----------
  onItemSelected(item: NavItem) {
    // Si NO tiene hijos: navega normal
    if (!item.children || !item.children.length) {
      this.router.navigate([item.route]);
    } else {
      // Es un submenú: si estaba cerrado, abre SOLO este y cierra los demás del mismo nivel.
      // Si estaba abierto, lo cerramos (quedará ninguno abierto en ese nivel).
      if (!this.expanded) {
        this.openExclusivelyAtMyDepth();
      } else {
        // toggle a cerrado solo para este
        this.expanded = false;
        this.ariaExpanded = false;
      }
    }

    // Scroll al top
    window.scroll({ top: 0, left: 0, behavior: 'smooth' });

    // Cierre en móvil si corresponde
    if (!this.expanded && window.innerWidth < 1024) {
      this.notify.emit();
    }
  }

  onSubItemSelected(item: NavItem) {
    // Si eliges un hijo hoja, el padre debe mantenerse abierto en su nivel
    if (!item.children || !item.children.length) {
      if (window.innerWidth < 1024) this.notify.emit();
      this.openExclusivelyAtMyDepth();
    }
  }

  // -------- Activo ----------
  isDirectlyActive(item: NavItem): boolean {
    return !!item?.route && this.router.isActive(item.route, true);
  }

  isChildActive(item: NavItem): boolean {
    if (!item?.children) return false;
    return item.children.some(
      (child: any) => this.isDirectlyActive(child) || this.isChildActive(child)
    );
  }
}
