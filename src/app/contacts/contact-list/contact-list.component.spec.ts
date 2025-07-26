import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {ContactListComponent} from './contact-list.component';
import {ContactService} from '../contact.service';
import {ImportExportService} from '../import-export.service';
import {AuthService} from '../../auth/auth.service';
import {FormBuilder} from '@angular/forms';
import {of} from 'rxjs';
import {Contact} from '../contact.model';

describe('ContactListComponent', () => {
  let component: ContactListComponent;
  let fixture: ComponentFixture<ContactListComponent>;
  let contactServiceSpy: jasmine.SpyObj<ContactService>;
  let importExportServiceSpy: jasmine.SpyObj<ImportExportService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  const mockContacts: Contact[] = [
    {
      id: '1',
      firstName: 'Jan',
      lastName: 'Kowalski',
      company: 'ABC Sp. z o.o.',
      status: 'Nowy',
      createdAt: '2025-01-01',
      tags: ['vip', 'potencjalny'],
      source: 'LinkedIn',
      region: 'Mazowieckie',
      position: '',
      phone: '',
      email: '',
      address: ''
    },
    {
      id: '2',
      firstName: 'Anna',
      lastName: 'Nowak',
      company: 'XYZ S.A.',
      status: 'Klient',
      createdAt: '2025-01-02',
      tags: ['vip'],
      source: 'Polecenie',
      region: 'Małopolskie',
      position: '',
      phone: '',
      email: '',
      address: ''
    }
  ];

  beforeEach(async () => {
    contactServiceSpy = jasmine.createSpyObj('ContactService', ['getAll', 'delete']);
    importExportServiceSpy = jasmine.createSpyObj('ImportExportService',
      ['exportCSV', 'exportXLSX', 'exportPDF', 'importCSV', 'importXLSX']);
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      user$: of(null)
    });

    contactServiceSpy.getAll.and.returnValue(of(mockContacts));
    contactServiceSpy.delete.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [ContactListComponent],
      providers: [
        FormBuilder,
        {provide: ContactService, useValue: contactServiceSpy},
        {provide: ImportExportService, useValue: importExportServiceSpy},
        {provide: AuthService, useValue: authServiceSpy}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('powinien utworzyć komponent', () => {
    expect(component).toBeTruthy();
  });

  it('powinien załadować kontakty przy inicjalizacji', () => {
    expect(contactServiceSpy.getAll).toHaveBeenCalled();
    expect(component.contacts).toEqual(mockContacts);
    expect(component.filteredContacts).toEqual(mockContacts);
  });

  it('powinien filtrować kontakty po frazie wyszukiwania', fakeAsync(() => {
    component.filterForm.get('q')?.setValue('Jan');
    tick(300); // czekamy na debounceTime

    expect(component.filteredContacts.length).toBe(1);
    expect(component.filteredContacts[0].firstName).toBe('Jan');
  }));

  it('powinien filtrować kontakty po statusie', fakeAsync(() => {
    component.filterForm.get('status')?.setValue('Klient');
    tick(300);

    expect(component.filteredContacts.length).toBe(1);
    expect(component.filteredContacts[0].status).toBe('Klient');
  }));

  it('powinien filtrować kontakty po tagach', fakeAsync(() => {
    component.filterForm.get('tags')?.setValue('vip');
    tick(300);

    expect(component.filteredContacts.length).toBe(2);
  }));

  it('powinien filtrować kontakty po regionie', fakeAsync(() => {
    component.filterForm.get('region')?.setValue('Mazowieckie');
    tick(300);

    expect(component.filteredContacts.length).toBe(1);
    expect(component.filteredContacts[0].region).toBe('Mazowieckie');
  }));

  it('powinien usuwać kontakt', () => {
    spyOn(window, 'confirm').and.returnValue(true);

    component.onDelete('1');

    expect(contactServiceSpy.delete).toHaveBeenCalledWith('1');
    expect(component.contacts.length).toBe(1);
    expect(component.contacts.find(c => c.id === '1')).toBeUndefined();
  });

  it('powinien eksportować kontakty do CSV', () => {
    component.exportAll('csv');

    expect(contactServiceSpy.getAll).toHaveBeenCalled();
    expect(importExportServiceSpy.exportCSV).toHaveBeenCalledWith(mockContacts);
  });

  it('powinien zwracać prawidłową nazwę kontaktu', () => {
    const name = component.getContactName('1');
    expect(name).toBe('Jan Kowalski');
  });

  it('powinien zwracać placeholder dla nieistniejącego kontaktu', () => {
    const name = component.getContactName('999');
    expect(name).toBe('—');
  });

  it('powinien prawidłowo stronicować kontakty', () => {
    component.pageSize = 1;
    component.currentPage = 1;

    expect(component.pagedContacts.length).toBe(1);
    expect(component.pagedContacts[0]).toEqual(mockContacts[0]);

    component.currentPage = 2;
    expect(component.pagedContacts[0]).toEqual(mockContacts[1]);
  });
});
