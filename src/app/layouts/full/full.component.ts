import { BreakpointObserver, MediaMatcher } from '@angular/cdk/layout';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSidenav } from '@angular/material/sidenav';
import { CoreService } from 'src/app/services/core.service';
import { AppSettings } from 'src/app/config';
import { filter } from 'rxjs/operators';
import { NavigationEnd, Router } from '@angular/router';
import { navItems } from './vertical/sidebar/sidebar-data';
import { NavService } from '../../services/nav.service';
import { AppNavItemComponent } from './vertical/sidebar/nav-item/nav-item.component';
import { RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './vertical/sidebar/sidebar.component';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HeaderComponent } from './vertical/header/header.component';
import { AppHorizontalHeaderComponent } from './horizontal/header/header.component';
import { AppHorizontalSidebarComponent } from './horizontal/sidebar/sidebar.component';
import { AppBreadcrumbComponent } from './shared/breadcrumb/breadcrumb.component';
import { CustomizerComponent } from './shared/customizer/customizer.component';
import { AppAuthBrandingComponent } from './vertical/sidebar/auth-branding.component';
import { AuthenticationService } from 'src/app/services/auth.service';
import { NavItem } from './vertical/sidebar/nav-item/nav-item';
import { AssistantChatComponent } from './shared/assistant-chat/assistant-chat.component';
import { LayoutScrollService } from 'src/app/services/layout-scroll.service';

const MOBILE_VIEW = 'screen and (max-width: 768px)';
const TABLET_VIEW = 'screen and (min-width: 769px) and (max-width: 1024px)';
const MONITOR_VIEW = 'screen and (min-width: 1024px)';
const BELOWMONITOR = 'screen and (max-width: 1023px)';

// for mobile app sidebar
interface apps {
  id: number;
  color: string;
  icon: string;
  title: string;
  subtitle: string;
  link: string;
}

interface quicklinks {
  id: number;
  title: string;
  link: string;
}

@Component({
  selector: 'app-full',
  imports: [
    RouterModule,
    AppNavItemComponent,
    MaterialModule,
    CommonModule,
    SidebarComponent,
    NgScrollbarModule,
    TablerIconsModule,
    HeaderComponent,
    AppHorizontalHeaderComponent,
    AppHorizontalSidebarComponent,
    CustomizerComponent,
    AppAuthBrandingComponent,
    AssistantChatComponent,
  ],
  templateUrl: './full.component.html',
  styleUrls: [],
  encapsulation: ViewEncapsulation.None,
})
export class FullComponent implements OnInit, AfterViewInit {
  navItems: NavItem[] = [];

  @ViewChild('verticalSidenav')
  private verticalSidenav?: MatSidenav;
  @ViewChild('horizontalSidenav')
  private horizontalSidenav?: MatSidenav;
  resView = false;
  @ViewChild('mainScroll') private mainScroll?: ElementRef<HTMLDivElement>;
  private layoutChangesSubscription = Subscription.EMPTY;
  private isMobileScreen = false;
  private htmlElement!: HTMLHtmlElement;
  private viewReady = false;
  /** Overlay móvil / horizontal en pantallas pequeñas */
  mobileNavOpen = false;
  /** Preferencia explícita del usuario al contraer/expandir (botón del header) */
  private collapsedByUser: boolean | null = null;
  private layoutInitialized = false;
  private prevIsMobile = false;

  get sidenav(): MatSidenav | undefined {
    return this.verticalSidenav ?? this.horizontalSidenav;
  }

  get options(): AppSettings {
    return this.settings.getOptions();
  }

  get isOver(): boolean {
    return this.isMobileScreen;
  }

  get isTablet(): boolean {
    return this.resView;
  }

  /** Vertical: en desktop/tablet el drawer lateral permanece abierto; el mini es solo CSS. */
  get sidenavIsOpen(): boolean {
    if (this.options.horizontal || this.options.navPos !== 'side') {
      return false;
    }
    if (this.isMobileScreen) {
      return this.mobileNavOpen;
    }
    return true;
  }

  /** Horizontal en viewport reducido: overlay controlado por hamburger. */
  get horizontalOverlayOpen(): boolean {
    return this.resView && this.options.horizontal && this.mobileNavOpen;
  }

