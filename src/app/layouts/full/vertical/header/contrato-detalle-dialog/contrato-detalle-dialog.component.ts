import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

/** Datos que muestra el modal (enlazar a API cuando exista). */
export interface ContratoDetalleDialogData {
  titulo?: string;
  predio: string;
  inmueble: string;
  arrendatario: string;
  arrendador: string;
  contrato: string;
  fechaInicio: string;
  fechaTermino: string;
}

@Component({
  selector: 'app-contrato-detalle-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './contrato-detalle-dialog.component.html',
  styleUrl: './contrato-detalle-dialog.component.scss',
})
export class ContratoDetalleDialogComponent {
  readonly titulo: string;
  readonly filas: { k: string; v: string }[];

  constructor(
    private readonly dialogRef: MatDialogRef<ContratoDetalleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: ContratoDetalleDialogData,
  ) {
    this.titulo = data.titulo?.trim() || 'Detalles de Contrato';
    this.filas = [
      { k: 'Predio', v: data.predio },
      { k: 'Inmueble', v: data.inmueble },
      { k: 'Arrendatario', v: data.arrendatario },
      { k: 'Arrendador', v: data.arrendador },
      { k: 'Contrato', v: data.contrato },
      { k: 'Fecha de Inicio', v: data.fechaInicio },
      { k: 'Fecha de Termino', v: data.fechaTermino },
    ];
  }

  cerrar(): void {
    this.dialogRef.close();
  }

  renovar(): void {
    this.dialogRef.close({ accion: 'renovar' });
  }

  cancelarContrato(): void {
    this.dialogRef.close({ accion: 'cancelar' });
  }
}
