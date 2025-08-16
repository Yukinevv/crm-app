import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailThreadComponent } from './email-thread.component';

describe('EmailThreadComponent', () => {
  let component: EmailThreadComponent;
  let fixture: ComponentFixture<EmailThreadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailThreadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailThreadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
