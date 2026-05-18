import {
  Component,
  Output,
  EventEmitter,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { BrandingComponent } from '../sidebar/branding.component';
import { AppSettings } from 'src/app/config';
import { AuthenticationService } from 'src/app/services/auth.service';
import { NavItem } from '../sidebar/nav-item/nav-item';
import {
  ContratoDetalleDialogComponent,
  ContratoDetalleDialogData,
} from './contrato-detalle-dialog/contrato-detalle-dialog.component';
import {
  NotificacionesService,
  NotificacionesResponse,
  PagoSeguimientoDto,
  PagoServicioInmuebleDto,
  VencimientoRenovacionContratoDto,
} from 'src/app/services/moduleService/notificaciones.service';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { nombreArrendador } from 'src/app/pages/inmuebles/inmuebles-list.mapper';
import {
  extraerArrendatarioDetalleApi,
  primerInmuebleContrato,
} from 'src/app/pages/arrendatarios/arrendatarios-list.mapper';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

/** Rutas mostradas en Panel de accesos para ítems que en sidebar usan `/menu-level`. */
const PANEL_ROUTE_FOR_MENU_LEVEL: Record<string, string> = {
  Administración: '/modulos',
  Clientes: '/clientes',
  Usuarios: '/usuarios',
  Roles: '/roles',
};

/** Texto secundario del Panel de accesos (no mostrar rutas). */
const PANEL_SUBTEXT_BY_DISPLAY_NAME: Record<string, string> = {
  Administración: 'Configuración general del sistema y gestión de módulos.',
  Usuarios: 'Alta, edición y control de usuarios del sistema.',
  Roles: 'Definición de permisos y niveles de acceso.',
  Arrendadores: 'Monitoreo y gestión de inmuebles y arrendatarios.',
  Catálogos: 'Administración arrendadores, inmuebles y arrendatarios.',
  'Perfil Usuario': 'Configuración y actualización de tu información personal.',
};

function isPanelLogoutItem(item: NavItem): boolean {
  return (
    item?.route === '/login' &&
    /cerrar sesi[oó]n|sign out/i.test(item?.displayName || '')
  );
}

function resolvePanelAccessRoute(item: NavItem): string | undefined {
  if (!item.displayName || item.external) return undefined;
  const r = item.route;
  if (!r) return undefined;
  if (r !== '/menu-level') return r;
  const mapped = PANEL_ROUTE_FOR_MENU_LEVEL[item.displayName];
  if (mapped) return mapped;
  const first = item.children?.find((c) => c.route && !c.external);
  return first?.route;
}

function buildPanelAccessItems(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (!item.displayName) continue;
    if (isPanelLogoutItem(item)) continue;
    const route = resolvePanelAccessRoute(item);
    if (!route) continue;
    const subtext = PANEL_SUBTEXT_BY_DISPLAY_NAME[item.displayName] ?? item.subtext;
    out.push({ ...item, route, subtext });
  }
  return out;
}

/** Mensajes / avisos (contratos, alertas generales) */
interface AvisoNotificacion {
  id: number;
  /** Para GET `/arrendatarios/{id}` al abrir el modal (vencimientos). */
  idArrendatario?: number;
  title: string;
  subtitle: string;
  /** Semáforo: success = bien (verde), warning = próximo (amarillo), danger = crítico (rojo). */
  tone?: 'success' | 'warning' | 'amber' | 'danger';
  /** Días restantes para vencer (si aplica). */
  daysLeft?: number;
  detalle?: Partial<ContratoDetalleDialogData>;
}

/** Categorías de estado de recibos (inmuebles / predios) */
interface ReciboEstadoItem {
  id: string;
  tone: 'danger' | 'warning' | 'amber' | 'success' | 'info';
  icon: string;
  label: string;
  detail?: string;
}

interface profiledd {
  id: number;
  title: string;
  link?: string;
  new?: boolean;
}

interface apps {
  id: number;
  icon: string;
  color: string;
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
  selector: 'app-header',
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    BrandingComponent,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent implements OnInit {
  titleCase(input: unknown): string {
    const s = String(input ?? '').trim();
    if (!s) return '';
    // Primera mayúscula y resto minúsculas por palabra (mantiene separadores y números).
    return s
      .toLowerCase()
      .replace(/\p{L}[\p{L}\p{M}'’]*/gu, (w) => {
        const first = w.charAt(0).toUpperCase();
        return first + w.slice(1);
      });
  }

  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  isCollapse: boolean = false; // Initially hidden

  toggleCollpase() {
    this.isCollapse = !this.isCollapse; // Toggle visibility
  }

  showFiller = false;

  public selectedLanguage: any = {
    language: 'English',
    code: 'en',
    type: 'US',
    icon: 'assets/images/flag/icon-flag-en.svg',
  };

  public languages: any[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: 'assets/images/flag/icon-flag-en.svg',
    },
    {
      language: 'Español',
      code: 'es',
      icon: 'assets/images/flag/icon-flag-es.svg',
    },
    {
      language: 'Français',
      code: 'fr',
      icon: 'assets/images/flag/icon-flag-fr.svg',
    },
    {
      language: 'German',
      code: 'de',
      icon: 'assets/images/flag/icon-flag-de.svg',
    },
  ];
  public showNombre: any;
  public showApellidoPaterno: any;
  public showApellidoMaterno: any;
  public showRol: any;
  public showEmail: any;

