import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Payment, Student } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatILS } from '@/lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  payment_id: string;
  action: string;
  old_data: any;
  new_data: any;
  created_at: string;
}

interface PaymentHistoryProps {
  student: Student;
  payments: Payment[];
  open: boolean;
  onClose: () => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
}

export default function PaymentHistory({ student, payments, open, onClose, onEditPayment, onDeletePayment }: PaymentHistoryProps) {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const studentPayments = payments.filter(p => p.studentId === student.id);

  const loadAuditLog = async () => {
    setLoadingAudit(true);
    const { data } = await supabase
      .from('payment_audit_log')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    
    if (data) setAuditLog(data as AuditEntry[]);
    setLoadingAudit(false);
  };

  useEffect(() => {
    if (open && showAudit) {
      loadAuditLog();
    }
  }, [open, showAudit, student.id]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">הוספה</Badge>;
      case 'UPDATE': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">עריכה</Badge>;
      case 'DELETE': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">מחיקה</Badge>;
      default: return <Badge>{action}</Badge>;
    }
  };

  const formatAuditDetail = (entry: AuditEntry) => {
    if (entry.action === 'INSERT' && entry.new_data) {
      return `${entry.new_data.payment_type} — ${formatILS(entry.new_data.amount)}`;
    }
    if (entry.action === 'DELETE' && entry.old_data) {
      return `${entry.old_data.payment_type} — ${formatILS(entry.old_data.amount)}`;
    }
    if (entry.action === 'UPDATE' && entry.old_data && entry.new_data) {
      const changes: string[] = [];
      if (entry.old_data.amount !== entry.new_data.amount) {
        changes.push(`סכום: ${formatILS(entry.old_data.amount)} → ${formatILS(entry.new_data.amount)}`);
      }
      if (entry.old_data.payment_type !== entry.new_data.payment_type) {
        changes.push(`סוג: ${entry.old_data.payment_type} → ${entry.new_data.payment_type}`);
      }
      if (entry.old_data.note !== entry.new_data.note) {
        changes.push(`הערה: "${entry.old_data.note || '-'}" → "${entry.new_data.note || '-'}"`);
      }
      return changes.length > 0 ? changes.join(' | ') : 'ללא שינוי';
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setShowAudit(false); } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>💳 תשלומים — {student.name} {student.lastName}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={!showAudit ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAudit(false)}
          >
            תשלומים ({studentPayments.length})
          </Button>
          <Button
            variant={showAudit ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setShowAudit(true); loadAuditLog(); }}
          >
            📋 יומן שינויים
          </Button>
        </div>

        {!showAudit ? (
          <>
            {studentPayments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">אין תשלומים לתלמיד זה</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">אמצעי</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">הערה</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">{payment.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{payment.method}</TableCell>
                      <TableCell className="font-bold text-primary">{formatILS(payment.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{payment.note || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEditPayment(payment)}>✏️</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`למחוק תשלום של ${formatILS(payment.amount)} מתאריך ${payment.date}? פעולה זו תירשם ביומן השינויים.`)) {
                                onDeletePayment(payment.id);
                              }
                            }}
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
          </>
        ) : (
          <>
            {loadingAudit ? (
              <div className="text-center text-muted-foreground py-8">טוען יומן...</div>
            ) : auditLog.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">אין רשומות ביומן</div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">🔒 יומן זה לא ניתן לעריכה או מחיקה — נועד לשקיפות ושמירת היסטוריה</p>
                {auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg text-sm">
                    <div className="shrink-0 mt-0.5">
                      {getActionBadge(entry.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{formatAuditDetail(entry)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
