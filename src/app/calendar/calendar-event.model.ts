export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  participants: string[];
  location?: string;
  virtualLink?: string;
  start: string;
  end: string;
  allDay: boolean;
  reminderMinutesBefore?: number;
}

// Typ do tworzenia nowego wydarzenia (bez id i userId)
export type CreateEvent = Omit<CalendarEvent, 'id' | 'userId'>;

// Typ do aktualizacji wydarzenia (z id, bez userId)
export type UpdateEvent = CreateEvent & { id: string };
