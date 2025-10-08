import { Payment, Student, CLASS_OPTIONS, Session } from '@/types';
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
import { formatILS } from '@/lib/utils';


interface PaymentsProps {
  payments: Payment[];
  students: Student[];
  sessions: Session[];
  onAddPayment: () => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
}

export default function Payments({ payments, students, sessions, onAddPayment, onEditPayment, onDeletePayment }: PaymentsProps) {
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [classSearchQueries, setClassSearchQueries] = useState<Record<string, string>>({});

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };


  const toggleStudent = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // קיבוץ תלמידים ותשלומים לפי חוג
  const getClassData = (className: string) => {
    const classStudents = students.filter(s => s.className === className);
    
    const studentPayments = classStudents.map((student) => {
      const studentPaymentsList = payments.filter((p) => p.studentId === student.id);
      const totalPaid = studentPaymentsList.reduce((sum, p) => sum + p.amount, 0);
      
      // חישוב מה התלמיד אמור לשלם
      const monthlyPayments = studentPaymentsList.filter(p => p.type === 'חודשי');
      const monthlyPrice = student.isSibling ? 2400 : 2800;
      const expectedMonthlyAmount = monthlyPayments.reduce((sum, p) => {
        const discount = p.discount || 0;
        const priceAfterDiscount = monthlyPrice * (1 - discount / 100);
        return sum + priceAfterDiscount;
      }, 0);
      
      const singlePayments = studentPaymentsList.filter(p => p.type === 'חד פעמי');
      const expectedSingleAmount = singlePayments.reduce((sum, p) => {
        const discount = p.discount || 0;
        const priceAfterDiscount = 800 * (1 - discount / 100);
        return sum + priceAfterDiscount;
      }, 0);
      
      const trialPayments = studentPaymentsList.filter(p => p.type === 'ניסיון');
      const expectedTrialAmount = trialPayments.reduce((sum, p) => {
        const discount = p.discount || 0;
        const priceAfterDiscount = 700 * (1 - discount / 100);
        return sum + priceAfterDiscount;
      }, 0);
      
      const totalExpected = expectedMonthlyAmount + expectedSingleAmount + expectedTrialAmount;
      const balance = totalPaid - totalExpected;
      
      return {
        student,
        payments: studentPaymentsList,
        totalPaid,
        totalExpected,
        balance,
      };
    }).filter(sp => sp.payments.length > 0);

    const totalClassIncome = studentPayments.reduce((sum, sp) => sum + sp.totalPaid, 0);
    
    return { studentPayments, totalClassIncome, studentCount: studentPayments.length };
  };

  const filterStudentPayments = (className: string, studentPayments: ReturnType<typeof getClassData>['studentPayments']) => {
    const searchQuery = classSearchQueries[className] || '';
    if (searchQuery.length < 3) return studentPayments;
    const query = searchQuery.toLowerCase();
    return studentPayments.filter(({ student }) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">תשלומים</h2>
        <Button onClick={onAddPayment} variant="secondary" size="lg" className="shadow-lg">
          ➕ הוסף תשלום
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CLASS_OPTIONS.map((className) => {
          const { studentPayments, totalClassIncome, studentCount } = getClassData(className);
          
          return (
            <Card key={className} className="overflow-hidden">
              <div
                className="p-6 bg-accent cursor-pointer hover:bg-accent/80 transition-colors"
                onClick={() => toggleClass(className)}
              >
                <h3 className="font-semibold text-lg text-foreground mb-1">{className}</h3>
                <p className="text-sm text-muted-foreground">
                  {studentCount === 0 ? 'אין תשלומים' : `${studentCount} תלמידים`}
                </p>
              </div>

              {expandedClasses[className] && studentCount > 0 && (
                <div className="p-4 border-t">
                  <div className="mb-4">
                    <Input
                      placeholder="חיפוש תלמיד..."
                      value={classSearchQueries[className] || ''}
                      onChange={(e) => setClassSearchQueries(prev => ({ ...prev, [className]: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {filterStudentPayments(className, studentPayments).map(({ student, payments: studentPaymentsList, totalPaid, totalExpected, balance }) => {
                      return (
                        <Card key={student.id} className="overflow-hidden">
                          <div
                            className="p-3 bg-muted cursor-pointer hover:bg-muted/80 transition-colors flex justify-between items-center"
                            onClick={() => toggleStudent(student.id)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-sm text-foreground">
                                {student.name} {student.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {studentPaymentsList.length} תשלומים
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-left">
                                <div className="font-bold text-primary text-sm">
                                  {formatILS(totalPaid)}
                                </div>
                                {balance !== 0 && (
                                  <div className={`text-xs font-medium ${balance < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                                    {balance < 0 ? `חוב: ${formatILS(Math.abs(balance))}` : `יתרה: ${formatILS(balance)}`}
                                  </div>
                                )}
                              </div>
                              <span className="text-xl">{expandedStudents[student.id] ? '▴' : '▾'}</span>
                            </div>
                          </div>

                        {expandedStudents[student.id] && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">תאריך</TableHead>
                                <TableHead className="text-right">סוג</TableHead>
                                <TableHead className="text-right">אמצעי</TableHead>
                                <TableHead className="text-right">הנחה</TableHead>
                                <TableHead className="text-right">סכום שהתקבל</TableHead>
                                <TableHead className="text-right">הערה</TableHead>
                                <TableHead className="text-right">פעולות</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {studentPaymentsList.map((payment) => (
                                <TableRow key={payment.id}>
                                  <TableCell className="text-sm">{payment.date}</TableCell>
                                  <TableCell>
                                    <span className="inline-block px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                                      {payment.type}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-sm">{payment.method}</TableCell>
                                  <TableCell>
                                    {payment.discount ? (
                                      <span className="text-yellow-600 font-medium text-sm">{payment.discount}%</span>
                                    ) : (
                                      <span className="text-muted-foreground text-sm">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-bold text-primary text-sm">
                                    {formatILS(payment.amount)}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{payment.note}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => onEditPayment(payment)}
                                      >
                                        ✏️
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => onDeletePayment(payment.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        🗑️
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                        </Card>
                      );
                    })}
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
