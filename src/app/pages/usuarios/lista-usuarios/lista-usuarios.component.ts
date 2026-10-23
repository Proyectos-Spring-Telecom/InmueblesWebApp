import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { ToastrService } from 'ngx-toastr';
import { lastValueFrom } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import { exportarDxDataGridExcel, gridTieneDatosParaExportar } from 'src/app/shared/grid-excel-export';
import Swal from 'sweetalert2';

const DEFAULT_NUEVA_CONTRASENA = 'Dem0o.';

interface AuthPinSlot {
  id: 'director' | 'monitoreo' | 'tercer';
  nombre: string;
  cargo: string;
  iniciales: string;
  expected: string;
  matched: boolean;
}

@Component({
  selector: 'app-lista-usuarios',
  templateUrl: './lista-usuarios.component.html',
  styleUrl: './lista-usuarios.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    trigger('pwdCard', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(-6px)',
          height: 0,
          marginTop: 0,
          paddingTop: 0,
          paddingBottom: 0,
          overflow: 'hidden',
        }),
        animate(
          '220ms ease-out',
          style({
            opacity: 1,
            transform: 'translateY(0)',
            height: '*',
            marginTop: '*',
            paddingTop: '*',
            paddingBottom: '*',
            overflow: 'hidden',
          }),
        ),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate(
          '180ms ease-in',
          style({
            opacity: 0,
            transform: 'translateY(-4px)',
            height: 0,
            marginTop: 0,
            paddingTop: 0,
            paddingBottom: 0,
          }),
        ),
      ]),
    ]),
    trigger('pinShake', [
      transition('idle => error', [
        animate('60ms', style({ transform: 'translateX(-8px)' })),
        animate('60ms', style({ transform: 'translateX(8px)' })),
        animate('60ms', style({ transform: 'translateX(-6px)' })),
        animate('60ms', style({ transform: 'translateX(6px)' })),
        animate('60ms', style({ transform: 'translateX(0)' })),
      ]),
    ]),
  ],
})
export class ListaUsuariosComponent implements OnInit, OnDestroy {
  isLoading: boolean = false;
  listaUsuarios: any;
  public grid: boolean = false;
  public showFilterRow: boolean;
  public showHeaderFilter: boolean;
  public loadingVisible: boolean = false;
  public mensajeAgrupar: string =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  public loading: boolean;
  public loadingMessage: string = 'Cargando...';
  @ViewChild(DxDataGridComponent, { static: false })
  dataGrid: DxDataGridComponent;
  public autoExpandAllGroups: boolean = true;
  isGrouped: boolean = false;
  public paginaActualData: any[] = [];
  public filtroActivo: string = '';
  public paginaActual: number = 1;
  public totalRegistros: number = 0;
  public pageSize: number = 20;
  public totalPaginas: number = 0;
  public registros: any[] = [];

  // --- Cambio de contraseña (admin): autorización PIN + nueva contraseña ---
  showPasswordModal = false;
  showAuthPinModal = false;
  passwordChangeAuthorized = false;
  authSuccessView = false;
  loadingPassword = false;
  pinAuthError = false;
  pinShakeState: 'idle' | 'error' = 'idle';
  authDigits: string[] = ['', '', '', ''];
  readonly authDigitIndexes = [0, 1, 2, 3];
  private authSuccessTimer: ReturnType<typeof setTimeout> | null = null;
  private authHandoffTimer: ReturnType<typeof setTimeout> | null = null;
  usuarioPasswordSeleccionado: any = null;
  passwordNueva = DEFAULT_NUEVA_CONTRASENA;
  passwordConfirmar = '';
  hidePass = true;
  hideConfirm = true;
  confirmFocused = false;
  confirmMatch = false;

  readonly authPins: AuthPinSlot[] = [
    { id: 'director', nombre: 'Israel Negrete Lepe', cargo: 'Director', iniciales: 'IN', expected: '0000', matched: false },
    { id: 'monitoreo', nombre: 'Crystal Olivares Loeza', cargo: 'Jefe De Monitoreo', iniciales: 'CO', expected: '1111', matched: false },
    { id: 'tercer', nombre: 'Andrea Daniela Barajas Cruz', cargo: 'Autorización', iniciales: 'AB', expected: '2222', matched: false },
  ];

  constructor(
    private usuService: UsuariosService,
    private route: Router,
    private toastr: ToastrService,
  ) {
    this.showFilterRow = true;
    this.showHeaderFilter = true;
  }

  ngOnInit(): void {
    this.setupDataSource();
  }

  ngOnDestroy(): void {
    this.clearAuthSuccessTimer();
    this.clearAuthHandoffTimer();
  }