  @Output() optionsChange = new EventEmitter<AppSettings>();

  options = this.settings.getOptions();

  constructor(
    private settings: CoreService,
    private vsidenav: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService,
    private users: AuthenticationService,
    private router: Router,
    private notificacionesService: NotificacionesService,
    private arrendatariosService: ArrendatariosService,
  ) {
    const user = this.users.getUser();
    this.showNombre = user?.nombre;
    this.showApellidoPaterno = user?.apellidoPaterno || '';
    this.showApellidoMaterno = user?.apellidoMaterno || '';
    this.showRol = user?.rolNombre;
    this.showEmail = user?.userName;
    translate.setDefaultLang('en');
  }

  ngOnInit(): void {
    this.notificacionesService.obtenerNotificaciones().subscribe({
      next: (data) => this.aplicarNotificacionesDesdeApi(data),
      error: (err) => {
        console.error('[notificaciones]', err);
        this.aplicarNotificacionesDesdeApi({
          vencimientosRenovacionesContrato: [],
          pagoServiciosInmuebles: [],
          pagosSeguimiento: [],
        });
      },
    });
  }

  private aplicarNotificacionesDesdeApi(data: NotificacionesResponse): void {
    const v = data.vencimientosRenovacionesContrato ?? [];
    const p = data.pagoServiciosInmuebles ?? [];
    const s = data.pagosSeguimiento ?? [];

    this.avisosLista = v.map((item) => this.mapVencimientoAviso(item));
    this.recibosInmuebles = p.map((item) => this.mapPagoServicioRecibo(item));
    this.recibosPredios = s.map((item) => this.mapSeguimientoRecibo(item));

    this.avisosCount = this.avisosLista.length;
    this.inmueblesNotifCount = this.recibosInmuebles.length;
    this.prediosNotifCount = this.recibosPredios.length;
  }

  private mapVencimientoAviso(v: VencimientoRenovacionContratoDto): AvisoNotificacion {
    const inmueble = String(v.inmueble ?? '').trim() || 'Inmueble';
    const arrendatario = String(v.arrendatario ?? '').trim() || '—';
    const dias = Number(v.diasFaltantes);
    const diasTxt = Number.isFinite(dias) ? `${dias}` : '—';
    const termino = this.formatNotifyDate(v.fechaTerminoContrato);
    const tone = this.tonePorDiasFaltantesNotificacion(dias);
    const idArrRaw = Number(v.idArrendatario);
    const idArrendatario =
      Number.isFinite(idArrRaw) && idArrRaw > 0 ? Math.floor(idArrRaw) : undefined;

    return {
      id: v.id,
      idArrendatario,
      title: 'Vencimiento de contrato',
      subtitle: `Inmueble: ${inmueble} — Arrendatario: ${arrendatario} — Término: ${termino} — Días: ${diasTxt}`,
      daysLeft: Number.isFinite(dias) ? dias : undefined,
      tone,
      detalle: {
        inmueble,
        arrendatario,
        fechaTermino: termino,
      },
    };
  }

  private mapPagoServicioRecibo(p: PagoServicioInmuebleDto): ReciboEstadoItem {
    const inm = String(p.inmueble ?? '').trim() || '—';
    const tipo = String(p.tipoServicio ?? '').trim() || 'Servicio';
    const contrato = String(p.numeroContrato ?? '').trim() || '—';
    const dias = Number(p.diasFaltantes);
    const diasTxt = Number.isFinite(dias) ? `${dias}` : '—';
    const fechaPago = this.formatNotifyDate(p.fechaPago);
    const tone = this.tonePorDiasFaltantesNotificacion(dias);

    return {
      id: String(p.id),
      tone,
      icon: this.iconForReciboTone(tone),
      label: `${tipo} — ${inm}`,
      detail: `Contrato: ${contrato} — Fecha de pago: ${fechaPago} — Días: ${diasTxt}`,
    };
  }

