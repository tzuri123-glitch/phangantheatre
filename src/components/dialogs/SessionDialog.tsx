import { useState, useEffect } from 'react';
import { Session, Student, CLASS_OPTIONS } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface SessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: Session;
  students: Student[];
  onSave: (session: Omit<Session, 'id'> & { id?: string }) => void;
}

export default function SessionDialog({ open, onOpenChange, session, students, onSave }: SessionDialogProps) {
  const [formData, setFormData] = useState({
    className: CLASS_OPTIONS[0],
    date: new Date().toISOString().split('T')[0],
    trial: false,
    selectedStudents: [] as string[],
  });

  useEffect(() => {
    if (session) {
      setFormData({
        className: session.className as any,
        date: session.date,
        trial: session.trial,
        selectedStudents: session.students.map((s) => s.studentId),
      });
    } else {
      setFormData({
        className: CLASS_OPTIONS[0],
        date: new Date().toISOString().split('T')[0],
        trial: false,
        selectedStudents: [],
      });
    }
  }, [session, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sessionData = {
      className: formData.className,
      date: formData.date,
      trial: formData.trial,
      students: formData.selectedStudents.map((studentId) => ({ studentId, status: '' as const })),
    };
    onSave(session ? { ...sessionData, id: session.id } : sessionData);
  };

  const classStudents = students.filter((s) => s.className === formData.className);

  const toggleStudent = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedStudents: prev.selectedStudents.includes(studentId)
        ? prev.selectedStudents.filter((id) => id !== studentId)
        : [...prev.selectedStudents, studentId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session ? 'ערוך שיעור' : 'צור שיעור'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>חוג *</Label>
              <Select value={formData.className} onValueChange={(v) => setFormData({ ...formData, className: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תאריך *</Label>
              <Input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="trial"
              checked={formData.trial}
              onCheckedChange={(checked) => setFormData({ ...formData, trial: checked as boolean })}
            />
            <Label htmlFor="trial">שיעור ניסיון</Label>
          </div>

          <div>
            <Label>בחר תלמידים</Label>
            <div className="border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
              {classStudents.length === 0 ? (
                <p className="text-muted-foreground text-sm">אין תלמידים בחוג זה</p>
              ) : (
                classStudents.map((student) => (
                  <div key={student.id} className="flex items-center gap-2">
                    <Checkbox
                      id={student.id}
                      checked={formData.selectedStudents.includes(student.id)}
                      onCheckedChange={() => toggleStudent(student.id)}
                    />
                    <Label htmlFor={student.id} className="cursor-pointer">
                      {student.name} {student.lastName}
                    </Label>
                  </div>
                ))
              )}
            </div>
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