  agregarUsuario() {
    this.route.navigateByUrl('/usuarios/agregar-usuario');
  }

  onPageIndexChanged(e: any) {
    const pageIndex = e.component.pageIndex();
    this.paginaActual = pageIndex + 1;
    e.component.refresh();
  }

  onGridOptionChanged(e: any) {
    if (e.fullName !== 'searchPanel.text') return;

    const grid = this.dataGrid?.instance;
    const qRaw = (e.value ?? '').toString().trim();
    if (!qRaw) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaUsuarios);
      return;
    }
    this.filtroActivo = qRaw;

    const norm = (v: any) =>
      (v == null ? '' : String(v))
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

    const q = norm(qRaw);

    let columnas: any[] = [];
    try {
      const colsOpt = grid?.option('columns');
      if (Array.isArray(colsOpt) && colsOpt.length) columnas = colsOpt;
    } catch {}
    if (!columnas.length && grid?.getVisibleColumns) {
      columnas = grid.getVisibleColumns();
    }

    const dataFields: string[] = columnas
      .map((c: any) => c?.dataField)
      .filter((df: any) => typeof df === 'string' && df.trim().length > 0);

    const getByPath = (obj: any, path: string) =>
      !obj || !path
        ? undefined
        : path.split('.').reduce((acc, k) => acc?.[k], obj);

    let qStatusNum: number | null = null;
    if (q === '1' || q === 'Activo') qStatusNum = 1;
    else if (q === '0' || q === 'Inactivo') qStatusNum = 0;

    const dataFiltrada = (this.paginaActualData || []).filter((row: any) => {
      const hitCols = dataFields.some((df) =>
        norm(getByPath(row, df)).includes(q)
      );

      const estNum = Number(row?.Estatus ?? row?.estatus);
      const estHit =
        Number.isFinite(estNum) &&
        (qStatusNum !== null
          ? estNum === qStatusNum
          : String(estNum).toLowerCase().includes(q));

      const hitExtras = [
        norm(row?.Id),
        norm(row?.id),
        norm(row?.NombreCompleto),
        norm(row?.UserName),
        norm(row?.Telefono),
        norm(row?.RolNombre),
      ].some((s) => s.includes(q));

      return hitCols || estHit || hitExtras;
    });

    grid?.option('dataSource', dataFiltrada);
  }

  setupDataSource() {
    this.loading = true;

    const defaultPageSize = this.pageSize || 10;

    this.listaUsuarios = new CustomStore({
      key: 'id',
      load: async (loadOptions: any) => {
        const skipValue = Number(loadOptions?.skip) || 0;
        const takeValue = Number(loadOptions?.take) || defaultPageSize;
        const page = Math.floor(skipValue / takeValue) + 1;

        try {
          const response: any = await lastValueFrom(
            this.usuService.obtenerUsuariosData(page, takeValue)
          );

          this.loading = false;

          const paginated = response?.paginated ?? {};
          const data = Array.isArray(response?.data) ? response.data : [];

          const totalRegistros = Number(paginated.total ?? data.length ?? 0);
          const paginaActual = Number(paginated.page ?? page);
          const limite = Number(paginated.limit ?? takeValue);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = limite;

          const dataTransformada = data.map((item: any) => {
            const nombre = item?.Nombre ?? item?.nombre ?? '';
            const paterno =
              item?.ApellidoPaterno ?? item?.apellidoPaterno ?? '';
            const materno =
              item?.ApellidoMaterno ?? item?.apellidoMaterno ?? '';

            return {
              ...item,
              id: Number(item?.Id ?? item?.id),
              idRol: Number(item?.IdRol ?? item?.idRol),
              idCliente: Number(item?.IdCliente ?? item?.idCliente),
              NombreCompleto: [nombre, paterno, materno]
                .filter(Boolean)
                .join(' '),
            };
          });

          this.paginaActualData = dataTransformada;

          return {
            data: dataTransformada,
            totalCount: totalRegistros,
          };
        } catch (_error) {
          this.loading = false;
          return { data: [], totalCount: 0 };
        }
      },
    });
  }

  toNum(v: any): number {
    const n = Number((v ?? '').toString().trim());
    return Number.isFinite(n) ? n : 0;
  }

  actualizarUsuario(idUsuario: number) {
    this.route.navigateByUrl('/usuarios/editar-usuario/' + idUsuario);
  }

  eliminarUsuario(usuario: any) {
    Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Eliminar Usuario!',
      html: `¿Está seguro que requiere eliminar el usuario: <br> ${usuario.NombreCompleto}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.usuService.eliminarUsuario(usuario.Id).subscribe(
          (response) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Eliminado!',
              html: `El usuario ha sido eliminado de forma exitosa.`,
              icon: 'success',
              showCancelButton: false,
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupDataSource();
          },
          (error) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Ops!',
              html: `Error al intentar eliminar el usuario.`,
              icon: 'error',
              showCancelButton: false,
            });
          }
        );
      }
    });
  }

  activar(rowData: any) {
    Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar el usuario: <br> <strong>${rowData.NombreCompleto}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.usuService.updateEstatus(rowData.id, 1).subscribe(
          (response) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Confirmación Realizada!',
              html: `El usuario ha sido activado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });

            this.setupDataSource();
            this.dataGrid.instance.refresh();
            // this.obtenerListaModulos();
          },
          (error) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Ops!',
              html: `${error}`,
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          }
        );
      }
    });
  }

  desactivar(rowData: any) {
    Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar el usuario:<br> <strong>${rowData.NombreCompleto}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.value) {
        this.usuService.updateEstatus(rowData.id, 0).subscribe(
          (response) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Confirmación Realizada!',
              html: `El usuario ha sido desactivado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.setupDataSource();
            this.dataGrid.instance.refresh();
            // this.obtenerListaModulos();
          },
          (error) => {
            Swal.fire({
              color: '#ffffff',
              background: '#141a21',
              title: '¡Ops!',
              html: `${error}`,
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          }
        );
      }
    });
    // console.log('Desactivar:', rowData);
  }

  toggleExpandGroups() {
    const groupedColumns = this.dataGrid.instance
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      Swal.fire({
        color: '#ffffff',
        background: '#141a21',
        title: '¡Ops!',
        text: 'Debes arrastar un encabezado de una columna para expandir o contraer grupos.',
        icon: 'warning',
        showCancelButton: false,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false,
      });
    } else {
      this.autoExpandAllGroups = !this.autoExpandAllGroups;
      this.dataGrid.instance.refresh();
    }
  }

  limpiarCampos() {
    this.dataGrid.instance.clearGrouping();
    this.dataGrid.instance.pageIndex(0);
    this.dataGrid.instance.refresh();
    this.isGrouped = false;
  }

  puedeExportarExcel(): boolean {
    return gridTieneDatosParaExportar(this.dataGrid?.instance);
  }

  async exportarExcel(): Promise<void> {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    try {
      await exportarDxDataGridExcel({ component: inst, fileName: 'Usuarios' });
    } catch (err) {
      console.error('Error al exportar grid:', err);
    }
  }

  // hasPermission(permission: string): boolean {
  //   return this.permissionsService.getPermission(permission) !== undefined;
  // }1

  // ---------------------------------------------------------------------------
  // Cambio de contraseña desde el listado (modal PIN + modal contraseña)
  // ---------------------------------------------------------------------------

  abrirModalCambiarContrasena(row: any) {
    this.usuarioPasswordSeleccionado = row;
    this.passwordNueva = DEFAULT_NUEVA_CONTRASENA;
    this.passwordConfirmar = '';
    this.hidePass = true;
    this.hideConfirm = true;
    this.confirmFocused = false;
    this.confirmMatch = false;
    this.passwordChangeAuthorized = false;
    this.showPasswordModal = false;
    this.resetAuthPinFields();
    this.showAuthPinModal = true;
    setTimeout(() => this.focusAuthDigit(0), 80);
  }

  /** Se oculta solo cuando ya coinciden y el usuario ya no está escribiendo en Confirmar. */
  get mostrarCardConfirm(): boolean {
    if (this.confirmMatch && !this.confirmFocused) {
      return false;
    }
    return this.confirmFocused || (this.passwordConfirmar ?? '').length > 0;
  }

  get canSubmitPasswordChange(): boolean {
    return this.confirmMatch && this.passwordChangeAuthorized;
  }

  get authPinCode(): string {
    return this.authDigits.join('');
  }

  get canClickAuthorize(): boolean {
    return this.authPinCode.length === 4 && !this.loadingPassword;
  }

  get authPinsRevelados(): AuthPinSlot[] {
    return this.authPins.filter((p) => p.matched);
  }

  onPasswordNuevaInput() {
    this.validateConfirmMatch();
  }

  onConfirmFocus() {
    this.confirmFocused = true;
  }

  onConfirmPasswordInput() {
    this.validateConfirmMatch();
  }

  onConfirmPasswordBlur() {
    this.confirmFocused = false;
    this.validateConfirmMatch();
  }

  private validateConfirmMatch() {
    const nueva = this.passwordNueva ?? '';
    const confirmar = this.passwordConfirmar ?? '';
    this.confirmMatch =
      nueva.length > 0 && confirmar.length > 0 && nueva === confirmar;
  }

  cancelarCambioContrasena() {
    if (this.loadingPassword) {
      return;
    }
    this.resetPasswordFormFields();
    this.showPasswordModal = false;
  }

  onAuthDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = (input.value ?? '').replace(/\D/g, '');
    const digit = raw.slice(-1);
    this.authDigits[index] = digit;
    input.value = digit;
    this.pinAuthError = false;
    this.pinShakeState = 'idle';
    if (digit && index < 3) {
      this.focusAuthDigit(index + 1);
    }
  }

  onAuthDigitKeydown(index: number, event: KeyboardEvent): void {
    const key = event.key;
    if (key === 'Backspace') {
      if (this.authDigits[index]) {
        this.authDigits[index] = '';
        return;
      }
      if (index > 0) {
        event.preventDefault();
        this.authDigits[index - 1] = '';
        this.focusAuthDigit(index - 1);
      }
      return;
    }
    if (key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusAuthDigit(index - 1);
      return;
    }
    if (key === 'ArrowRight' && index < 3) {
      event.preventDefault();
      this.focusAuthDigit(index + 1);
      return;
    }
    if (key === 'Enter' && this.canClickAuthorize) {
      event.preventDefault();
      this.confirmarAuthPinsYCambiar();
    }
  }

  onAuthDigitPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text') ?? '')
      .replace(/\D/g, '')
      .slice(0, 4);
    if (!text) {
      return;
    }
    this.authDigits = ['', '', '', ''];
    for (let i = 0; i < text.length; i++) {
      this.authDigits[i] = text[i];
    }
    this.pinAuthError = false;
    this.focusAuthDigit(Math.min(text.length, 3));
  }

  private focusAuthDigit(index: number): void {
    const el = document.getElementById(
      `listaUsuariosAuthDigit_${index}`,
    ) as HTMLInputElement | null;
    el?.focus();
    el?.select();
  }

  cancelarAuthPins(): void {
    if (this.loadingPassword || this.authSuccessView) {
      return;
    }
    this.clearAuthSuccessTimer();
    this.clearAuthHandoffTimer();
    this.resetAuthPinFields();
    this.showAuthPinModal = false;
    this.usuarioPasswordSeleccionado = null;
    this.passwordChangeAuthorized = false;
  }

  confirmarAuthPinsYCambiar(): void {
    if (this.loadingPassword || this.authSuccessView) {
      return;
    }

    const code = this.authPinCode;
    if (code.length !== 4) {
      this.toastr.warning(
        'Ingresa el código de autorización completo.',
        'Requerido',
      );
      return;
    }

    const match = this.authPins.find((p) => p.expected === code);
    if (!match) {
      this.pinAuthError = true;
      this.pinShakeState = 'idle';
      requestAnimationFrame(() => {
        this.pinShakeState = 'error';
      });
      this.authDigits = ['', '', '', ''];
      this.focusAuthDigit(0);
      this.toastr.error(
        'Código de autorización inválido.',
        'No autorizado',
      );
      return;
    }

    this.authPins.forEach((p) => {
      p.matched = p.id === match.id;
    });
    this.pinAuthError = false;
    this.authSuccessView = true;
    this.passwordChangeAuthorized = true;
    // Limpia dígitos después de iniciar el fade, para no vaciar los cuadros a la vista.
    setTimeout(() => {
      this.authDigits = ['', '', '', ''];
    }, 300);
    this.clearAuthSuccessTimer();
    this.authSuccessTimer = setTimeout(() => {
      this.pasarACambioContrasena();
    }, 3000);
  }

  private pasarACambioContrasena(): void {
    this.clearAuthSuccessTimer();
    this.clearAuthHandoffTimer();
    // Cierra autorización con animación CSS y luego abre el de contraseña.
    this.showAuthPinModal = false;
    this.authHandoffTimer = setTimeout(() => {
      this.authSuccessView = false;
      this.showPasswordModal = true;
      this.authHandoffTimer = null;
    }, 320);
  }

  private clearAuthSuccessTimer(): void {
    if (this.authSuccessTimer != null) {
      clearTimeout(this.authSuccessTimer);
      this.authSuccessTimer = null;
    }
  }

  private clearAuthHandoffTimer(): void {
    if (this.authHandoffTimer != null) {
      clearTimeout(this.authHandoffTimer);
      this.authHandoffTimer = null;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    if (!this.showPasswordModal && !this.showAuthPinModal) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private resetAuthPinFields(): void {
    this.clearAuthSuccessTimer();
    this.clearAuthHandoffTimer();
    this.authPins.forEach((p) => {
      p.matched = false;
    });
    this.authDigits = ['', '', '', ''];
    this.pinAuthError = false;
    this.pinShakeState = 'idle';
    this.authSuccessView = false;
  }

  private resetPasswordFormFields(): void {
    this.usuarioPasswordSeleccionado = null;
    this.passwordNueva = DEFAULT_NUEVA_CONTRASENA;
    this.passwordConfirmar = '';
    this.hidePass = true;
    this.hideConfirm = true;
    this.confirmFocused = false;
    this.confirmMatch = false;
    this.loadingPassword = false;
    this.passwordChangeAuthorized = false;
    this.showAuthPinModal = false;
    this.resetAuthPinFields();
  }

  confirmChangePassword() {
    if (!this.passwordChangeAuthorized) {
      this.toastr.error(
        'Se requiere autorización previa para cambiar la contraseña.',
        'No autorizado',
      );
      return;
    }
    if (!this.canSubmitPasswordChange) {
      this.validateConfirmMatch();
      this.toastr.warning('Las contraseñas no coinciden.', 'Requerido');
      return;
    }

    const id = Number(
      this.usuarioPasswordSeleccionado?.id ??
        this.usuarioPasswordSeleccionado?.Id,
    );
    if (!Number.isFinite(id) || id <= 0) {
      this.toastr.error('No se pudo identificar al usuario.', '¡Ops!');
      return;
    }

    this.ejecutarCambioContrasena();
  }

  /** Solo se llama después de validar autorización y contraseñas. */
  private ejecutarCambioContrasena(): void {
    if (!this.passwordChangeAuthorized) {
      this.toastr.error(
        'Se requiere autorización previa para cambiar la contraseña.',
        'No autorizado',
      );
      return;
    }

    const nueva = this.passwordNueva ?? '';
    const confirmar = this.passwordConfirmar ?? '';

    const id = Number(
      this.usuarioPasswordSeleccionado?.id ??
        this.usuarioPasswordSeleccionado?.Id,
    );
    if (!Number.isFinite(id) || id <= 0) {
      this.toastr.error('No se pudo identificar al usuario.', '¡Ops!');
      return;
    }

    this.loadingPassword = true;
    this.usuService
      .cambiarAccesoUsuario({
        idUsuario: id,
        passwordNueva: nueva,
        passwordConfirmacion: confirmar,
      })
      .subscribe({
        next: () => {
          this.loadingPassword = false;
          this.resetPasswordFormFields();
          this.showPasswordModal = false;
          this.mostrarAlertaExitoCambioContrasena();
        },
        error: (err) => {
          this.loadingPassword = false;
          const raw = err?.error;
          if (this.esExitoCambioContrasena(raw, err)) {
            this.resetPasswordFormFields();
            this.showPasswordModal = false;
            this.mostrarAlertaExitoCambioContrasena();
            return;
          }
          const msg = this.mensajeErrorCambioContrasena(err);
          this.toastr.error(msg, '¡Ops!');
        },
      });
  }

  private mostrarAlertaExitoCambioContrasena(): void {
    void Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Operación Exitosa!',
      text: 'La contraseña del usuario ha sido actualizada correctamente.',
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
      footer:
        'Por su seguridad, el usuario debe cambiar esta contraseña para su seguridad.',
    });
  }

  private esExitoCambioContrasena(raw: unknown, err: unknown): boolean {
    const status = Number((err as { status?: number })?.status);
    if (status >= 200 && status < 300) {
      return true;
    }
    const texto =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object'
          ? JSON.stringify(raw)
          : '';
    return /actualizada exitosamente|correctamente|success/i.test(texto);
  }

  private mensajeErrorCambioContrasena(err: unknown): string {
    const raw = (err as { error?: unknown; message?: string })?.error;
    if (typeof raw === 'string' && raw.trim()) {
      const t = raw.trim();
      try {
        const parsed = JSON.parse(t) as Record<string, unknown>;
        const fromJson =
          parsed?.['message'] ?? parsed?.['error'] ?? parsed?.['title'];
        if (typeof fromJson === 'string' && fromJson.trim()) {
          return fromJson.trim();
        }
      } catch {
        return t;
      }
      return t;
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const msg = obj['message'] ?? obj['error'] ?? obj['title'];
      if (typeof msg === 'string' && msg.trim()) {
        return msg.trim();
      }
    }
    const fallback = (err as { message?: string })?.message;
    return fallback?.trim() || 'Error al actualizar la contraseña.';
  }
}
