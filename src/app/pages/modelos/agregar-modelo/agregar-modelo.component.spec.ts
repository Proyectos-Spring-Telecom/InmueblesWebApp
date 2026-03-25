import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgregarModeloComponent } from './agregar-modelo.component';

describe('AgregarModeloComponent', () => {
  let component: AgregarModeloComponent;
  let fixture: ComponentFixture<AgregarModeloComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgregarModeloComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgregarModeloComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
