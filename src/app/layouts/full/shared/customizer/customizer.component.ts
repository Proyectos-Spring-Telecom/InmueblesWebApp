import {
  Component,
  Output,
  EventEmitter,
  ViewEncapsulation,
  signal,
} from '@angular/core';
import { AppSettings } from 'src/app/config';
import { CoreService } from 'src/app/services/core.service';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AppThemeMode, ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-customizer',
  imports: [
    TablerIconsModule,
    MaterialModule,
    FormsModule,
    NgScrollbarModule,
  ],
  templateUrl: './customizer.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class CustomizerComponent {
  get options(): AppSettings {
    return this.settings.getOptions();
  }

  @Output() optionsChange = new EventEmitter<AppSettings>();
  hideSingleSelectionIndicator = signal(true);

  constructor(
    private settings: CoreService,
    private themeService: ThemeService,
  ) {}

  setDark() {
    const mode: AppThemeMode =
      this.options.theme === 'light' ? 'light' : 'dark';
    this.themeService.setTheme(mode);
    this.emitOptions();
  }

  setColor(color: string) {
    this.settings.setOptions({ activeTheme: color });
    this.emitOptions();
  }

  setDir(dir: 'ltr' | 'rtl') {
    this.settings.setOptions({ dir: dir });
    this.emitOptions();
  }

  setSidebarCollapsed(sidenavCollapsed: boolean) {
    this.settings.setOptions({ sidenavCollapsed });
    this.emitOptions();
  }

  private emitOptions() {
    this.optionsChange.emit(this.settings.getOptions());
  }
}