  private mapSeguimientoRecibo(s: PagoSeguimientoDto): ReciboEstadoItem {
    const nombre = String(s.arrendatario ?? '').trim() || 'Arrendatario';
    const dias = Number(s.diasFaltantes);
    const diasTxt = Number.isFinite(dias) ? `${dias}` : '—';
    const fin = this.formatNotifyDate(s.fechaFin);
    const tone = this.tonePorDiasFaltantesNotificacion(dias);

    return {
      id: String(s.id),
      tone,
      icon: this.iconForReciboTone(tone),
      label: nombre,
      detail: `Fin: ${fin} — Días restantes: ${diasTxt}`,
    };
  }

  /**
   * Semáforo para las tres bandejas (vencimientos, pagos servicio, seguimiento).
   * ≤2 días → rojo, ≤6 → amarillo, ≤15 → naranja, resto → verde.
   * Días negativos (vencido) entran en rojo.
   */
  private tonePorDiasFaltantesNotificacion(
    dias: number | undefined | null,
  ): 'success' | 'warning' | 'amber' | 'danger' {
    const d = Number(dias);
    if (!Number.isFinite(d)) return 'success';
    if (d <= 2) return 'danger';
    if (d <= 6) return 'amber';
    if (d <= 15) return 'warning';
    return 'success';
  }

  private formatNotifyDate(iso: string | undefined | null): string {
    if (iso == null || String(iso).trim() === '') return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private iconForReciboTone(tone: ReciboEstadoItem['tone']): string {
    switch (tone) {
      case 'danger':
        return 'x';
      case 'warning':
        return 'alert-circle';
      case 'amber':
        return 'thumb-up';
      case 'success':
        return 'check';
      default:
        return 'receipt';
    }
  }

  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    this.selectedLanguage = lang;
  }

  setlightDark(theme: string) {
    this.options.theme = theme;
    this.emitOptions();
  }

  private emitOptions() {
    this.optionsChange.emit(this.options);
  }

  isLogoutProfile(profile: profiledd): boolean {
    return profile?.link === '/login' && /cerrar sesi[oó]n|sign out/i.test(profile?.title || '');
  }

  onProfileAction(profile: profiledd, event: Event): void {
    if (!this.isLogoutProfile(profile)) return;
    event.preventDefault();
    this.users.logout().subscribe();
  }

