import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImapSettingsComponent } from './imap-settings.component';

describe('ImapSettingsComponent', () => {
  let component: ImapSettingsComponent;
  let fixture: ComponentFixture<ImapSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImapSettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImapSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
