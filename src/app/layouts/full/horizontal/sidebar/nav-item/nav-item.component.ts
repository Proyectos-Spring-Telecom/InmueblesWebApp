import {
  Component,
  OnInit,
  Input,
} from '@angular/core';
import { Router } from '@angular/router';
import { NavService } from '../../../../../services/nav.service';
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

  isDirectlyActive(item: { route?: string }): boolean {
    if (!item?.route || item.route === '/menu-level') return false;

    const normalize = (path: string) =>
      (path || '/').split('?')[0].replace(/\/+$/, '') || '/';
    const route = normalize(item.route);
    const url = normalize(this.router.url);

    if (url === route) return true;
    if (!url.startsWith(route + '/')) return false;

    if (route === '/arrendatarios') {
      return !/^\/arrendatarios\/pagos-(renta|mantenimiento)(\/|$)/.test(url);
    }

    return true;
  }

  onItemSelected(item: any) {
    if (!item.children || !item.children.length) {
      this.router.navigate([item.route]);
    }
  }
}
