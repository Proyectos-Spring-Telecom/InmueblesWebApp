import { inject, Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  UrlTree,
} from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { AuthenticationService } from 'src/app/services/auth.service';

@Injectable({ providedIn: 'root' })
export class NoAuthGuard implements CanActivate {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);

  canActivate(_route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    if (!this.auth.isAuthenticated()) {
      return of(true);
    }

    return this.auth.ensureSessionValid().pipe(
      map((valid) => (valid ? this.router.parseUrl('/monitoreo') : true))
    );
  }
}
