import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { OperacionPagosHubComponent } from './operacion-pagos-hub.component';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';

@NgModule({
  declarations: [OperacionPagosHubComponent],
  imports: [
    ModuleHeroComponent,CommonModule, RouterModule, MatIconModule],
  exports: [OperacionPagosHubComponent],
})
export class OperacionPagosHubModule {}
