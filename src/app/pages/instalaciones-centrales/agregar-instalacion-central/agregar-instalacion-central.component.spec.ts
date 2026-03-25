import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgregarInstalacionCentralComponent } from './agregar-instalacion-central.component';

describe('AgregarInstalacionCentralComponent', () => {
  let component: AgregarInstalacionCentralComponent;
  let fixture: ComponentFixture<AgregarInstalacionCentralComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarInstalacionCentralComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgregarInstalacionCentralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
