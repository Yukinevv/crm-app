import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailStatsComponent } from './email-stats.component';

describe('EmailStatsComponent', () => {
  let component: EmailStatsComponent;
  let fixture: ComponentFixture<EmailStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
