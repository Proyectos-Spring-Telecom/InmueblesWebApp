import {
  Component,
  OnInit,
  Input,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavService } from '../../../../../services/nav.service';
import { navItems } from '../sidebar-data';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-horizontal-nav-item',
    imports: [TablerIconsModule, CommonModule, MatIconModule],
    templateUrl: './nav-item.component.html'
})
export class AppHorizontalNavItemComponent implements OnInit {
  @Input() depth: any;
  @Input() item: any;

  constructor(public navService: NavService, public router: Router) {
    if (this.depth === undefined) {
      this.depth = 0;
    }
  }

  ngOnInit() { }

  isDirectlyActive(item: { route?: string; children?: unknown[] }): boolean {
    if (!item?.route || item.route === '/menu-level') return false;

    const normalize = (path: string) =>
      (path || '/').split('?')[0].replace(/\/+$/, '') || '/';
    const route = normalize(item.route);
    const url = normalize(this.router.url);

    if (url === route) return true;

    if (item.children?.length) {
      return url.startsWith(route + '/');
    }

    if (this.matchesEditarAlias(route, url)) return true;

    // Activo por prefijo, salvo que otro item del menu sea mas especifico para la URL.
    return (
      url.startsWith(route + '/') && !this.hayRutaMasEspecifica(route, url)
    );
  }

  private hayRutaMasEspecifica(route: string, url: string): boolean {
    const rutas = new Set<string>();
    const visitar = (item: any) => {
      if (!item) return;
      if (item.route && item.route !== '/menu-level') {
        rutas.add((item.route as string).split('?')[0].replace(/\/+$/, '') || '/');
      }
      (item.children || []).forEach(visitar);
    };
    navItems.forEach(visitar);

    for (const otra of rutas) {
      if (otra.length <= route.length) continue;

      const candidatas = [otra];
      const alias = otra.match(/^(.*)\/agregar-([^/]+)$/);
      if (alias) candidatas.push(`${alias[1]}/editar-${alias[2]}`);

      if (candidatas.some((r) => url === r || url.startsWith(r + '/'))) {
        return true;
      }
    }
    return false;
  }

  private matchesEditarAlias(route: string, url: string): boolean {
    const match = route.match(/^(.*)\/agregar-([^/]+)$/);
    if (!match) return false;

    const [, base, suffix] = match;
    const editRoute = `${base}/editar-${suffix}`;
    return url === editRoute || url.startsWith(editRoute + '/');
  }

  onItemSelected(item: any) {
    if (!item.children || !item.children.length) {
      this.router.navigate([item.route]);
    }
  }
}
