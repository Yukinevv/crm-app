export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  companyId?: string;        // powiązanie z innym kontaktem-firmą
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
  managerId?: string;        // przełożony (contact.id)
  decisionMakerId?: string;  // decydent (contact.id)
}
