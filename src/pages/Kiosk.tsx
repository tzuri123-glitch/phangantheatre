import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

type Student = {
  id: string;
  name: string;
  last_name: string | null;
  profile_photo_url: string | null;
  status?: string | null;
};

type ArrivedRow = { student_id: string; created_at: string };

type Confirmation = {
  name: string;
  photo: string | null;
  already: boolean;
  createdDebt: boolean;
  debtAmount: number;
} | null;

const STORAGE_KEY = 'kiosk_session_v1';

export default function Kiosk() {
  const [stage, setStage] = useState<'pin' | 'class' | 'students'>('pin');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [currentClass, setCurrentClass] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [arrived, setArrived] = useState<ArrivedRow[]>([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [today, setToday] = useState('');

  // Restore session
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.pin && s.admin_user_id) {
          setSavedPin(s.pin);
          setAdminUserId(s.admin_user_id);
          setStage('class');
        }
      } catch {/* ignore */}
    }
  }, []);

  const loadData = useCallback(async (className: string | null) => {
    if (!savedPin || !adminUserId) return;
    const { data, error } = await supabase.functions.invoke('kiosk-get-data', {
      body: { pin: savedPin, admin_user_id: adminUserId, class_name: className },
    });
    if (error || data?.error) {
      if (data?.error === 'auth') {
        localStorage.removeItem(STORAGE_KEY);
        setStage('pin');
        setSavedPin(null);
        setAdminUserId(null);
        toast.error('הסשן פג. הזן PIN מחדש.');
      }
      return;
    }
    setClasses(data.classes || []);
    setStudents(data.students || []);
    setArrived(data.arrivedToday || []);
    setToday(data.today || '');
  }, [savedPin, adminUserId]);

  // Load classes on class stage
  useEffect(() => {
    if (stage === 'class') loadData(null);
  }, [stage, loadData]);

  // Load students when selecting class + poll for arrivals every 15s
  useEffect(() => {
    if (stage !== 'students' || !currentClass) return;
    loadData(currentClass);
    const t = setInterval(() => loadData(currentClass), 15000);
    return () => clearInterval(t);
  }, [stage, currentClass, loadData]);

  const handleVerify = async () => {
    if (!pin.trim()) return;
    setVerifying(true);
    setPinError('');
    const { data, error } = await supabase.functions.invoke('kiosk-verify-pin', {
      body: { pin: pin.trim() },
    });
    setVerifying(false);
    if (error || !data?.ok) {
      setPinError('קוד שגוי');
      setPin('');
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pin: pin.trim(), admin_user_id: data.admin_user_id }));
    setSavedPin(pin.trim());
    setAdminUserId(data.admin_user_id);
    setPin('');
    setStage('class');
  };

  const handleMark = async (s: Student) => {
    if (!savedPin || !adminUserId || !currentClass) return;
    setSubmitting(s.id);
    const { data, error } = await supabase.functions.invoke('kiosk-mark-attendance', {
      body: { pin: savedPin, admin_user_id: adminUserId, class_name: currentClass, student_id: s.id },
    });
    setSubmitting(null);
    if (error || !data?.ok) {
      toast.error('שגיאה ברישום נוכחות');
      return;
    }
    setConfirmation({
      name: `${s.name} ${s.last_name || ''}`.trim(),
      photo: s.profile_photo_url,
      already: !!data.already,
      createdDebt: !!data.createdDebt,
      debtAmount: data.debtAmount || 0,
    });
    // refresh arrivals
    loadData(currentClass);
    setTimeout(() => setConfirmation(null), 800);
  };

  const arrivedSet = new Set(arrived.map(a => a.student_id));
  const arrivedStudents = students.filter(s => arrivedSet.has(s.id));
  const filtered = students.filter(s => {
    if (!search.trim()) return true;
    const full = `${s.name} ${s.last_name || ''}`.toLowerCase();
    return full.includes(search.trim().toLowerCase());
  });

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedPin(null);
    setAdminUserId(null);
    setCurrentClass(null);
    setStudents([]);
    setArrived([]);
    setStage('pin');
  };

  // ===== PIN STAGE =====
  if (stage === 'pin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/10 to-background p-6" dir="rtl">
        <Card className="w-full max-w-md p-8 text-center space-y-6">
          <img src={logo} alt="לוגו" className="h-20 mx-auto" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">קיוסק נוכחות</h1>
            <p className="text-muted-foreground mt-2">הזן קוד גישה</p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
            placeholder="••••"
            className="text-center text-3xl h-16 tracking-[0.5em]"
          />
          {pinError && <p className="text-destructive font-semibold">{pinError}</p>}
          <Button onClick={handleVerify} disabled={verifying || !pin.trim()} className="w-full h-14 text-lg">
            {verifying ? 'בודק...' : 'כניסה'}
          </Button>
        </Card>
      </div>
    );
  }

  // ===== CLASS STAGE =====
  if (stage === 'class') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background p-6 flex flex-col" dir="rtl">
        <div className="flex justify-between items-center mb-8 max-w-5xl mx-auto w-full">
          <img src={logo} alt="לוגו" className="h-14" />
          <Button variant="ghost" onClick={handleLogout}>יציאה</Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-3xl p-8 space-y-6">
            <h1 className="text-3xl font-bold text-center text-foreground">בחר/י קבוצה</h1>
            {classes.length === 0 ? (
              <p className="text-muted-foreground text-center">טוען...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classes.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCurrentClass(c); setStage('students'); }}
                    className="p-8 rounded-2xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 hover:border-primary transition-all text-2xl font-bold text-foreground"
                  >
                    🎭 {c}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ===== STUDENTS STAGE =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background p-4 sm:p-6" dir="rtl">
      {/* Confirmation overlay */}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
          <Card className={`max-w-lg w-[90%] p-10 text-center space-y-4 border-4 ${confirmation.already ? 'border-primary' : 'border-green-500'}`}>
            {confirmation.photo ? (
              <img src={confirmation.photo} alt="" className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-current" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-primary/20 mx-auto flex items-center justify-center text-5xl">
                {confirmation.name.charAt(0)}
              </div>
            )}
            <div className={`text-7xl ${confirmation.already ? 'text-primary' : 'text-green-500'}`}>
              {confirmation.already ? '👋' : '✓'}
            </div>
            <h2 className="text-3xl font-bold text-foreground">{confirmation.name}</h2>
            <p className={`text-xl font-semibold ${confirmation.already ? 'text-primary' : 'text-green-600'}`}>
              {confirmation.already ? 'כבר נרשמת היום' : 'נוכחות נרשמה!'}
            </p>
            {confirmation.createdDebt && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-700 dark:text-amber-400 font-semibold">
                נוצר חוב חד-פעמי: ฿{confirmation.debtAmount}
              </div>
            )}
          </Card>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-12" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{currentClass}</h1>
              <p className="text-xs text-muted-foreground">{today}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setCurrentClass(null); setStage('class'); }}>החלף קבוצה</Button>
            <Button variant="ghost" onClick={handleLogout}>יציאה</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Students grid */}
          <Card className="p-4">
            <Input
              placeholder="חיפוש לפי שם..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-4 h-12 text-lg"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(s => {
                const isHere = arrivedSet.has(s.id);
                const isLoading = submitting === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleMark(s)}
                    disabled={isLoading}
                    className={`relative p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 active:scale-95 ${
                      isHere
                        ? 'bg-green-500/10 border-green-500/50'
                        : 'bg-card hover:bg-accent border-border hover:border-primary'
                    } ${isLoading ? 'opacity-60' : ''}`}
                  >
                    {isHere && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">✓</div>
                    )}
                    {s.profile_photo_url ? (
                      <img src={s.profile_photo_url} alt="" className="w-20 h-20 rounded-full object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <div className="text-sm font-semibold text-foreground text-center leading-tight">
                      {s.name} {s.last_name || ''}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">לא נמצאו תלמידים</p>
              )}
            </div>
          </Card>

          {/* Side: arrived today */}
          <Card className="p-4 h-fit lg:sticky lg:top-4">
            <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="text-green-500">✓</span>
              הגיעו היום ({arrivedStudents.length})
            </h3>
            {arrivedStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">עדיין אף אחד לא נרשם</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {arrivedStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5">
                    {s.profile_photo_url ? (
                      <img src={s.profile_photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-foreground text-sm">{s.name} {s.last_name || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
