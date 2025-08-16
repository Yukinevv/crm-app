import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailConversationsComponent } from './email-conversations.component';

describe('EmailConversationsComponent', () => {
  let component: EmailConversationsComponent;
  let fixture: ComponentFixture<EmailConversationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailConversationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailConversationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
