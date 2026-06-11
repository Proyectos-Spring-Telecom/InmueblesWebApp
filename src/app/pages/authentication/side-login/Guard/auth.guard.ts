import { inject, Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,   // ← Agrega esto
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthenticationService } from 'src/app/services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);

  // auth.guard.ts
canActivate(): boolean | UrlTree {
  if (this.auth.isAuthenticated()) {
    return true;
  }
  return this.router.createUrlTree(['/login']); // ← Debe retornar UrlTree, no navigate()
}

  canActivateChild(_route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): boolean | UrlTree {
    return this.check();  // ← Se ejecuta para CADA hijo antes de cargar el módulo lazy
  }

  private check(): boolean | UrlTree {
    if (this.auth.isAuthenticated()) {
      return true;
    }
    return this.router.createUrlTree(['/login']);
  }
}