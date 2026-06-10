import { ActivatedRoute } from '@angular/router';

export function vistaEmbebidaEnHub(route: ActivatedRoute): boolean {
  let actual: ActivatedRoute | null = route;
  while (actual) {
    if (actual.snapshot.data['hubEmbebido']) {
      return true;
    }
    actual = actual.parent;
  }
  return false;
}
