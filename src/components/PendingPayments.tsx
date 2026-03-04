import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PendingPayment {
  id: string;
  student_id: string;
  payment_type: string;
  payment_method: string;
  amount: number | null;
  status: string;
  created_at: string;
  student_name?: string;
  student_last_name?: string;
}

export default function PendingPayments() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPending();

    // Realtime listener for new requests
    const channel = supabase
      .channel('pending-payments-admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_payments',
        filter: `admin_user_id=eq.${user.id}`,
      }, (payload) => {
        const newReq = payload.new as any;
        // Load student name
        supabase.from('students').select('name, last_name').eq('id', newReq.student_id).single()
          .then(({ data }) => {
            setPending(prev => [{
              ...newReq,
              student_name: data?.name || '',
              student_last_name: data?.last_name || '',
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
      .select('*, students(name, last_name)')
      .eq('admin_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) {
      setPending(data.map((p: any) => ({
        ...p,
        student_name: p.students?.name || '',
        student_last_name: p.students?.last_name || '',
      })));
    }
  };

  const handleApprove = async (payment: PendingPayment) => {
    if (!user) return;
    setProcessing(payment.id);

    try {
      // Update pending payment status
      await supabase
        .from('pending_payments')
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', payment.id);

      // Create actual payment record
      await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          student_id: payment.student_id,
          payment_type: payment.payment_type,
          payment_method: payment.payment_method,
          payment_date: new Date().toISOString().slice(0, 10),
          amount: payment.amount || 0,
          note: 'אושר מבקשת תלמיד',
        });

      setPending(prev => prev.filter(p => p.id !== payment.id));
      toast.success(`תשלום של ${payment.student_name} ${payment.student_last_name} אושר!`);
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

  if (pending.length === 0) return null;

  return (
    <Card className="p-4 mb-4 border-yellow-300 bg-yellow-50/50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🔔</span>
        <h3 className="font-bold text-foreground">בקשות תשלום ממתינות ({pending.length})</h3>
      </div>
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm border">
            <div>
              <span className="font-medium">{p.student_name} {p.student_last_name}</span>
              <span className="text-muted-foreground text-sm mr-2">
                – {p.payment_type} ({p.payment_method})
              </span>
              <span className="text-xs text-muted-foreground block">
                {new Date(p.created_at).toLocaleString('he-IL')}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(p)}
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
  );
}
