import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatILS } from '@/lib/utils';
import { SINGLE_PRICE, SIBLING_SINGLE_PRICE, getMonthlyPrice, SubscriptionFrequency, FREQUENCY_LABELS } from '@/types';
import { cancelMonthOneTimePendingDebts } from '@/lib/cancelPendingDebts';
import { getCoveredMonthKey, getMonthOptions } from '@/lib/paymentMonth';
import { openWhatsAppWithMessage, formatWhatsAppNumber } from '@/lib/whatsapp';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

interface DebtRow {
  id: string;
  student_id: string;
  payment_type: string;
  payment_method: string;
  amount: number | null;
  status: string;
  created_at: string;
  subscription_frequency?: SubscriptionFrequency | null;
  payment_proof_url?: string | null;
}

interface StudentDebt {
  studentId: string;
  name: string;
  lastName: string;
  className: string;
  isSibling: boolean;
  customSinglePrice?: number;
  parentPhone?: string | null;

  rows: DebtRow[];
  total: number;
}

interface DebtsProps {
  variant?: 'card' | 'tab';
  onPaymentApproved?: () => void;
}

const toDateStr = (iso: string) => iso.slice(0, 10);

export default function Debts({ variant = 'tab', onPaymentApproved }: DebtsProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [studentsMap, setStudentsMap] = useState<Record<string, { name: string; last_name: string | null; class_name: string; is_sibling: boolean; custom_single_price?: number | null }>>({});
  const [sortBy, setSortBy] = useState<'name' | 'amount'>('name');
  const [processing, setProcessing] = useState(false);
  const [viewingProof, setViewingProof] = useState<string | null>(null);

  // dialog state
  const [openStudent, setOpenStudent] = useState<StudentDebt | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [approveType, setApproveType] = useState<'חד פעמי' | 'חודשי'>('חד פעמי');
  const [approveFrequency, setApproveFrequency] = useState<SubscriptionFrequency>('biweekly');
  const [approveDiscount, setApproveDiscount] = useState(0);
  const [approveAmount, setApproveAmount] = useState(0);
  const [approveNote, setApproveNote] = useState('');
  const [approveCoveredMonth, setApproveCoveredMonth] = useState(() => getCoveredMonthKey(new Date().toISOString().slice(0, 10)));
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    load();

    const channel = supabase
      .channel(`debts-${variant}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pending_payments',
        filter: `admin_user_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pending_payments')
      .select('*, students(name, last_name, is_sibling, class_name, custom_single_price, parent_phone, phone)')
      .eq('admin_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    const list = (data || []) as any[];
    const map: Record<string, any> = {};
    list.forEach((p) => {
      if (p.students) map[p.student_id] = p.students;
    });
    setStudentsMap(map);
    setRows(list.map(({ students, ...r }) => r as DebtRow));
  };

  const grouped: StudentDebt[] = useMemo(() => {
    const byStudent: Record<string, StudentDebt> = {};
    rows.forEach((r) => {
      const s = studentsMap[r.student_id];
      if (!byStudent[r.student_id]) {
        byStudent[r.student_id] = {
          studentId: r.student_id,
          name: s?.name || '',
          lastName: s?.last_name || '',
          className: s?.class_name || '',
          isSibling: !!s?.is_sibling,
          customSinglePrice: s?.custom_single_price != null ? Number(s.custom_single_price) : undefined,
          rows: [],
          total: 0,
        };
      }
      byStudent[r.student_id].rows.push(r);
      byStudent[r.student_id].total += Number(r.amount || 0);
    });
    const out = Object.values(byStudent);
    out.forEach((g) => g.rows.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    return out.sort((a, b) =>
      sortBy === 'amount' ? b.total - a.total : a.name.localeCompare(b.name, 'he'),
    );
  }, [rows, studentsMap, sortBy]);

  const totalOpen = grouped.reduce((s, g) => s + g.total, 0);

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300);
    if (error || !data) { toast.error('שגיאה בטעינת אישור התשלום'); return; }
    setViewingProof(data.signedUrl);
  };

  const openDetails = async (g: StudentDebt) => {
    setOpenStudent(g);
    setSelectedIds(g.rows.map((r) => r.id));
    const initType = g.rows.some((r) => r.payment_type === 'חודשי') ? 'חודשי' : 'חד פעמי';
    const initFreq = (g.rows.find((r) => r.subscription_frequency)?.subscription_frequency || 'biweekly') as SubscriptionFrequency;
    setApproveType(initType as 'חד פעמי' | 'חודשי');
    setApproveFrequency(initFreq);
    setApproveDiscount(0);
    setApproveNote('');
    setApproveCoveredMonth(getCoveredMonthKey(new Date().toISOString().slice(0, 10)));
    setApproveAmount(initType === 'חודשי' ? getMonthlyPrice(g.isSibling, initFreq) : g.total);

    // תאריכי השיעורים והקבוצות של החוב
    const { data: att } = await supabase
      .from('attendance')
      .select('sessions(session_date, class_name)')
      .eq('student_id', g.studentId);
    const byDate: Record<string, string> = {};
    (att || []).forEach((a: any) => {
      if (a.sessions?.session_date) byDate[a.sessions.session_date] = a.sessions.class_name;
    });
    setSessionsByDate(byDate);
  };

  const selectedRows = openStudent ? openStudent.rows.filter((r) => selectedIds.includes(r.id)) : [];
  const selectedTotal = selectedRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const buildParentMessage = (g: StudentDebt) => {
    const lines = g.rows.map((r) => {
      const d = toDateStr(r.created_at);
      const [y, m, day] = d.split('-');
      const cls = sessionsByDate[d] ? ` (${sessionsByDate[d]})` : '';
      return `• ${day}/${m}/${y}${cls} — ${formatILS(Number(r.amount || 0))}`;
    });
    return [
      `היי, מצורף פירוט על השיעורים ש${g.name} ${g.lastName} הייתה החודש ועדיין לא הוסדר התשלום.`,
      '',
      'פירוט:',
      ...lines,
      '',
      `סה״כ - ${formatILS(g.total)}`,
      '',
      'תודה מראש',
      'דורון צור.',
      '',
      '(ההודעה נכתבה על ידי בוט)',
    ].join('\n');
  };

  const copyParentMessage = async () => {
    if (!openStudent) return;
    const text = buildParentMessage(openStudent);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('ההודעה הועתקה — אפשר להדביק בווטסאפ');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast.success('ההודעה הועתקה — אפשר להדביק בווטסאפ');
    }
  };


  const basePrice = useMemo(() => {
    if (!openStudent) return 0;
    if (approveType === 'חודשי') return getMonthlyPrice(openStudent.isSibling, approveFrequency);
    return selectedTotal || (openStudent.customSinglePrice ?? (openStudent.isSibling ? SIBLING_SINGLE_PRICE : SINGLE_PRICE));
  }, [openStudent, approveType, approveFrequency, selectedTotal]);

  const expectedAfterDiscount = Math.max(0, basePrice - approveDiscount);
  const diff = approveAmount - expectedAfterDiscount;

  const recalcAmount = (nextType: 'חד פעמי' | 'חודשי', freq: SubscriptionFrequency, discount: number, ids: string[]) => {
    if (!openStudent) return;
    const sum = openStudent.rows.filter((r) => ids.includes(r.id)).reduce((s, r) => s + Number(r.amount || 0), 0);
    const base = nextType === 'חודשי' ? getMonthlyPrice(openStudent.isSibling, freq) : sum;
    setApproveAmount(Math.max(0, Math.round(base - discount)));
  };

  const toggleId = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
    setSelectedIds(next);
    recalcAmount(approveType, approveFrequency, approveDiscount, next);
  };

  const handleApprove = async () => {
    if (!user || !openStudent) return;
    if (selectedIds.length === 0 && approveType === 'חד פעמי') {
      toast.error('בחר לפחות חיוב אחד לאישור');
      return;
    }
    setProcessing(true);
    try {
      const paymentDate = new Date().toISOString().slice(0, 10);
      const method = selectedRows[0]?.payment_method || openStudent.rows[0]?.payment_method || 'מזומן';
      const datesText = selectedRows.map((r) => toDateStr(r.created_at)).join(', ');

      await supabase
        .from('pending_payments')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
        })
        .in('id', selectedIds.length > 0 ? selectedIds : ['00000000-0000-0000-0000-000000000000']);

      await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          student_id: openStudent.studentId,
          payment_type: approveType,
          payment_method: method,
          payment_date: paymentDate,
          amount: approveAmount,
          discount: approveDiscount,
          note: approveNote || (approveType === 'חודשי'
            ? 'אושר מריכוז חובות — מנוי חודשי'
            : `אושר מריכוז חובות${datesText ? ` (${datesText})` : ''}`),
          subscription_frequency: approveType === 'חודשי' ? approveFrequency : null,
          covered_month: approveType === 'חודשי' ? approveCoveredMonth : null,
        } as any);

      let cancelled = 0;
      if (approveType === 'חודשי') {
        cancelled = await cancelMonthOneTimePendingDebts(
          openStudent.studentId,
          paymentDate,
          undefined,
          approveCoveredMonth,
        );
      }

      const extra = cancelled > 0 ? ` (בוטלו ${cancelled} חיובי חד פעמי באותו חודש)` : '';
      toast.success(`תשלום של ${openStudent.name} ${openStudent.lastName} נרשם — ${formatILS(approveAmount)}${extra}`);
      setOpenStudent(null);
      await load();
      onPaymentApproved?.();
    } catch {
      toast.error('שגיאה באישור תשלום');
    } finally {
      setProcessing(false);
    }
  };

  const rejectRow = async (row: DebtRow) => {
    if (!confirm('לבטל את החיוב הזה?')) return;
    setProcessing(true);
    try {
      await supabase
        .from('pending_payments')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', row.id);
      setSelectedIds((prev) => prev.filter((i) => i !== row.id));
      setOpenStudent((prev) => {
        if (!prev) return prev;
        const nextRows = prev.rows.filter((r) => r.id !== row.id);
        if (nextRows.length === 0) return null;
        return { ...prev, rows: nextRows, total: nextRows.reduce((s, r) => s + Number(r.amount || 0), 0) };
      });
      await load();
      toast.success('החיוב בוטל');
    } catch {
      toast.error('שגיאה בביטול החיוב');
    } finally {
      setProcessing(false);
    }
  };

  const listContent = (
    <div className="space-y-2">
      {grouped.map((g) => {
        const dates = g.rows.map((r) => toDateStr(r.created_at));
        const first = dates[0];
        const last = dates[dates.length - 1];
        return (
          <div key={g.studentId} className="flex items-center justify-between bg-background rounded-xl p-3 shadow-sm border gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">
                {g.name} {g.lastName}
                {g.isSibling && <span className="text-xs text-primary mr-1">👫</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {g.className} · {g.rows.length} {g.rows.length === 1 ? 'שיעור' : 'שיעורים'}
                {first && <> · {first === last ? first : `${first} – ${last}`}</>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-bold text-red-600 dark:text-red-400 whitespace-nowrap">{formatILS(g.total)}</span>
              <Button size="sm" onClick={() => openDetails(g)} className="bg-green-600 hover:bg-green-700 text-white">
                ✅ אשר
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {variant === 'card' ? (
        grouped.length > 0 && (
          <Card className="p-4 mb-4 border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h3 className="font-bold text-foreground">חובות פתוחים ({grouped.length})</h3>
              </div>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatILS(totalOpen)}</span>
            </div>
            {listContent}
          </Card>
        )
      ) : (
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">תלמידים בחוב</div>
              <div className="text-2xl font-bold">{grouped.length}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">סה״כ חוב פתוח</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatILS(totalOpen)}</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-bold">ריכוז חובות לפי תלמיד</h3>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'amount')}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">מיון לפי שם</SelectItem>
                  <SelectItem value="amount">מיון לפי גובה חוב</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין חובות פתוחים 🎉</p>
            ) : listContent}
          </Card>
        </div>
      )}

      {/* דיאלוג פירוט ואישור */}
      <Dialog open={!!openStudent} onOpenChange={(open) => { if (!open) setOpenStudent(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              חוב — {openStudent?.name} {openStudent?.lastName}
            </DialogTitle>
          </DialogHeader>
          {openStudent && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {openStudent.className} · סה״כ חוב מרוכז: <strong>{formatILS(openStudent.total)}</strong>
                {openStudent.isSibling && <span className="text-primary mr-2">👫 מחיר אח/אחות</span>}
              </div>

              <div className="space-y-2">
                <Label>פירוט החיובים — סמן מה שולם</Label>
                <div className="space-y-2">
                  {openStudent.rows.map((r) => {
                    const d = toDateStr(r.created_at);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2 border rounded-lg p-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={() => toggleId(r.id)} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{d} · {formatILS(Number(r.amount || 0))}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {r.payment_type} · {r.payment_method}
                              {sessionsByDate[d] ? ` · ${sessionsByDate[d]}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {r.payment_proof_url && (
                            <Button size="sm" variant="outline" onClick={() => openProof(r.payment_proof_url!)}>🖼️</Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => rejectRow(r)} disabled={processing}>✕</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  נבחרו {selectedRows.length} מתוך {openStudent.rows.length} — {formatILS(selectedTotal)}
                </p>
                <Button type="button" variant="outline" className="w-full" onClick={copyParentMessage}>
                  📋 העתק הודעה להורים
                </Button>
              </div>


              <div className="space-y-2">
                <Label>אשר כסוג תשלום</Label>
                <Select value={approveType} onValueChange={(v) => {
                  const t = v as 'חד פעמי' | 'חודשי';
                  setApproveType(t);
                  recalcAmount(t, approveFrequency, approveDiscount, selectedIds);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="חד פעמי">חד פעמי (סכום החיובים שנבחרו)</SelectItem>
                    <SelectItem value="חודשי">חודשי (יבטל חיובי חד-פעמי באותו חודש)</SelectItem>
                  </SelectContent>
                </Select>
                {approveType === 'חודשי' && (
                  <>
                    <Select value={approveFrequency} onValueChange={(v) => {
                      const f = v as SubscriptionFrequency;
                      setApproveFrequency(f);
                      recalcAmount('חודשי', f, approveDiscount, selectedIds);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="biweekly">{FREQUENCY_LABELS.biweekly}</SelectItem>
                        <SelectItem value="weekly">{FREQUENCY_LABELS.weekly}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="space-y-1">
                      <Label>עבור חודש</Label>
                      <Select value={approveCoveredMonth} onValueChange={setApproveCoveredMonth}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {getMonthOptions(new Date().toISOString().slice(0, 10), 6, 12).map((mk) => {
                            const [yy, mm] = mk.split('-');
                            return <SelectItem key={mk} value={mk}>{MONTH_NAMES[Number(mm) - 1]} {yy}</SelectItem>;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className="text-sm bg-muted rounded-lg px-3 py-2 space-y-1">
                <div>לתשלום: <strong>{formatILS(basePrice)}</strong></div>
                {approveDiscount > 0 && (
                  <div className="text-primary">אחרי הנחה של {formatILS(approveDiscount)}: <strong>{formatILS(expectedAfterDiscount)}</strong></div>
                )}
              </div>

              <div className="space-y-2">
                <Label>הנחה (฿)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={approveDiscount}
                    onChange={(e) => {
                      const d = Math.max(0, Number(e.target.value));
                      setApproveDiscount(d);
                      recalcAmount(approveType, approveFrequency, d, selectedIds);
                    }}
                    min={0}
                    step={10}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    setApproveDiscount(basePrice);
                    setApproveAmount(0);
                  }}>
                    חינם (הנחה מלאה)
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>סכום שהתקבל בפועל</Label>
                <Input type="number" value={approveAmount} onChange={(e) => setApproveAmount(Number(e.target.value))} min={0} />
              </div>

              {diff !== 0 && (
                <div className={`text-sm font-medium rounded-lg px-3 py-2 ${
                  diff > 0
                    ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30'
                    : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/30'
                }`}>
                  {diff > 0
                    ? `💰 זכות של ${formatILS(diff)} תירשם לתלמיד`
                    : `⚠️ חוב של ${formatILS(Math.abs(diff))} יישאר לתלמיד`}
                </div>
              )}

              <div className="space-y-2">
                <Label>הערה (אופציונלי)</Label>
                <Input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="אושר מריכוז חובות" />
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleApprove} disabled={processing}>
                  ✅ אשר תשלום — {formatILS(approveAmount)}
                </Button>
                <Button variant="outline" onClick={() => setOpenStudent(null)}>ביטול</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingProof} onOpenChange={(open) => { if (!open) setViewingProof(null); }}>
        <DialogContent className="max-w-2xl p-2" dir="rtl">
          {viewingProof && (
            <img src={viewingProof} alt="אישור תשלום" className="w-full max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
