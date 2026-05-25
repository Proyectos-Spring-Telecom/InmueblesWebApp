import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthenticationService } from 'src/app/services/auth.service';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="branding d-flex align-items-center" style="margin-left: -15px;">
      <a [routerLink]="['/']" class="d-flex align-items-center branding__link">
        <img
          src="assets/images/logos/logo_Spring.png"
          (error)="onLogoError()"
          class="branding__img m-2"
          alt="logo"
        />
      </a>
    </div>
  `,
})
export class BrandingComponent {
  options = this.settings.getOptions();
  readonly defaultLogo = '/assets/images/logos/spring_white.png';
  showImage = this.defaultLogo;

  constructor(private settings: CoreService, private users: AuthenticationService) {
    this.showImage = this.resolveLogoUrl();
  }

  onLogoError(): void {
    if (this.showImage !== this.defaultLogo) {
      this.showImage = this.defaultLogo;
    }
  }

  private resolveLogoUrl(): string {
    const logo = this.users.getUser()?.logo;
    const value = logo == null ? '' : String(logo).trim();
    if (!value || value === 'null' || value === 'undefined') {
      return this.defaultLogo;
    }
    return value;
  }
}
