import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthTransitionService } from './services/auth-transition.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor(
    readonly authTransition: AuthTransitionService,
    _theme: ThemeService,
  ) {}
}
