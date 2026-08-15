import { Student } from '@/types';

/**
 * תלמיד זכאי להנחת אחים אם:
 * 1. הוא מסומן כאח/אחות
 * 2. יש תלמיד אחר המקושר אליו (בשני הכיוונים / אח משותף)
 * 3. גיבוי: יש תלמיד אחר עם אותו טלפון הורה
 */
export function hasSiblingDiscount(students: Student[], studentId?: string): boolean {
  if (!studentId) return false;
  const student = students.find(({ id }) => id === studentId);
  if (!student) return false;
  if (student.isSibling) return true;

  const linkedStudentIds = new Set(
    students.flatMap(({ id, siblingId }) => siblingId ? [id, siblingId] : [])
  );
  if (linkedStudentIds.has(student.id)) return true;

  const phone = (student.parentPhone || '').replace(/\D/g, '');
  if (phone.length >= 6) {
    if (students.filter((o) => (o.parentPhone || '').replace(/\D/g, '') === phone).length > 1) return true;
  }

  return false;
}
