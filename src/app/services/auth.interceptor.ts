import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenUser = localStorage.getItem('token');
  const cloneRequest = req.clone({
    setHeaders:{
      Authorization: `Bearer ${tokenUser}`
    }
  })
  return next(cloneRequest);
};
