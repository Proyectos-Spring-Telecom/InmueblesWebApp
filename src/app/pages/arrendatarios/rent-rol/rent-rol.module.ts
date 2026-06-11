import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RentRolRoutingModule } from './rent-rol-routing.module';
import { RentRolComponent } from './rent-rol.component';

@NgModule({
  declarations: [RentRolComponent],
  imports: [CommonModule, RentRolRoutingModule, MatIconModule],
})
export class RentRolModule {}
