import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StageConfigComponent } from './stage-config.component';

describe('StageConfigComponent', () => {
  let component: StageConfigComponent;
  let fixture: ComponentFixture<StageConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StageConfigComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StageConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
