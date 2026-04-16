import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ARRENDATARIOS_FORM_DEMO, INMUEBLES_ARRENDATARIOS_DEMO } from '../arrendatarios-demo.data';

@Component({
  selector: 'app-agregar-arrendatario',
  templateUrl: './agregar-arrendatario.component.html',
  styleUrl: './agregar-arrendatario.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarArrendatarioComponent implements OnInit {
  public title = 'Agregar Arrendatario';
  public submitButton: string = 'Guardar';
  public arrendatarioForm: FormGroup;
  public idArrendatario: number;
  public inmueblesCatalogo = INMUEBLES_ARRENDATARIOS_DEMO.map((i) => ({
    id: i.idInmueble,
    nombre: i.nombreInmueble,
  }));

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRoute.params.subscribe((params) => {
      this.idArrendatario = Number(params['idArrendatario']);
      if (this.idArrendatario) {
        this.title = 'Actualizar Arrendatario';
        this.submitButton = 'Actualizar';
        this.cargarDemoEdicion(this.idArrendatario);
      }
    });
  }

  get locales(): FormArray {
    return this.arrendatarioForm.get('locales') as FormArray;
  }

  get totalMensualidad(): number {
    return this.locales.controls.reduce((acc, control) => {
      const n = Number(control.get('mensualidadMxn')?.value ?? 0);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  get totalSuperficie(): number {
    return this.locales.controls.reduce((acc, control) => {
      const n = Number(control.get('superficieM2')?.value ?? 0);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  private initForm(): void {
    this.arrendatarioForm = this.fb.group({
      razonSocial: ['', Validators.required],
      nombreComercial: ['', Validators.required],
      rfc: ['', [Validators.required, Validators.minLength(12)]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.minLength(10)]],
      giroPrincipal: ['', Validators.required],
      arrendador: ['', Validators.required],
      observaciones: [''],
      locales: this.fb.array([this.createLocalGroup()]),
    });
  }

  private createLocalGroup(data?: any): FormGroup {
    return this.fb.group({
      idLocal: [data?.idLocal ?? Date.now(), Validators.required],
      nombreLocal: [data?.nombreLocal ?? '', Validators.required],
      idInmueble: [data?.idInmueble ?? null, Validators.required],
      nombreInmueble: [data?.nombreInmueble ?? '', Validators.required],
      nivel: [data?.nivel ?? '', Validators.required],
      superficieM2: [data?.superficieM2 ?? 0, [Validators.required, Validators.min(1)]],
      mensualidadMxn: [data?.mensualidadMxn ?? 0, [Validators.required, Validators.min(0)]],
      fechaInicio: [data?.fechaInicio ?? '', Validators.required],
      fechaTermino: [data?.fechaTermino ?? '', Validators.required],
      estatusContrato: [data?.estatusContrato ?? 'vigente', Validators.required],
    });
  }

  agregarLocal(): void {
    this.locales.push(this.createLocalGroup());
  }

  duplicarLocal(index: number): void {
    const source = this.locales.at(index)?.value;
    if (!source) return;
    this.locales.push(
      this.createLocalGroup({
        ...source,
        idLocal: Date.now() + Math.floor(Math.random() * 1000),
        nombreLocal: `${source.nombreLocal} copia`,
      }),
    );
  }

  eliminarLocal(index: number): void {
    if (this.locales.length <= 1) {
      Swal.fire({
        title: 'Local requerido',
        text: 'Debe existir al menos un local en el arrendatario.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        background: '#141a21',
        color: '#ffffff',
      });
      return;
    }
    this.locales.removeAt(index);
  }

  onInmuebleChange(control: AbstractControl): void {
    const idInmueble = Number(control.get('idInmueble')?.value);
    const inmueble = this.inmueblesCatalogo.find((item) => item.id === idInmueble);
    control.patchValue(
      {
        nombreInmueble: inmueble?.nombre ?? '',
      },
      { emitEvent: false },
    );
  }

  private cargarDemoEdicion(id: number): void {
    const registro = ARRENDATARIOS_FORM_DEMO.find((item) => item.id === id);
    if (!registro) return;
    this.arrendatarioForm.patchValue(
      {
        razonSocial: registro.razonSocial,
        nombreComercial: registro.nombreComercial,
        rfc: registro.rfc,
        correo: registro.correo,
        telefono: registro.telefono,
        giroPrincipal: registro.giroPrincipal,
        arrendador: registro.arrendador,
        observaciones: registro.observaciones,
      },
      { emitEvent: false },
    );

    this.locales.clear();
    registro.locales.forEach((local) => this.locales.push(this.createLocalGroup(local)));
  }

  submit(): void {
    if (this.arrendatarioForm.invalid) {
      this.arrendatarioForm.markAllAsTouched();
      Swal.fire({
        title: '¡Revise el formulario!',
        text: 'Complete todos los campos requeridos del arrendatario y sus locales.',
        icon: 'error',
        confirmButtonColor: '#3085d6',
        background: '#141a21',
        color: '#ffffff',
      });
      return;
    }

    Swal.fire({
      title: '¡Operación Exitosa!',
      text: this.idArrendatario
        ? 'El arrendatario y sus locales se actualizaron correctamente.'
        : 'Se agregó el arrendatario con su arreglo de locales.',
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
      background: '#141a21',
      color: '#ffffff',
    });
    this.regresar();
  }

  regresar(): void {
    this.router.navigateByUrl('/arrendatarios');
  }
}
