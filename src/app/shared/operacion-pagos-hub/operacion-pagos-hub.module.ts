import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { OperacionPagosHubComponent } from './operacion-pagos-hub.component';

@NgModule({
  declarations: [OperacionPagosHubComponent],
  imports: [CommonModule, RouterModule, MatIconModule],
  exports: [OperacionPagosHubComponent],
})
export class OperacionPagosHubModule {}
