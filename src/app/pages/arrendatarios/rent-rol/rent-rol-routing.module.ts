import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RentRolComponent } from './rent-rol.component';

const routes: Routes = [{ path: '', component: RentRolComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RentRolRoutingModule {}