  // for mobile app sidebar
  apps: apps[] = [
    {
      id: 1,
      icon: 'message',
      color: 'primary',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/apps/chat',
    },
    {
      id: 2,
      icon: 'list-check',
      color: 'secondary',
      title: 'Todo App',
      subtitle: 'Completed task',
      link: '/apps/todo',
    },
    {
      id: 3,
      icon: 'file-invoice',
      color: 'success',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/apps/invoice',
    },
    {
      id: 4,
      icon: 'calendar',
      color: 'error',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/apps/calendar',
    },
    {
      id: 5,
      icon: 'device-mobile',
      color: 'warning',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/apps/contacts',
    },
    {
      id: 6,
      icon: 'ticket',
      color: 'primary',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/apps/tickets',
    },
    {
      id: 7,
      icon: 'mail',
      color: 'secondary',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/apps/email/inbox',
    },
    {
      id: 8,
      icon: 'book-2',
      color: 'warning',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/apps/courses',
    },
  ];
  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/theme-pages/pricing',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/authentication/login',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/authentication/side-register',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/authentication/error',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/apps/notes',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/apps/employee',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/apps/todo',
    },
  ];

  constructor(
    private settings: CoreService,
    private mediaMatcher: MediaMatcher,
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private navService: NavService,
    private authService: AuthenticationService,
    private layoutScroll: LayoutScrollService,
  ) {
    this.htmlElement = document.querySelector('html')!;
    // Evaluar viewport de forma síncrona antes del primer render para evitar
    // que el sidenav arranque en modo desktop (side) en móvil tras F5.
    this.applyLayoutBreakpoints(this.readBreakpointMatches());
    this.layoutChangesSubscription = this.breakpointObserver
      .observe([MOBILE_VIEW, TABLET_VIEW, MONITOR_VIEW, BELOWMONITOR])
      .subscribe((state) => {
        this.applyLayoutBreakpoints(state.breakpoints);
      });

    // Initialize project theme with options
    this.receiveOptions(this.options);
    
    // Filtrar elementos del menú según permisos
    this.navItems = this.filterNavItemsByPermissions(navItems);
  }

  ngOnInit(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        queueMicrotask(() => this.layoutScroll.scrollToTop('auto'));
      });
  }

  ngAfterViewInit(): void {
    const el = this.mainScroll?.nativeElement;
    if (el) this.layoutScroll.register(el);
    this.viewReady = true;
    this.ensureSidenavOpen();
  }

  ngOnDestroy() {
    this.layoutChangesSubscription.unsubscribe();
  }

  private readBreakpointMatches(): Record<string, boolean> {
    return {
      [MOBILE_VIEW]: this.mediaMatcher.matchMedia(MOBILE_VIEW).matches,
      [TABLET_VIEW]: this.mediaMatcher.matchMedia(TABLET_VIEW).matches,
      [MONITOR_VIEW]: this.mediaMatcher.matchMedia(MONITOR_VIEW).matches,
      [BELOWMONITOR]: this.mediaMatcher.matchMedia(BELOWMONITOR).matches,
    };
  }

  private applyLayoutBreakpoints(breakpoints: Record<string, boolean>): void {
    const isMobile = breakpoints[MOBILE_VIEW];
    const isTablet = breakpoints[TABLET_VIEW];

    if (isMobile) {
      this.mobileNavOpen = false;
    } else if (this.prevIsMobile && !isMobile) {
      queueMicrotask(() => this.ensureSidenavOpen());
    }
    this.prevIsMobile = isMobile;

    // Solo móvil real: overlay. Tablet (769–1023) empuja layout como desktop.
    this.isMobileScreen = isMobile;
    this.resView = breakpoints[BELOWMONITOR];

    if (!this.layoutInitialized) {
      if (!isMobile && isTablet && this.collapsedByUser === null) {
        this.settings.setOptions({ sidenavCollapsed: true });
      }
      this.layoutInitialized = true;
    } else if (this.collapsedByUser !== null && !isMobile) {
      this.settings.setOptions({ sidenavCollapsed: this.collapsedByUser });
    }

    if (this.viewReady && !isMobile && !this.options.horizontal) {
      queueMicrotask(() => this.ensureSidenavOpen());
    }
  }

  private ensureSidenavOpen(): void {
    if (
      this.options.horizontal ||
      this.isMobileScreen ||
      this.options.navPos !== 'side' ||
      !this.sidenav
    ) {
      return;
    }

    if (!this.sidenav.opened) {
      void this.sidenav.open();
    }
  }

  toggleCollapsed(): void {
    const next = !this.options.sidenavCollapsed;
    this.collapsedByUser = next;
    this.settings.setOptions({ sidenavCollapsed: next });
    // Si se contrae el sidebar, cerrar submenús para evitar huecos visuales.
    if (next) {
      AppNavItemComponent.collapseAll();
    }
  }

  toggleMobileNav(): void {
    if (!this.sidenav) {
      return;
    }
    void this.sidenav.toggle();
  }

  closeMobileNav(): void {
    const isOverlay =
      this.isMobileScreen || (this.resView && this.options.horizontal);
    if (!isOverlay) {
      return;
    }
    this.mobileNavOpen = false;
    void this.sidenav?.close();
  }

  onSidenavClosedStart(): void {
    const isOverlay =
      this.isMobileScreen || (this.resView && this.options.horizontal);
    if (isOverlay) {
      this.mobileNavOpen = false;
    }
  }

  onSidenavOpenedChange(isOpened: boolean): void {
    const isOverlay =
      this.isMobileScreen || (this.resView && this.options.horizontal);

    if (isOverlay) {
      this.mobileNavOpen = isOpened;
      return;
    }

    // Desktop/tablet vertical: el drawer lateral no debe cerrarse (solo mini/full vía CSS).
    if (!isOpened && !this.options.horizontal && this.options.navPos === 'side') {
      queueMicrotask(() => this.ensureSidenavOpen());
    }
  }

  receiveOptions(options: AppSettings): void {
    this.toggleDarkTheme(options);
    this.toggleColorsTheme(options);
  }

  toggleDarkTheme(options: AppSettings) {
    if (options.theme === 'dark') {
      this.htmlElement.classList.add('dark-theme');
      this.htmlElement.classList.remove('light-theme');
    } else {
      this.htmlElement.classList.remove('dark-theme');
      this.htmlElement.classList.add('light-theme');
    }
  }

  toggleColorsTheme(options: AppSettings) {
    // Remove any existing theme class dynamically
    this.htmlElement.classList.forEach((className) => {
      if (className.endsWith('_theme')) {
        this.htmlElement.classList.remove(className);
      }
    });

    // Add the selected theme class
    this.htmlElement.classList.add(options.activeTheme);
  }

  /**
   * Verifica si el usuario tiene el permiso requerido
   */
  private hasPermission(requiredPermission: number | number[] | undefined): boolean {
    if (!requiredPermission) return true;

    const userPermissions = this.authService.getPermissions();
    const requiredPermissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];
    const userPermsStr = userPermissions.map(p => String(p));

    return requiredPermissions.some(reqPerm =>
      userPermsStr.includes(String(reqPerm))
    );
  }

  /**
   * Indica si un ítem (no navCap) debe mostrarse por permisos. Retorna el ítem
   * con hijos filtrados o null si no debe mostrarse.
   */
  private keepItemByPermission(item: NavItem): NavItem | null {
    if (item.permission !== undefined && !this.hasPermission(item.permission)) {
      return null;
    }
    if (item.children && item.children.length > 0) {
      const filteredChildren = this.filterNavItemsByPermissions(item.children);
      if (filteredChildren.length === 0) return null;
      return { ...item, children: filteredChildren };
    }
    return { ...item };
  }

  /**
   * Filtra los elementos del menú según permisos. Oculta los apartados (navCap)
   * que no tengan ningún ítem visible.
   */
  private filterNavItemsByPermissions(items: NavItem[]): NavItem[] {
    const result: NavItem[] = [];
    let i = 0;

    while (i < items.length) {
      const item = items[i];

      if (item.navCap) {
        const section: NavItem[] = [item];
        let j = i + 1;
        while (j < items.length && !items[j].navCap) {
          section.push(items[j]);
          j++;
        }

        const visible: NavItem[] = [];
        for (let k = 1; k < section.length; k++) {
          const kept = this.keepItemByPermission(section[k]);
          if (kept) visible.push(kept);
        }

        if (visible.length > 0) {
          result.push(section[0]);
          result.push(...visible);
        }
        i = j;
      } else {
        const kept = this.keepItemByPermission(item);
        if (kept) result.push(kept);
        i++;
      }
    }

    return result;
  }
}
