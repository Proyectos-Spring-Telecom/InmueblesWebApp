import { Component } from '@angular/core';
import { routeAnimation } from 'src/app/pipe/module-open.animation';

@Component({
  selector: 'app-rent-rol',
  templateUrl: './rent-rol.component.html',
  styleUrl: './rent-rol.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class RentRolComponent {}
