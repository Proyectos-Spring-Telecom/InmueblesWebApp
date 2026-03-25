import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthenticationService } from 'src/app/services/auth.service';
import { CoreService } from 'src/app/services/core.service';

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="branding d-none d-lg-flex align-items-center">
      <a [routerLink]="['/']" class="d-flex">
        <img
          [src]="showImage"
          class="align-middle widthImage m-2"
          alt="logo"
        />
      </a>
    </div>
  `,
})
export class BrandingComponent {
  options = this.settings.getOptions();
  public showImage: any;

  constructor(private settings: CoreService, private users: AuthenticationService,) {
    const user = this.users.getUser();
    if(user?.logo == 'null' || user?.logo == null){
      this.showImage = '/assets/images/logos/spring_white.png'
    } else{
      this.showImage = user?.logo
    }
  }
}
