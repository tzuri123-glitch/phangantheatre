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
import { toast } from 'sonner';

interface AuditEntry {
  id: string;
  payment_id: string;
  action: string;
  old_data: any;
  new_data: any;
  created_at: string;
}

interface PendingPaymentRequest {
  id: string;
  payment_type: string;
  payment_method: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface PaymentHistoryProps {
  student: Student;
  payments: Payment[];
  open: boolean;
  onClose: () => void;
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
}

type HistoryTab = 'payments' | 'requests' | 'audit';

export default function PaymentHistory({ student, payments, open, onClose, onEditPayment, onDeletePayment }: PaymentHistoryProps) {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingPaymentRequest[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>('payments');
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);
  const [signedProofUrls, setSignedProofUrls] = useState<Record<string, string>>({});

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

  const loadPendingRequests = async () => {
    setLoadingRequests(true);
    const { data } = await supabase
      .from('pending_payments')
      .select('id, payment_type, payment_method, status, created_at, resolved_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (data) setPendingRequests(data as PendingPaymentRequest[]);
    setLoadingRequests(false);
  };

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'audit') loadAuditLog();
    if (activeTab === 'requests') loadPendingRequests();
    // Resolve signed URLs for proof images on payments tab
    if (activeTab === 'payments') {
      resolvePaymentProofUrls();
    }
  }, [open, activeTab, student.id]);

  const resolvePaymentProofUrls = async () => {
    const urlMap: Record<string, string> = {};
    for (const payment of studentPayments) {
      if (payment.proofUrl) {
        const match = payment.proofUrl.match(/\/payment-proofs\/(.+?)(\?|$)/);
        if (match) {
          const { data } = await supabase.storage
            .from('payment-proofs')
            .createSignedUrl(match[1], 3600);
          if (data?.signedUrl) {
            urlMap[payment.id] = data.signedUrl;
          }
        }
      }
    }
    setSignedProofUrls(urlMap);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': return <Badge>הוספה</Badge>;
      case 'UPDATE': return <Badge variant="secondary">עריכה</Badge>;
      case 'DELETE': return <Badge variant="destructive">מחיקה</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">ממתין לאישור</Badge>;
      case 'approved':
        return <Badge>אושר</Badge>;
      case 'rejected':
        return <Badge variant="destructive">נדחה</Badge>;
      case 'deleted_by_admin':
        return <Badge variant="outline">נמחק ע"י מנהל</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  const handleDeleteRequest = async (request: PendingPaymentRequest) => {
    if (!confirm('למחוק את בקשת התשלום הזו? הפעולה לא מוחקת תשלום מאושר.')) return;

    setDeletingRequestId(request.id);
    const resolvedAt = new Date().toISOString();

    const { error } = await supabase
      .from('pending_payments')
      .update({ status: 'deleted_by_admin', resolved_at: resolvedAt })
      .eq('id', request.id)
      .eq('student_id', student.id);

    if (error) {
      toast.error('שגיאה במחיקת בקשה');
      setDeletingRequestId(null);
      return;
    }

    setPendingRequests(prev => prev.map(p => p.id === request.id ? { ...p, status: 'deleted_by_admin', resolved_at: resolvedAt } : p));
    toast.success('הבקשה הוסרה מתצוגת התלמיד');
    setDeletingRequestId(null);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setActiveTab('payments'); } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>💳 תשלומים — {student.name} {student.lastName}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === 'payments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('payments')}
          >
            תשלומים ({studentPayments.length})
          </Button>
          <Button
            variant={activeTab === 'requests' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('requests')}
          >
            בקשות תשלום
          </Button>
          <Button
            variant={activeTab === 'audit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('audit')}
          >
            📋 יומן שינויים
          </Button>
        </div>

        {activeTab === 'payments' && (
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
                    <TableHead className="text-right">אישור</TableHead>
                    <TableHead className="text-right">הערה</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPayments.map((payment) => {
                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="text-sm">{payment.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{payment.method}</TableCell>
                        <TableCell className="font-bold text-primary">{formatILS(payment.amount)}</TableCell>
                        <TableCell>
                        {(signedProofUrls[payment.id] || payment.proofUrl) ? (
                            <img
                              src={signedProofUrls[payment.id] || payment.proofUrl!}
                              alt="אישור"
                              className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80"
                              onClick={() => setViewingProofUrl(signedProofUrls[payment.id] || payment.proofUrl!)}
                            />
                          ) : '-'}
                        </TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <>
            <p className="text-xs text-muted-foreground mb-3">מחיקת בקשה כאן מסירה אותה מהאזור האישי של התלמיד — בלי למחוק תשלום מאושר.</p>
            {loadingRequests ? (
              <div className="text-center text-muted-foreground py-8">טוען בקשות...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">אין בקשות תשלום לתלמיד זה</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך בקשה</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">אמצעי</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}</TableCell>
                      <TableCell>{request.payment_type}</TableCell>
                      <TableCell>{request.payment_method}</TableCell>
                      <TableCell>{getRequestStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.status === 'deleted_by_admin' ? (
                          <span className="text-xs text-muted-foreground">נמחק</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteRequest(request)}
                            disabled={deletingRequestId === request.id}
                          >
                            מחק בקשה
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {activeTab === 'audit' && (
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

    {/* Payment proof viewer */}
    <Dialog open={!!viewingProofUrl} onOpenChange={(open) => { if (!open) setViewingProofUrl(null); }}>
      <DialogContent className="max-w-md p-2" dir="rtl">
        {viewingProofUrl && (
          <img
            src={viewingProofUrl}
            alt="אישור תשלום"
            className="w-full max-h-[70vh] object-contain rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

