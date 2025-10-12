import { useEffect, useRef } from 'react';
import { Student, Payment } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Chart from 'chart.js/auto';
import { formatILS } from '@/lib/utils';
import { startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks, format, parseISO, isWithinInterval } from 'date-fns';
import { he } from 'date-fns/locale';

interface DashboardProps {
  students: Student[];
  payments: Payment[];
  onAddStudent: () => void;
}

export default function Dashboard({ students, payments, onAddStudent }: DashboardProps) {
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const weeklyChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartInstance = useRef<Chart | null>(null);
  const weeklyChartInstance = useRef<Chart | null>(null);
  const pieChartInstance = useRef<Chart | null>(null);

  const totalIncome = payments.reduce((sum, p) => sum + p.amount, 0);

  const incomeByMonth = payments.reduce((acc, p) => {
    const monthKey = p.date.slice(0, 7);
    acc[monthKey] = (acc[monthKey] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  // חישוב הכנסות שבועיות - 8 שבועות אחרונים כולל השבוע הנוכחי
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // יום שני
  const eightWeeksAgo = subWeeks(weekStart, 7); // 7 שבועות אחורה + השבוע הנוכחי = 8 שבועות
  
  // יצירת מערך של כל השבועות
  const weeks = eachWeekOfInterval(
    { start: eightWeeksAgo, end: today },
    { weekStartsOn: 1 }
  );
  
  // חישוב הכנסות לכל שבוע
  const weeklyIncomeData = weeks.map(weekStartDate => {
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
    
    const weekIncome = payments.reduce((sum, payment) => {
      const paymentDate = parseISO(payment.date);
      if (isWithinInterval(paymentDate, { start: weekStartDate, end: weekEndDate })) {
        return sum + payment.amount;
      }
      return sum;
    }, 0);
    
    return {
      weekStart: weekStartDate,
      income: weekIncome,
      label: format(weekStartDate, 'dd/MM', { locale: he })
    };
  });

  const incomeByType = payments.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    if (!barChartRef.current || !weeklyChartRef.current || !pieChartRef.current) return;

    // Destroy previous charts
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }
    if (weeklyChartInstance.current) {
      weeklyChartInstance.current.destroy();
    }
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }

    // Bar chart - monthly income
    const barLabels = Object.keys(incomeByMonth).sort();
    const barData = barLabels.map((k) => incomeByMonth[k]);

    barChartInstance.current = new Chart(barChartRef.current, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [
          {
            label: 'הכנסות חודשיות',
            data: barData,
            backgroundColor: 'hsl(188 91% 36%)',
            borderRadius: 8,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    // Weekly chart - weekly income (8 last weeks including current week)
    const weeklyLabels = weeklyIncomeData.map(w => w.label);
    const weeklyData = weeklyIncomeData.map(w => w.income);
    const currentWeekIndex = weeklyIncomeData.length - 1;

    weeklyChartInstance.current = new Chart(weeklyChartRef.current, {
      type: 'line',
      data: {
        labels: weeklyLabels,
        datasets: [
          {
            label: 'הכנסות שבועיות',
            data: weeklyData,
            backgroundColor: 'hsl(142 71% 45% / 0.2)',
            borderColor: 'hsl(142 71% 45%)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: weeklyLabels.map((_, i) => 
              i === currentWeekIndex ? 'hsl(0 84% 60%)' : 'hsl(142 71% 45%)'
            ),
            pointBorderColor: weeklyLabels.map((_, i) => 
              i === currentWeekIndex ? 'hsl(0 84% 60%)' : 'hsl(142 71% 45%)'
            ),
            pointRadius: weeklyLabels.map((_, i) => i === currentWeekIndex ? 6 : 3),
            pointHoverRadius: weeklyLabels.map((_, i) => i === currentWeekIndex ? 8 : 5),
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                const weekData = weeklyIncomeData[index];
                const weekEnd = endOfWeek(weekData.weekStart, { weekStartsOn: 1 });
                return `${format(weekData.weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`;
              },
              label: (context) => {
                return `הכנסה: ${formatILS(context.parsed.y)}`;
              }
            }
          }
        },
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    // Pie chart - income by type
    const pieLabels = Object.keys(incomeByType);
    const pieData = pieLabels.map((k) => incomeByType[k]);
    const colors = [
      'hsl(188 91% 36%)',
      'hsl(188 91% 50%)',
      'hsl(142 71% 45%)',
      'hsl(48 96% 53%)',
      'hsl(0 84% 60%)',
    ];

    pieChartInstance.current = new Chart(pieChartRef.current, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieData,
            backgroundColor: colors.slice(0, pieLabels.length),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
      },
    });

    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
      }
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
    };
  }, [payments]);

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-l from-primary to-magenta bg-clip-text text-transparent">
          ברוך הבא למערכת ניהול החוג! 🎭
        </h2>
        <Button 
          onClick={onAddStudent}
          size="sm"
          className="bg-gradient-to-l from-magenta to-magenta-hover text-white button-hover shadow-lg hover:shadow-xl text-xs sm:text-base px-3 sm:px-4"
        >
          ➕ הוסף תלמיד
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 card-hover backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה"כ תלמידים</h3>
          <p className="text-5xl font-bold bg-gradient-to-l from-primary to-primary-glow bg-clip-text text-transparent">
            {students.length}
          </p>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-magenta/10 via-magenta/5 to-transparent border-magenta/20 card-hover backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">סה"כ הכנסות</h3>
          <p className="text-5xl font-bold bg-gradient-to-l from-magenta to-magenta-glow bg-clip-text text-transparent">
            {formatILS(totalIncome)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 card-hover bg-card/50 backdrop-blur-sm shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
            📊 הכנסות חודשיות
          </h3>
          <canvas ref={barChartRef}></canvas>
        </Card>

        <Card className="p-6 card-hover bg-card/50 backdrop-blur-sm shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
            📈 הכנסות שבועיות (8 שבועות אחרונים)
          </h3>
          <div className="text-sm text-muted-foreground mb-2">
            השבוע הנוכחי מסומן באדום • {format(today, 'dd/MM/yyyy', { locale: he })}
          </div>
          <canvas ref={weeklyChartRef}></canvas>
        </Card>

        <Card className="p-6 card-hover bg-card/50 backdrop-blur-sm shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
            🎯 הכנסות לפי סוג
          </h3>
          <canvas ref={pieChartRef}></canvas>
        </Card>
      </div>
    </div>
  );
}
