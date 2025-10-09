import { Student, CLASS_OPTIONS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { Users, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface StudentsProps {
  students: Student[];
  payments: { studentId: string; amount: number }[];
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
}

export default function Students({ students, payments, onAddStudent, onEditStudent, onDeleteStudent }: StudentsProps) {
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [classSearchQueries, setClassSearchQueries] = useState<Record<string, string>>({});

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  const getStudentsByClass = (className: string) => {
    return students.filter(s => s.className === className);
  };

  const filterStudents = (className: string, classStudents: Student[]) => {
    const searchQuery = classSearchQueries[className] || '';
    if (searchQuery.length < 3) return classStudents;
    const query = searchQuery.toLowerCase();
    return classStudents.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  const formatWhatsAppNumber = (phone: string) => {
    if (!phone) return '';

    // הסרת תווי כיווניות ותווים שאינם ספרות/+
    const sanitized = phone
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // bidi marks
      .replace(/[\s\-().]/g, '');

    let num = sanitized;

    // נורמליזציה של קידומות
    if (num.startsWith('+')) {
      num = num.slice(1);
    } else if (num.startsWith('00')) {
      num = num.slice(2);
    } else {
      // מספר מקומי ישראלי
      const digits = num.replace(/\D/g, '');
      const local = digits.startsWith('0') ? digits.slice(1) : digits;
      num = '972' + local;
    }

    // תיקון למספרים ישראליים שנשמרו כ+9720...
    if (num.startsWith('9720')) {
      num = '972' + num.slice(4);
    }

    // שמירה על ספרות בלבד
    num = num.replace(/\D/g, '');

    return num;
  };

  const openWhatsApp = (phone: string, studentName: string) => {
    const formattedNumber = formatWhatsAppNumber(phone);
    if (!formattedNumber) {
      toast.error('לא קיים מספר טלפון');
      return;
    }

    const url = `https://wa.me/${formattedNumber}`;
    console.log('[WhatsApp] opening', { phone, formattedNumber, url });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">תלמידים</h2>
        <Button onClick={onAddStudent} className="bg-magenta hover:bg-magenta-hover text-magenta-foreground">
          ➕ הוסף תלמיד
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CLASS_OPTIONS.map((className) => {
          const classStudents = getStudentsByClass(className);
          const studentCount = classStudents.length;
          
          return (
            <Card key={className} className="overflow-hidden">
              <div
                className="p-6 bg-accent cursor-pointer hover:bg-accent/80 transition-colors"
                onClick={() => toggleClass(className)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Users className="text-primary" size={32} />
                  <span className="text-2xl font-bold text-primary">{studentCount}</span>
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-1">{className}</h3>
                <p className="text-sm text-muted-foreground">
                  {studentCount === 0 ? 'אין תלמידים' : `${studentCount} תלמידים`}
                </p>
              </div>

              {expandedClasses[className] && studentCount > 0 && (
                <div className="border-t">
                  <div className="p-4 pb-2">
                    <Input
                      placeholder="חיפוש תלמיד..."
                      value={classSearchQueries[className] || ''}
                      onChange={(e) => setClassSearchQueries(prev => ({ ...prev, [className]: e.target.value }))}
                    />
                  </div>
                  
                  <div className="overflow-x-auto px-4 pb-4">
                    <Table className="min-w-full">
                     <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-right">שם פרטי</TableHead>
                        <TableHead className="text-right">שם משפחה</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">תשלומים</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterStudents(className, classStudents).map((student) => {
                        const studentPaymentCount = payments.filter(p => p.studentId === student.id).length;
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {student.name}
                                {(student.phone || student.parentPhone) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openWhatsApp(student.parentPhone || student.phone, student.name)}
                                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  >
                                    <MessageCircle size={16} />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{student.lastName}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-sm ${
                                  student.status === 'פעיל'
                                    ? 'bg-green-100 text-green-800'
                                    : student.status === 'חדש'
                                    ? 'bg-blue-100 text-blue-800'
                                    : student.status === 'בהקפאה'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {student.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {studentPaymentCount > 0 ? `${studentPaymentCount} תשלומים` : 'אין תשלומים'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onEditStudent(student)}
                                >
                                  ✏️
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (studentPaymentCount > 0) {
                                      toast.error('לא ניתן למחוק תלמיד עם תשלומים קיימים');
                                      return;
                                    }
                                    onDeleteStudent(student.id);
                                  }}
                                >
                                  🗑️
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
