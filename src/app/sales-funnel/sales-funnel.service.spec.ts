import { TestBed } from '@angular/core/testing';

import { SalesFunnelService } from './sales-funnel.service';

describe('SalesFunnelService', () => {
  let service: SalesFunnelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesFunnelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
