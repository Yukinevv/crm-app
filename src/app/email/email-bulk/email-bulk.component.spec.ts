import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailBulkComponent } from './email-bulk.component';

describe('EmailBulkComponent', () => {
  let component: EmailBulkComponent;
  let fixture: ComponentFixture<EmailBulkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailBulkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailBulkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
