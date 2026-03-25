import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonitoreoInstalacionComponent } from './monitoreo-instalacion.component';

describe('MonitoreoInstalacionComponent', () => {
  let component: MonitoreoInstalacionComponent;
  let fixture: ComponentFixture<MonitoreoInstalacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonitoreoInstalacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonitoreoInstalacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
