export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  companyId?: string;
  position: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  tags?: string[];
  status?: string;
  createdAt: string;
  source?: string;
  region?: string;
  managerId?: string;
  decisionMakerId?: string;
}
