import { Payment, Student } from '@/types';
import { Button } from '@/components/ui/button';
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

interface PaymentsProps {
  payments: Payment[];
  students: Student[];
  onAddPayment: () => void;
}

export default function Payments({ payments, students, onAddPayment }: PaymentsProps) {
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

  const toggleStudent = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // קיבוץ תשלומים לפי תלמיד
  const studentPayments = students.map((student) => {
    const studentPaymentsList = payments.filter((p) => p.studentId === student.id);
    const totalAmount = studentPaymentsList.reduce((sum, p) => sum + p.amount, 0);
    
    return {
      student,
      payments: studentPaymentsList,
      totalAmount,
    };
  }).filter(sp => sp.payments.length > 0); // רק תלמידים עם תשלומים

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">תשלומים</h2>
        <Button onClick={onAddPayment} className="bg-primary hover:bg-primary-hover">
          ➕ הוסף תשלום
        </Button>
      </div>

      <div className="space-y-4">
        {studentPayments.map(({ student, payments: studentPaymentsList, totalAmount }) => (
          <Card key={student.id} className="overflow-hidden">
            <div
              className="p-4 bg-accent cursor-pointer hover:bg-accent/80 transition-colors flex justify-between items-center"
              onClick={() => toggleStudent(student.id)}
            >
              <div className="flex items-center gap-4">
                <span className="font-semibold text-foreground">
                  {student.name} {student.lastName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {studentPaymentsList.length} תשלומים
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-primary text-lg">
                  {totalAmount.toLocaleString()} ₪
                </span>
                <span className="text-2xl">{expandedStudents[student.id] ? '▴' : '▾'}</span>
              </div>
            </div>

            {expandedStudents[student.id] && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">אמצעי</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">הערה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPaymentsList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>
                        <span className="inline-block px-3 py-1 rounded-full text-sm bg-primary/10 text-primary">
                          {payment.type}
                        </span>
                      </TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell className="font-bold text-primary">
                        {payment.amount.toLocaleString()} ₪
                      </TableCell>
                      <TableCell className="text-muted-foreground">{payment.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
