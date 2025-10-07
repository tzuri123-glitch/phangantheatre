export interface Student {
  id: string;
  name: string;
  lastName: string;
  phone: string;
  birthDate: string;
  parentName: string;
  parentPhone: string;
  isSibling: boolean;
  className: string;
  status: 'חדש' | 'פעיל' | 'בהקפאה' | 'בהמתנה';
}

export interface Payment {
  id: string;
  studentId: string;
  type: 'ניסיון' | 'חד פעמי' | 'חודשי';
  method: 'מזומן' | 'סקאן';
  date: string;
  amount: number;
  note: string;
  discount?: number; // אחוזי הנחה (0-100)
}

export interface SessionStudent {
  studentId: string;
  status: 'נוכח' | 'לא הגיע' | 'לא באי';
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

export const MONTHLY_PRICE = 2800;
export const SIBLING_MONTHLY_PRICE = 2400;
export const SINGLE_PRICE = 800;
export const TRIAL_PRICE = 700;
