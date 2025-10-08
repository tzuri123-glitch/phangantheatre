import { useState, useEffect } from 'react';
import { Payment, Student, MONTHLY_PRICE, SIBLING_MONTHLY_PRICE, SINGLE_PRICE, TRIAL_PRICE } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: Payment;
  students: Student[];
  onSave: (payment: Omit<Payment, 'id'> & { id?: string }) => void;
}

export default function PaymentDialog({ open, onOpenChange, payment, students, onSave }: PaymentDialogProps) {
  const [formData, setFormData] = useState<{
    studentId: string;
    type: 'ניסיון' | 'חד פעמי' | 'חודשי';
    method: 'מזומן' | 'סקאן';
    date: string;
    amount: number;
    note: string;
    discount: number;
  }>({
    studentId: '',
    type: 'חודשי',
    method: 'מזומן',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    note: '',
    discount: 0,
  });

  useEffect(() => {
    if (payment) {
      setFormData({
        studentId: payment.studentId,
        type: payment.type,
        method: payment.method,
        date: payment.date,
        amount: payment.amount,
        note: payment.note,
        discount: payment.discount || 0,
      });
    } else {
      setFormData({
        studentId: students[0]?.id || '',
        type: 'חודשי',
        method: 'מזומן',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        note: '',
        discount: 0,
      });
    }
  }, [payment, students, open]);

  useEffect(() => {
    const student = students.find((s) => s.id === formData.studentId);
    if (!student) return;

    let baseAmount = 0;
    if (formData.type === 'חודשי') {
      baseAmount = student.isSibling ? SIBLING_MONTHLY_PRICE : MONTHLY_PRICE;
    } else if (formData.type === 'חד פעמי') {
      baseAmount = SINGLE_PRICE;
    } else if (formData.type === 'ניסיון') {
      baseAmount = TRIAL_PRICE;
    }

    const discountAmount = baseAmount * (formData.discount / 100);
    setFormData((prev) => ({ ...prev, amount: baseAmount - discountAmount }));
  }, [formData.type, formData.studentId, formData.discount, students]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(payment ? { ...formData, id: payment.id } : formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{payment ? 'ערוך תשלום' : 'הוסף תשלום'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>תלמיד *</Label>
            <Select value={formData.studentId} onValueChange={(v) => setFormData({ ...formData, studentId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.lastName} - {s.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>סוג תשלום *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ניסיון">ניסיון</SelectItem>
                  <SelectItem value="חד פעמי">חד פעמי</SelectItem>
                  <SelectItem value="חודשי">חודשי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>אמצעי תשלום *</Label>
              <Select value={formData.method} onValueChange={(v) => setFormData({ ...formData, method: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="מזומן">מזומן</SelectItem>
                  <SelectItem value="סקאן">סקאן</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>תאריך *</Label>
              <Input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label>הנחה (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.discount}
                onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label>סכום סופי</Label>
            <Input type="number" value={formData.amount} readOnly className="bg-muted" />
          </div>

          <div>
            <Label>הערה</Label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit">שמור</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
