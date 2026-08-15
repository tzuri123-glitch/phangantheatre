/**
 * תשלום חודשי מכסה חודש קלנדרי שלם — לא 30 יום מתאריך התשלום.
 * חלון התשלום: מה-25 בחודש הקודם עד ה-5 בחודש עצמו.
 * לכן תשלום שבוצע ב-25 לחודש ומעלה מיוחס לחודש הבא.
 */
export const PAYMENT_WINDOW_START_DAY = 25;

/** מחזיר את מפתח החודש (yyyy-MM) שהתשלום מכסה */
export function getCoveredMonthKey(dateISO: string): string {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  let year = y;
  let month = m; // 1-12
  if (d >= PAYMENT_WINDOW_START_DAY) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** מפתח חודש בפורמט MM/yyyy */
export function getCoveredMonthKeySlash(dateISO: string): string {
  const key = getCoveredMonthKey(dateISO);
  const [y, m] = key.split('-');
  return `${m}/${y}`;
}

/** מפתח החודש שאליו שייך תאריך שיעור/יום (תמיד החודש הקלנדרי שלו) */
export function getCalendarMonthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function getCalendarMonthKeySlash(dateISO: string): string {
  const [y, m] = dateISO.slice(0, 10).split('-');
  return `${m}/${y}`;
}

/** טווח תאריכי תשלום שמכסים חודש נתון (yyyy-MM): 25 בחודש הקודם עד 24 בחודש עצמו */
export function getPaymentDateRangeForMonth(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number);
  let prevYear = y;
  let prevMonth = m - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const start = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${PAYMENT_WINDOW_START_DAY}`;
  const end = `${y}-${String(m).padStart(2, '0')}-${PAYMENT_WINDOW_START_DAY - 1}`;
  return { start, end };
}
