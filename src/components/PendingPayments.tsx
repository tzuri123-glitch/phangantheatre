import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatILS } from '@/lib/utils';
import { getPaymentPrice } from '@/types';

interface PendingPayment {
  id: string;
  student_id: string;
  payment_type: string;
  payment_method: string;
  amount: number | null;
  status: string;
  created_at: string;
  payment_proof_url: string | null;
  student_name?: string;
  student_last_name?: string;
  is_sibling?: boolean;
}

interface PendingPaymentsProps {
  onPaymentApproved?: () => void;
}

export default function PendingPayments({ onPaymentApproved }: PendingPaymentsProps) {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [approveDialog, setApproveDialog] = useState<PendingPayment | null>(null);
  const [approveAmount, setApproveAmount] = useState(0);
  const [approveNote, setApproveNote] = useState('');
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!user) return;
    loadPending();

    const channel = supabase
      .channel('pending-payments-admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_payments',
        filter: `admin_user_id=eq.${user.id}`,
      }, (payload) => {
        const newReq = payload.new as any;
        supabase.from('students').select('name, last_name, is_sibling').eq('id', newReq.student_id).single()
          .then(({ data }) => {
            setPending(prev => [{
              ...newReq,
              student_name: data?.name || '',
              student_last_name: data?.last_name || '',
              is_sibling: data?.is_sibling || false,
            }, ...prev]);
            toast.info(`📩 בקשת תשלום חדשה מ-${data?.name || 'תלמיד'} ${data?.last_name || ''}`);
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadPending = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pending_payments')
      .select('*, students(name, last_name, is_sibling)')
      .eq('admin_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = data.map((p: any) => ({
        ...p,
        student_name: p.students?.name || '',
        student_last_name: p.students?.last_name || '',
        is_sibling: p.students?.is_sibling || false,
      }));
      setPending(mapped);
      // Generate signed URLs for proof images
      resolveProofUrls(mapped);
    }
  };

  const extractStoragePath = (url: string | null): string | null => {
    if (!url) return null;
    // Extract the path after /payment-proofs/ from either public or signed URLs
    const match = url.match(/\/payment-proofs\/(.+?)(\?|$)/);
    return match ? match[1] : null;
  };

  const resolveProofUrls = async (items: PendingPayment[]) => {
    const urlMap: Record<string, string> = {};
    for (const item of items) {
      const path = extractStoragePath(item.payment_proof_url);
      if (path) {
        const { data } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(path, 3600);
        if (data?.signedUrl) {
          urlMap[item.id] = data.signedUrl;
        }
      }
    }
    setSignedUrls(prev => ({ ...prev, ...urlMap }));
  };

  const openApproveDialog = (payment: PendingPayment) => {
    const isSib = payment.is_sibling || false;
    const expectedPrice = getPaymentPrice(payment.payment_type, isSib);
    
    setApproveAmount(payment.amount || expectedPrice);
    setApproveNote('');
    setApproveDialog(payment);
  };

  const handleConfirmApprove = async () => {
    if (!user || !approveDialog) return;
    setProcessing(approveDialog.id);

    try {
      await supabase
        .from('pending_payments')
        .update({ status: 'approved', resolved_at: new Date().toISOString(), amount: approveAmount })
        .eq('id', approveDialog.id);

      await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          student_id: approveDialog.student_id,
          payment_type: approveDialog.payment_type,
          payment_method: approveDialog.payment_method,
          payment_date: new Date().toISOString().slice(0, 10),
          amount: approveAmount,
          note: approveNote || 'אושר מבקשת תלמיד',
          payment_proof_url: approveDialog.payment_proof_url || null,
        });

      setPending(prev => prev.filter(p => p.id !== approveDialog.id));
      toast.success(`תשלום של ${approveDialog.student_name} ${approveDialog.student_last_name} אושר — ${formatILS(approveAmount)}`);
      setApproveDialog(null);
      onPaymentApproved?.();
    } catch {
      toast.error('שגיאה באישור תשלום');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (payment: PendingPayment) => {
    if (!user) return;
    setProcessing(payment.id);

    try {
      await supabase
        .from('pending_payments')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', payment.id);

      setPending(prev => prev.filter(p => p.id !== payment.id));
      toast.success('בקשת תשלום נדחתה');
    } catch {
      toast.error('שגיאה בדחיית תשלום');
    } finally {
      setProcessing(null);
    }
  };

  // Calculate balance indicator
  const getBalanceInfo = () => {
    if (!approveDialog) return null;
    const isSib = approveDialog.is_sibling || false;
    const expectedPrice = getPaymentPrice(approveDialog.payment_type, isSib);
    const diff = approveAmount - expectedPrice;
    return { expectedPrice, diff };
  };

  if (pending.length === 0 && !approveDialog) return null;

  const balanceInfo = getBalanceInfo();

  return (
    <>
      {pending.length > 0 && (
        <Card className="p-4 mb-4 border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔔</span>
            <h3 className="font-bold text-foreground">בקשות תשלום ממתינות ({pending.length})</h3>
          </div>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-background rounded-lg p-3 shadow-sm border">
                <div className="flex items-center gap-3">
                  {(signedUrls[p.id] || p.payment_proof_url) && (
                    <img
                      src={signedUrls[p.id] || p.payment_proof_url!}
                      alt="אישור"
                      className="w-12 h-12 rounded object-cover cursor-pointer hover:opacity-80 border"
                      onClick={() => setViewingProofUrl(signedUrls[p.id] || p.payment_proof_url)}
                    />
                  )}
                  <div>
                    <span className="font-medium">{p.student_name} {p.student_last_name}</span>
                    {p.is_sibling && <span className="text-xs text-primary mr-1">👫</span>}
                    <span className="text-muted-foreground text-sm mr-2">
                      – {p.payment_type} ({p.payment_method})
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      {new Date(p.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => openApproveDialog(p)}
                    disabled={processing === p.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    ✅ אשר
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(p)}
                    disabled={processing === p.id}
                  >
                    ❌ דחה
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Approve dialog with amount input */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => { if (!open) setApproveDialog(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>אישור תשלום — {approveDialog?.student_name} {approveDialog?.student_last_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              סוג: <strong>{approveDialog?.payment_type}</strong> | אמצעי: <strong>{approveDialog?.payment_method}</strong>
              {approveDialog?.is_sibling && <span className="text-primary mr-2">👫 תלמיד אח/אחות — מחיר מוזל</span>}
            </div>

            {approveDialog && (signedUrls[approveDialog.id] || approveDialog.payment_proof_url) && (
              <div className="space-y-1">
                <Label>אישור תשלום מהתלמיד:</Label>
                <img
                  src={signedUrls[approveDialog.id] || approveDialog.payment_proof_url!}
                  alt="אישור תשלום"
                  className="w-full max-h-[200px] object-contain rounded-lg border cursor-pointer hover:opacity-80"
                  onClick={() => setViewingProofUrl(signedUrls[approveDialog.id] || approveDialog.payment_proof_url)}
                />
              </div>
            )}
            
            {balanceInfo && (
              <div className="text-sm bg-muted rounded-lg px-3 py-2">
                מחיר צפוי: <strong>{formatILS(balanceInfo.expectedPrice)}</strong>
              </div>
            )}

            <div className="space-y-2">
              <Label>סכום שהתקבל בפועל</Label>
              <Input
                type="number"
                value={approveAmount}
                onChange={(e) => setApproveAmount(Number(e.target.value))}
                min={0}
              />
            </div>

            {balanceInfo && balanceInfo.diff !== 0 && (
              <div className={`text-sm font-medium rounded-lg px-3 py-2 ${
                balanceInfo.diff > 0 
                  ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30' 
                  : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30'
              }`}>
                {balanceInfo.diff > 0 
                  ? `💰 זכות של ${formatILS(balanceInfo.diff)} תירשם לתלמיד`
                  : `⚠️ חוב של ${formatILS(Math.abs(balanceInfo.diff))} יירשם לתלמיד`
                }
              </div>
            )}

            <div className="space-y-2">
              <Label>הערה (אופציונלי)</Label>
              <Input
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="אושר מבקשת תלמיד"
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleConfirmApprove}
                disabled={!!processing}
              >
                ✅ אשר תשלום — {formatILS(approveAmount)}
              </Button>
              <Button
                variant="outline"
                onClick={() => setApproveDialog(null)}
              >
                ביטול
              </Button>
            </div>
          </div>
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
