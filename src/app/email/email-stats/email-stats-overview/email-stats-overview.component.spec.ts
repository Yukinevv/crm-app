import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailStatsOverviewComponent } from './email-stats-overview.component';

describe('EmailStatsOverviewComponent', () => {
  let component: EmailStatsOverviewComponent;
  let fixture: ComponentFixture<EmailStatsOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailStatsOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailStatsOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
