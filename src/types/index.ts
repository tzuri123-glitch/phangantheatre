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

export type SubscriptionFrequency = 'weekly' | 'biweekly';

export interface Payment {
  id: string;
  studentId: string;
  type: 'חד פעמי' | 'חודשי' | 'סגירת יתרה';
  method: 'מזומן' | 'סקאן';
  date: string;
  amount: number;
  note: string;
  discount?: number; // אחוזי הנחה (0-100)
  subscriptionFrequency?: SubscriptionFrequency; // רלוונטי רק לתשלום חודשי
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

// מחירי חודשי דו-שבועי (שני מפגשים בשבוע) — ברירת המחדל ההיסטורית
export const MONTHLY_PRICE = 4200;
export const SIBLING_MONTHLY_PRICE = 4000;

// מחירי חודשי חד-שבועי (מפגש אחד בשבוע)
export const MONTHLY_WEEKLY_PRICE = 3000;
export const SIBLING_MONTHLY_WEEKLY_PRICE = 2400;

// תשלום חד-פעמי
export const SINGLE_PRICE = 800;
export const SIBLING_SINGLE_PRICE = 650;

export function getMonthlyPrice(isSibling: boolean, frequency: SubscriptionFrequency = 'biweekly'): number {
  if (frequency === 'weekly') {
    return isSibling ? SIBLING_MONTHLY_WEEKLY_PRICE : MONTHLY_WEEKLY_PRICE;
  }
  return isSibling ? SIBLING_MONTHLY_PRICE : MONTHLY_PRICE;
}

export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  biweekly: 'דו-שבועי (פעמיים בשבוע)',
  weekly: 'חד-שבועי (פעם בשבוע)',
};
