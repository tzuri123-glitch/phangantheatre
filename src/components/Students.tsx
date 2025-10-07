import { Student, CLASS_OPTIONS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { Users } from 'lucide-react';

interface StudentsProps {
  students: Student[];
  onAddStudent: () => void;
  onEditStudent: (student: Student) => void;
}

export default function Students({ students, onAddStudent, onEditStudent }: StudentsProps) {
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [classSearchQueries, setClassSearchQueries] = useState<Record<string, string>>({});

  const toggleClass = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  const getStudentsByClass = (className: string) => {
    return students.filter(s => s.className === className);
  };

  const filterStudents = (className: string, classStudents: Student[]) => {
    const searchQuery = classSearchQueries[className] || '';
    if (searchQuery.length < 3) return classStudents;
    const query = searchQuery.toLowerCase();
    return classStudents.filter((student) => {
      return (
        student.name.toLowerCase().includes(query) ||
        student.lastName.toLowerCase().includes(query)
      );
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">תלמידים</h2>
        <Button onClick={onAddStudent} className="bg-primary hover:bg-primary-hover">
          ➕ הוסף תלמיד
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CLASS_OPTIONS.map((className) => {
          const classStudents = getStudentsByClass(className);
          const studentCount = classStudents.length;
          
          return (
            <Card key={className} className="overflow-hidden">
              <div
                className="p-6 bg-accent cursor-pointer hover:bg-accent/80 transition-colors"
                onClick={() => toggleClass(className)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Users className="text-primary" size={32} />
                  <span className="text-2xl font-bold text-primary">{studentCount}</span>
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-1">{className}</h3>
                <p className="text-sm text-muted-foreground">
                  {studentCount === 0 ? 'אין תלמידים' : `${studentCount} תלמידים`}
                </p>
              </div>

              {expandedClasses[className] && studentCount > 0 && (
                <div className="p-4 border-t">
                  <div className="mb-4">
                    <Input
                      placeholder="חיפוש תלמיד..."
                      value={classSearchQueries[className] || ''}
                      onChange={(e) => setClassSearchQueries(prev => ({ ...prev, [className]: e.target.value }))}
                    />
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם פרטי</TableHead>
                        <TableHead className="text-right">שם משפחה</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterStudents(className, classStudents).map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="font-medium">{student.lastName}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-sm ${
                                student.status === 'פעיל'
                                  ? 'bg-green-100 text-green-800'
                                  : student.status === 'חדש'
                                  ? 'bg-blue-100 text-blue-800'
                                  : student.status === 'בהקפאה'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {student.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditStudent(student)}
                            >
                              ערוך
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
