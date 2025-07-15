export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  position: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  tags?: string[];
  status?: string;
}
