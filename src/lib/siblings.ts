import { Student } from '@/types';

/**
 * תלמיד זכאי להנחת אחים אם:
 * 1. הוא מסומן כאח/אחות
 * 2. יש תלמיד אחר המקושר אליו (בשני הכיוונים / אח משותף)
 * 3. גיבוי: יש תלמיד אחר עם אותו טלפון הורה
 */
export function hasSiblingDiscount(students: Student[], studentId?: string): boolean {
  if (!studentId) return false;
  const s = students.find((x) => x.id === studentId);
  if (!s) return false;
  if (s.isSibling) return true;

  if (
    students.some(
      (o) =>
        o.id !== s.id &&
        (o.siblingId === s.id || o.id === s.siblingId || (!!s.siblingId && o.siblingId === s.siblingId))
    )
  ) {
    return true;
  }

  const phone = (s.parentPhone || '').replace(/\D/g, '');
  if (phone.length >= 6) {
    if (students.filter((o) => (o.parentPhone || '').replace(/\D/g, '') === phone).length > 1) return true;
  }

  return false;
}
