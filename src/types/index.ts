export interface Student {
  id: string;
  name: string;
  lastName: string;
  phone: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  isSibling: boolean;
  siblingId?: string;
  className: string;
  status: 'פעיל' | 'בהקפאה';
  linkedEmail?: string;
  profilePhotoUrl?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  type: 'חד פעמי' | 'חודשי' | 'סגירת יתרה';
  method: 'מזומן' | 'סקאן';
  date: string;
  amount: number;
  note: string;
  discount?: number;
  proofUrl?: string | null;
}

export interface SessionStudent {
  studentId: string;
  status: 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב' | '';
}

export interface Session {
  id: string;
  className: string;
  date: string;
  trial: boolean;
  students: SessionStudent[];
}

export const CLASS_OPTIONS = [
  "תיאטרון 7-9",
  "תיאטרון 10-14", 
  "תיאטרון נוער",
  "תיאטרון מבוגרים"
] as const;

export const MONTHLY_PRICE = 4000;
export const SIBLING_MONTHLY_PRICE = 3200;
export const SINGLE_PRICE = 700;
export const SIBLING_SINGLE_PRICE = 500;
