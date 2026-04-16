import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DxButtonModule, DxDataGridModule } from 'devextreme-angular';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FactoresRoutingModule } from './factores-routing.module';
import { ListaFactoresComponent } from './lista-factores/lista-factores.component';
import { AgregarFactorComponent } from './agregar-factor/agregar-factor.component';
import { HasPermissionDirective } from 'src/app/core/haspermission.directive';
import { AgregarFormulaComponent } from './agregar-formula/agregar-formula.component';

@NgModule({
  declarations: [ListaFactoresComponent, AgregarFactorComponent, AgregarFormulaComponent],
  imports: [
    CommonModule,
    FactoresRoutingModule,
    MatIconModule,
    DxDataGridModule,
    DxButtonModule,
    MaterialModule,
    ReactiveFormsModule,
    FormsModule,
    HasPermissionDirective,
  ],
})
export class FactoresModule {}
