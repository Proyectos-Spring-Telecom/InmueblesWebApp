import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgregarDepartamentoComponent } from './agregar-departamento.component';

describe('AgregarDepartamentoComponent', () => {
  let component: AgregarDepartamentoComponent;
  let fixture: ComponentFixture<AgregarDepartamentoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AgregarDepartamentoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgregarDepartamentoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