  onAvisoContratoClick(a: AvisoNotificacion, event: Event): void {
    event.stopPropagation();
    const idArr = a.idArrendatario;
    if (idArr == null || !Number.isFinite(idArr) || idArr <= 0) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Sin arrendatario asociado',
        text: 'Esta notificación no incluye id de arrendatario para cargar el detalle.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: 'Cargando arrendatario…',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    this.arrendatariosService
      .obtenerArrendatario(idArr)
      .pipe(finalize(() => Swal.close()))
      .subscribe({
        next: (raw) => {
          const data = this.buildDetalleDesdeArrendatarioApi(raw, a);
          this.openContratoDetalleDialog(data);
        },
        error: () => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo cargar el arrendatario',
            text: 'Verifica tu conexión o vuelve a intentar.',
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  /** Pagos de servicios y seguimiento de arrendatarios: no abren modal. */
  onReciboContratoClick(_r: ReciboEstadoItem, event: Event): void {
    event.stopPropagation();
  }

  /** Pie del menú Contratos: lista completa de contratos. */
  verTodoAvisos(): void {
    void this.router.navigate(['/contratos']);
  }

  /** Pie del menú Inmuebles: listado de inmuebles (pagos de servicios). */
  verTodoInmueblesNotif(): void {
    void this.router.navigate(['/inmuebles']);
  }

  /** Pie del menú Arrendatarios: listado de arrendatarios. */
  verTodoArrendatariosNotif(): void {
    void this.router.navigate(['/arrendatarios']);
  }

  private openContratoDetalleDialog(data: ContratoDetalleDialogData): void {
    this.dialog.open(ContratoDetalleDialogComponent, {
      data,
      panelClass: 'contrato-detalle-dialog-shell',
      autoFocus: false,
      maxWidth: '95vw',
      width: 'min(600px, 95vw)',
    });
  }

  private defaultContratoDetalle(): ContratoDetalleDialogData {
    return {
      predio: 'Desarrollo Inmobiliario BHV SA de CV',
      inmueble: 'Oficinas corporativas — Torre B, Piso 4',
      arrendatario: 'Prestalana SA de CV',
      arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
      contrato: 'PC-0001',
      fechaInicio: '01/01/2025',
      fechaTermino: '31/12/2027',
    };
  }

  private buildDetalleDesdeArrendatarioApi(
    raw: unknown,
    aviso: AvisoNotificacion,
  ): ContratoDetalleDialogData {
    const item = extraerArrendatarioDetalleApi(raw);
    const base = this.defaultContratoDetalle();
    const inv = primerInmuebleContrato(item);
    const arrendatarioAviso = String(aviso.detalle?.arrendatario ?? '').trim();
    const terminoAviso = String(aviso.detalle?.fechaTermino ?? '').trim();
    const arrNombre = String(item['arrendatario'] ?? '').trim();

    return {
      titulo: 'Vencimientos y renovaciones',
      predio: inv.direccion !== '—' ? inv.direccion : base.predio,
      inmueble:
        inv.nombre !== '—'
          ? inv.nombre
          : String(aviso.detalle?.inmueble ?? base.inmueble),
      arrendatario: arrendatarioAviso || arrNombre || base.arrendatario,
      arrendador: nombreArrendador(item['arrendador'] as Record<string, unknown> | undefined),
      contrato: this.primerNumeroContratoArrendatario(item),
      fechaInicio: this.formatNotifyDate(
        item['fechaInicio'] != null ? String(item['fechaInicio']) : undefined,
      ),
      fechaTermino:
        terminoAviso && terminoAviso !== '—'
          ? terminoAviso
          : this.formatNotifyDate(
              item['fechaFin'] != null ? String(item['fechaFin']) : undefined,
            ),
    };
  }

  private primerNumeroContratoArrendatario(item: Record<string, unknown>): string {
    const contratos = item['contratos'];
    if (!Array.isArray(contratos) || contratos.length === 0) return '—';
    const c0 = contratos[0] as Record<string, unknown>;
    const n = c0?.['numeroContrato'] ?? c0?.['numero_contrato'] ?? c0?.['numero'];
    const s = String(n ?? '').trim();
    return s || '—';
  }

  /** Contador sobre el ícono (se llena desde GET /notificaciones). */
  avisosCount = 0;
  inmueblesNotifCount = 0;
  prediosNotifCount = 0;

  avisosLista: AvisoNotificacion[] = [];

  /**
   * Misma estructura visual (notify-hub-recibo):
   * - Pagos de servicios (menuNotifInmuebles)
   * - Arrendatarios / seguimiento (menuNotifPredios)
   */
  recibosInmuebles: ReciboEstadoItem[] = [];

  /** Menu "predios" → pagos / seguimiento de arrendatarios */
  recibosPredios: ReciboEstadoItem[] = [];

  profiledd: profiledd[] = [
    {
      id: 1,
      title: 'Perfil de Usuario',
      // link: '/',
    },
    // {
    //   id: 2,
    //   title: 'My Projects',
    //   link: '/',
    // },
    // {
    //   id: 3,
    //   title: 'Inbox',
    //   new: true,
    //   link: '/',
    // },
    // {
    //   id: 4,
    //   title: ' Mode',
    //   link: '/',
    // },
    // {
    //   id: 5,
    //   title: ' Account Settings',
    //   link: '/',
    // },
    {
      id: 6,
      title: 'Cerrar Sesión',
      link: '/login',
    },
  ];

  apps: apps[] = [
    {
      id: 1,
      icon: 'message',
      color: 'primary',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/',
    },
    {
      id: 2,
      icon: 'list-check',
      color: 'secondary',
      title: 'Todo App',
      subtitle: 'Completed task',
      link: '/',
    },
    {
      id: 3,
      icon: 'file-invoice',
      color: 'success',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/',
    },
    {
      id: 4,
      icon: 'calendar',
      color: 'error',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/',
    },
    {
      id: 5,
      icon: 'device-mobile',
      color: 'warning',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/',
    },
    {
      id: 6,
      icon: 'ticket',
      color: 'primary',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/',
    },
    {
      id: 7,
      icon: 'mail',
      color: 'secondary',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/',
    },
    {
      id: 8,
      icon: 'book-2',
      color: 'warning',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/',
    },
  ];
  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/authentication/register',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/authentication/error',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/',
    },
  ];
}

@Component({
  selector: 'search-dialog',
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule],
  templateUrl: 'search-dialog.component.html',
})
export class AppSearchDialogComponent {
  searchText: string = '';
  navItems = navItems;

  readonly navItemsData: NavItem[] = buildPanelAccessItems(navItems);

  constructor(
    private auth: AuthenticationService,
    private dialogRef: MatDialogRef<AppSearchDialogComponent>,
  ) {}

  isLogoutItem(item: NavItem): boolean {
    return (
      item?.route === '/login' &&
      /cerrar sesi[oó]n|sign out/i.test(item?.displayName || '')
    );
  }

  onLogoutClick(event: Event): void {
    event.preventDefault();
    this.dialogRef.close();
    this.auth.logout().subscribe();
  }
}
