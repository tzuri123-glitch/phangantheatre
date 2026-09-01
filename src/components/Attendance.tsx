import { Session, Student, Payment } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPaymentStatusForSession, getStatusColor, getStatusBadge } from '@/lib/paymentStatus';
import { QRCodeSVG } from 'qrcode.react';

interface AttendanceProps {
  sessions: Session[];
  students: Student[];
  payments: Payment[];
  onCreateSession: () => void;
  onEditSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
  onUpdateAttendance: (sessionId: string, studentId: string, status: 'נוכח' | 'לא הגיע' | 'לא באי' | 'עזב') => void;
  onRemoveStudentFromSession: (sessionId: string, studentId: string) => void;
  onAddStudentToSession?: (sessionId: string, studentId: string) => void;
}

export default function Attendance({ sessions, students, payments, onCreateSession, onEditSession, onDeleteSession, onUpdateAttendance, onRemoveStudentFromSession, onAddStudentToSession }: AttendanceProps) {
  const { user } = useAuth();
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [sessionSearchQueries, setSessionSearchQueries] = useState<Record<string, string>>({});
  const [showQrDialog, setShowQrDialog] = useState<string | null>(null);
  const [addToSessionId, setAddToSessionId] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState('');
  const [viewMode, setViewMode] = useState<'sessions' | 'student'>('sessions');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const subscriptions: any[] = [];

  const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  };

  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  const studentCandidates = studentSearch.trim()
    ? sortedStudents.filter(s => `${s.name} ${s.lastName}`.toLowerCase().includes(studentSearch.trim().toLowerCase()))
    : sortedStudents;

  const getStudentAttendanceByMonth = (studentId: string) => {
    const records = sessions
      .filter(sess => sess.students.some(st => st.studentId === studentId))
      .map(sess => ({
        session: sess,
        status: sess.students.find(st => st.studentId === studentId)!.status,
      }))
      .sort((a, b) => b.session.date.localeCompare(a.session.date));

    const groups: Record<string, typeof records> = {};
    records.forEach(r => {
      const key = r.session.date.slice(0, 7);
      (groups[key] ||= []).push(r);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };



  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    return student ? `${student.name} ${student.lastName}` : '';
  };

  const filterStudentRecords = (sessionId: string, sessionStudents: typeof sessions[0]['students']) => {
    const searchQuery = sessionSearchQueries[sessionId] || '';
    if (searchQuery.length < 3) return sessionStudents;
    const query = searchQuery.toLowerCase();
    return sessionStudents.filter((record) => {
      const student = students.find((s) => s.id === record.studentId);
      if (!student) return false;
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-3xl font-bold text-foreground">נוכחות</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => window.open('/print-qr', '_blank')}
            size="sm"
            variant="outline"
            className="text-xs sm:text-base px-3 sm:px-4"
          >
            🖨️ QR להדפסה
          </Button>
          <Button onClick={onCreateSession} size="sm" className="bg-magenta hover:bg-magenta-hover text-magenta-foreground text-xs sm:text-base px-3 sm:px-4">
            ➕ יצירת שיעור
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={viewMode === 'sessions' ? 'default' : 'outline'}
          onClick={() => setViewMode('sessions')}
          className={viewMode === 'sessions' ? 'bg-magenta hover:bg-magenta-hover text-magenta-foreground' : ''}
        >
          לפי שיעורים
        </Button>
        <Button
          size="sm"
          variant={viewMode === 'student' ? 'default' : 'outline'}
          onClick={() => setViewMode('student')}
          className={viewMode === 'student' ? 'bg-magenta hover:bg-magenta-hover text-magenta-foreground' : ''}
        >
          לפי תלמיד
        </Button>
      </div>

      {viewMode === 'student' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <Input
              placeholder="חיפוש תלמיד..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {studentCandidates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">לא נמצאו תלמידים</p>
              )}
              {studentCandidates.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStudentId(s.id); setExpandedMonths({}); }}
                  className={`w-full text-right p-2 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                    selectedStudentId === s.id ? 'bg-magenta/10 border border-magenta/40' : 'hover:bg-accent'
                  }`}
                >
                  <span className="font-medium">{s.name} {s.lastName}</span>
                  <span className="text-xs text-muted-foreground">{s.className}</span>
                </button>
              ))}
            </div>
          </Card>

          {selectedStudentId && (() => {
            const student = students.find(s => s.id === selectedStudentId);
            if (!student) return null;
            const months = getStudentAttendanceByMonth(selectedStudentId);
            const total = months.reduce((sum, [, recs]) => sum + recs.length, 0);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground">
                    {student.name} {student.lastName}
                  </h3>
                  <Badge variant="outline">סה״כ {total} שיעורים</Badge>
                </div>

                {months.length === 0 && (
                  <Card className="p-6 text-center text-muted-foreground">אין רשומות נוכחות לתלמיד זה</Card>
                )}

                {months.map(([monthKey, recs]) => (
                  <Card key={monthKey} className="overflow-hidden">
                    <div
                      className="p-4 bg-accent cursor-pointer hover:bg-accent/80 transition-colors flex justify-between items-center"
                      onClick={() => setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))}
                    >
                      <span className="font-semibold text-foreground">{monthLabel(monthKey)}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{recs.length} שיעורים</Badge>
                        <span className="text-2xl">{expandedMonths[monthKey] ? '▴' : '▾'}</span>
                      </div>
                    </div>
                    {expandedMonths[monthKey] && (
                      <div className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">תאריך</TableHead>
                              <TableHead className="text-right">קבוצה</TableHead>
                              <TableHead className="text-right">סטטוס תשלום</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recs.map(({ session, status }) => {
                              const paymentStatus = getPaymentStatusForSession(
                                student, session, payments, subscriptions, status
                              );
                              const statusBadge = getStatusBadge(paymentStatus);
                              return (
                                <TableRow key={session.id} className={getStatusColor(paymentStatus)}>
                                  <TableCell className="font-medium">{session.date}</TableCell>
                                  <TableCell>{session.className}{session.trial && ' (ניסיון)'}</TableCell>
                                  <TableCell>
                                    {statusBadge && <Badge variant="outline">{statusBadge}</Badge>}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className={`space-y-4 ${viewMode === 'sessions' ? '' : 'hidden'}`}>
        {sessions.map((session) => (

          <Card key={session.id} className="overflow-hidden">
            <div
              className="p-4 bg-accent cursor-pointer hover:bg-accent/80 transition-colors flex justify-between items-center"
              onClick={() => toggleSession(session.id)}
            >
              <span className="font-semibold text-foreground">
                {session.date} – {session.className}
                {session.trial && ' (שיעור ניסיון)'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQrDialog(session.id);
                  }}
                  title="הצג QR לנוכחות"
                >
                  📱
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditSession(session);
                  }}
                >
                  ✏️
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  🗑️
                </Button>
                <span className="text-2xl">{expandedSessions[session.id] ? '▴' : '▾'}</span>
              </div>
            </div>

            {expandedSessions[session.id] && (
              <div className="p-4">
                <div className="mb-4 flex gap-2">
                  <Input
                    placeholder="חיפוש תלמיד..."
                    value={sessionSearchQueries[session.id] || ''}
                    onChange={(e) => setSessionSearchQueries(prev => ({ ...prev, [session.id]: e.target.value }))}
                  />
                  {onAddStudentToSession && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => { setAddSearch(''); setAddToSessionId(session.id); }}
                    >
                      ➕ הוסף תלמיד
                    </Button>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">תלמיד</TableHead>
                      <TableHead className="text-right">כיתה</TableHead>
                      <TableHead className="text-right">תאריך</TableHead>
                      <TableHead className="text-right">סטטוס תשלום</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterStudentRecords(session.id, session.students).map((record) => {
                      const student = students.find(s => s.id === record.studentId);
                      if (!student) return null;
                      
                      const paymentStatus = getPaymentStatusForSession(
                        student,
                        session,
                        payments,
                        subscriptions,
                        record.status
                      );
                      const statusColor = getStatusColor(paymentStatus);
                      const statusBadge = getStatusBadge(paymentStatus);
                      
                      return (
                        <TableRow key={record.studentId} className={statusColor}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {student.profilePhotoUrl ? (
                                <img src={student.profilePhotoUrl} alt={student.name} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                  {student.name.charAt(0)}
                                </div>
                              )}
                              {getStudentName(record.studentId)}
                            </div>
                          </TableCell>
                          <TableCell>{student.className}</TableCell>
                          <TableCell>{session.date}</TableCell>
                          <TableCell>
                            {statusBadge && <Badge variant="outline">{statusBadge}</Badge>}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onRemoveStudentFromSession(session.id, record.studentId)}
                            >
                              🗑️
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add student to session dialog */}
      <Dialog open={!!addToSessionId} onOpenChange={(open) => { if (!open) setAddToSessionId(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת תלמיד לשיעור</DialogTitle>
          </DialogHeader>
          {addToSessionId && (() => {
            const session = sessions.find(s => s.id === addToSessionId);
            if (!session) return null;
            const existing = new Set(session.students.map(st => st.studentId));
            const query = addSearch.trim().toLowerCase();
            const candidates = students
              .filter(s => !existing.has(s.id))
              .filter(s => s.className === session.className || query.length >= 2)
              .filter(s => !query || `${s.name} ${s.lastName}`.toLowerCase().includes(query))
              .sort((a, b) => a.name.localeCompare(b.name, 'he'));
            return (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {session.date} – {session.className}
                </p>
                <Input
                  placeholder="חיפוש תלמיד..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {candidates.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">לא נמצאו תלמידים</p>
                  )}
                  {candidates.map(s => (
                    <button
                      key={s.id}
                      className="w-full text-right p-2 rounded-lg hover:bg-accent flex items-center justify-between gap-2"
                      onClick={() => {
                        onAddStudentToSession?.(session.id, s.id);
                        setAddToSessionId(null);
                      }}
                    >
                      <span className="font-medium">{s.name} {s.lastName}</span>
                      <span className="text-xs text-muted-foreground">{s.className}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* QR Code Dialog */}
      <Dialog open={!!showQrDialog} onOpenChange={(open) => { if (!open) setShowQrDialog(null); }}>
        <DialogContent className="max-w-sm text-center" dir="rtl">
          <DialogHeader>
            <DialogTitle>QR Code לנוכחות</DialogTitle>
          </DialogHeader>
          {showQrDialog && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                התלמידים סורקים את הקוד הזה בכניסה לשיעור
              </p>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG
                  value={`${window.location.origin}/scan/${showQrDialog}`}
                  size={250}
                  level="H"
                />
              </div>
              <p className="text-xs text-muted-foreground break-all">
                {window.location.origin}/scan/{showQrDialog}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}