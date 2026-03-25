import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaInstalacionesCentralesComponent } from './lista-instalaciones-centrales.component';

describe('ListaInstalacionesCentralesComponent', () => {
  let component: ListaInstalacionesCentralesComponent;
  let fixture: ComponentFixture<ListaInstalacionesCentralesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaInstalacionesCentralesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaInstalacionesCentralesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
