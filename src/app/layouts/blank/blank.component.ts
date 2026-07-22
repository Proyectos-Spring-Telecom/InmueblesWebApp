import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { AppSettings } from 'src/app/config';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-blank',
  templateUrl: './blank.component.html',
  styleUrl: './blank.component.scss',
  imports: [RouterOutlet, MaterialModule, CommonModule],
})
export class BlankComponent {
  private htmlElement!: HTMLHtmlElement;

  options = this.settings.getOptions();

  constructor(
    private settings: CoreService,
    private themeService: ThemeService,
  ) {
    this.htmlElement = document.querySelector('html')!;
    this.options = this.settings.getOptions();
    this.receiveOptions(this.options);
  }

  receiveOptions(options: AppSettings): void {
    this.toggleDarkTheme(options);
    this.toggleColorsTheme(options);
  }

  toggleDarkTheme(options: AppSettings) {
    this.themeService.applyToDocument(
      options.theme === 'light' ? 'light' : 'dark',
    );
  }

  toggleColorsTheme(options: AppSettings) {
    this.htmlElement.classList.forEach((className) => {
      if (className.endsWith('_theme')) {
        this.htmlElement.classList.remove(className);
      }
    });

    this.htmlElement.classList.add(options.activeTheme);
  }
}
