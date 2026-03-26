import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { InstalacionCentralSede } from 'src/app/services/moduleService/instalacion-central.service';
import { ModulosService } from 'src/app/services/moduleService/modulos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-instalacion-central',
  templateUrl: './agregar-instalacion-central.component.html',
  styleUrl: './agregar-instalacion-central.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarInstalacionCentralComponent implements OnInit, AfterViewInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public instForm: FormGroup;
  public idSedeCentral: number;
  public title = 'Agregar Instalación Central';
  public listaClientes: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private instalacionService: InstalacionCentralSede,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private clieService: ClientesService,
  ) { }

  ngOnInit(): void {
    this.obtenerClientes();
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idSedeCentral = params['idSedeCentral'];
      if (this.idSedeCentral) {
        this.title = 'Actualizar Instalación Central';
        this.obtenerInstalacionSentral();
      }
    });
  }

  cerrarModalAgregar(): void {
    this.modalAgregarVisible = false;
  }

  initForm() {
    this.instForm = this.fb.group({
      idCliente: ['', Validators.required],
      lat: ['', Validators.required],
      lng: ['', Validators.required],
      nombre: ['', Validators.required],
      nroPisos: [null],
    });
  }

  obtenerInstalacionSentral() {
    this.instalacionService.obtenerInstalacion(this.idSedeCentral).subscribe(
      (response: any) => {
        const data = response.data ?? response;

        this.instForm.patchValue({
          idEquipo: data.idEquipo,
          idCliente: data.idCliente,
          nombre: data.nombre,
          idSedeCentral: data.idSedeCentral,
          lat: data.lat,
          lng: data.lng,
          nroPisos: data.nroPisos,
        });

        this.latSeleccionada = Number(data.lat);
        this.lngSeleccionada = Number(data.lng);

        this.actualizarMarcadorDesdeCoords();
      }
    );
  }

  private actualizarMarcadorDesdeCoords(): void {
    const w = window as any;

    if (!this.map || this.latSeleccionada == null || this.lngSeleccionada == null || !w.google || !w.google.maps) {
      return;
    }

    const iconUrl = this.PIN_URL;

    if (this.marker) {
      this.marker.setMap(null);
    }

    this.marker = new w.google.maps.Marker({
      position: { lat: this.latSeleccionada, lng: this.lngSeleccionada },
      map: this.map,
      icon: {
        url: iconUrl,
        scaledSize: new w.google.maps.Size(70, 70),
        anchor: new w.google.maps.Point(35, 70),
      },
    });

    this.map.setCenter({ lat: this.latSeleccionada, lng: this.lngSeleccionada });
    this.map.setZoom(15);
  }

  obtenerClientes() {
    this.clieService.obtenerClientes().subscribe((response) => {
      this.listaClientes = (response.data || []).map((c: any) => ({
        ...c,
        id: Number(c.id),
      }));
    });
  }

  map: any = null;

  ngAfterViewInit(): void {
    this.loadGoogleMaps()
      .then(() => {
        this.initMap();
      })
      .catch((err) => {
        console.error('No se pudo cargar Google Maps', err);
      });
  }

  abrirModalAgregar(): void {
    this.modalAgregarVisible = true;

    setTimeout(() => {
      this.loadGoogleMaps()
        .then(() => {
          this.initMap();
        })
        .catch((err) => {
          console.error('No se pudo cargar Google Maps', err);
        });
    }, 50);
  }

  loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;

      if (w.google && w.google.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');

      script.onload = () => resolve();
      script.onerror = (e) => reject(e);

      document.head.appendChild(script);
    });
  }

  initMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const w = window as any;
    if (!w.google || !w.google.maps) return;

    this.map = new w.google.maps.Map(mapElement, {
      center: { lat: 19.4326, lng: -99.1332 },
      zoom: 12,
    });

    this.map.addListener('click', (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      this.latSeleccionada = lat;
      this.lngSeleccionada = lng;

      this.instForm.patchValue({
        lat,
        lng,
      });

      const iconUrl = this.PIN_URL;

      if (this.marker) {
        this.marker.setMap(null);
      }

      this.marker = new w.google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        icon: {
          url: iconUrl,
          scaledSize: new w.google.maps.Size(60, 60),
          anchor: new w.google.maps.Point(30, 60),
        },
      });

      this.map.panTo({ lat, lng });
    });
  }

  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  modalAgregarVisible = false;

  private readonly PIN_URL = 'assets/images/logos/marker_blue.webp';

  latSeleccionada: number | null = null;
  lngSeleccionada: number | null = null;
  marker: any = null;

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.instForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: any = {
        idCliente: 'Cliente',
        nombre: 'Nombre de la Instalación',
      };

      const camposFaltantes: string[] = [];

      Object.keys(this.instForm.controls).forEach((key) => {
        const control = this.instForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          if (key !== 'lat' && key !== 'lng') {
            camposFaltantes.push(etiquetas[key] || key);
          }
        }
      });

      const faltaUbicacion = this.instForm.get('lat')?.invalid || this.instForm.get('lng')?.invalid;

      if (faltaUbicacion) {
        camposFaltantes.push('Ubicación de la instalación');
      }

      const lista = camposFaltantes
        .map(
          (campo, index) => `
        <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                    background: #caa8a8; text-align: center; margin-bottom: 8px;
                    border-radius: 4px;">
          <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
        </div>
      `
        )
        .join('');

      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Faltan datos de la instalación!',
        html: `
          <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
            Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
            Por favor complétalos antes de continuar:
          </p>
          <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
        `,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal2-padding swal2-border',
        },
      });
      return;
    }

    const payload = {
      ...this.instForm.value,
      idCliente: Number(this.instForm.value.idCliente),
      lat: Number(this.instForm.value.lat),
      lng: Number(this.instForm.value.lng),
      nroPisos: this.instForm.value.nroPisos ? Number(this.instForm.value.nroPisos) : null,
    };

    this.instalacionService.agregarInstalacion(payload).subscribe(
      (response: any) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó una nueva instalación central de manera exitosa.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      (error: any) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al agregar la instalación central.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      }
    );
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idSedeCentral) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    if (this.instForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        idCliente: 'Cliente',
        nombre: 'Nombre de la Instalación',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.instForm.controls).forEach((key) => {
        const control = this.instForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes
        .map(
          (campo, index) => `
          <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                      background: #caa8a8; text-align: center; margin-bottom: 8px;
                      border-radius: 4px;">
            <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
          </div>
        `
        )
        .join('');

      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Faltan campos obligatorios!',
        html: `
            <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
              Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
              Por favor complétalos antes de continuar:
            </p>
            <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
          `,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal2-padding swal2-border',
        },
      });
      return;
    }

    const payload = {
      nombre: this.instForm.value.nombre,
      idCliente: Number(this.instForm.value.idCliente),
      lat: Number(this.instForm.value.lat),
      lng: Number(this.instForm.value.lng),
      nroPisos: this.instForm.value.nroPisos ? Number(this.instForm.value.nroPisos) : null,
    };

    this.instalacionService.actualizarInstalacion(this.idSedeCentral, payload).subscribe(
      (response: any) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          title: '¡Operación Exitosa!',
          text: `Los datos de la oficina central se actualizaron correctamente.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
        this.regresar();
      },
      (error: any) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          title: '¡Ops!',
          text: `Ocurrió un error al actualizar la oficina central.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      }
    );
  }

  regresar() {
    this.route.navigateByUrl('/instalaciones-centrales');
  }
}
