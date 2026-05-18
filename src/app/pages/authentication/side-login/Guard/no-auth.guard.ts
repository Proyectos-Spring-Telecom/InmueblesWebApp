import { inject, Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/auth.service';

@Injectable({ providedIn: 'root' })
export class NoAuthGuard implements CanActivate {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);

  canActivate(): boolean {
    if (!this.auth.isAuthenticated()) {
      return true;
    }
    void this.router.navigate(['/starter']);
    return false;
  }
}