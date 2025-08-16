import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContactActivityComponent } from './contact-activity.component';

describe('ContactActivityComponent', () => {
  let component: ContactActivityComponent;
  let fixture: ComponentFixture<ContactActivityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactActivityComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContactActivityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
