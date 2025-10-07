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

interface PaymentsProps {
  payments: Payment[];
  students: Student[];
  onAddPayment: () => void;
}

export default function Payments({ payments, students, onAddPayment }: PaymentsProps) {
  const getStudentName = (studentId: string) => {
    return students.find((s) => s.id === studentId)?.name || '';
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">תשלומים</h2>
        <Button onClick={onAddPayment} className="bg-primary hover:bg-primary-hover">
          ➕ הוסף תשלום
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תלמיד</TableHead>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">אמצעי</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">הערה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{getStudentName(payment.studentId)}</TableCell>
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
      </Card>
    </div>
  );
}
