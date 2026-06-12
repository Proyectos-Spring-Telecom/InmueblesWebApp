import { inject, Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { AuthenticationService } from 'src/app/services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    return this.check();
  }

  canActivateChild(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.check();
  }

  private check(): Observable<boolean | UrlTree> {
    if (!this.auth.isAuthenticated()) {
      return of(this.router.createUrlTree(['/login']));
    }

    return this.auth.ensureSessionValid().pipe(
      map((valid) => (valid ? true : this.router.createUrlTree(['/login'])))
    );
  }
}
