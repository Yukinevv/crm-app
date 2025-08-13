import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailStatsDetailsComponent } from './email-stats-details.component';

describe('EmailStatsDetailsComponent', () => {
  let component: EmailStatsDetailsComponent;
  let fixture: ComponentFixture<EmailStatsDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailStatsDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailStatsDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
