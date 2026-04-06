interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'דשבורד',   icon: '◈' },
  { id: 'students',  label: 'תלמידים',  icon: '◉' },
  { id: 'attendance',label: 'נוכחות',   icon: '◎' },
  { id: 'payments',  label: 'תשלומים',  icon: '◆' },
  { id: 'settings',  label: 'הגדרות',   icon: '◇' },
];

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav
      className="sticky z-40 border-b border-border/30"
      style={{
        top: '53px',
        background: 'hsl(220 18% 9% / 0.97)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex justify-center gap-1 sm:gap-2 px-2 py-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm
                transition-all duration-250 whitespace-nowrap flex-shrink-0
                flex items-center gap-1.5
                ${isActive
                  ? 'text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }
              `}
              style={isActive ? {
                background: 'linear-gradient(135deg, hsl(42 88% 46%), hsl(42 88% 38%))',
                boxShadow: '0 0 18px hsl(42 88% 52% / 0.35), 0 2px 8px hsl(0 0% 0% / 0.4)',
              } : {}}
            >
              <span className={`text-xs ${isActive ? 'opacity-90' : 'opacity-50'}`}>{tab.icon}</span>
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 right-3 left-3 h-[2px] rounded-full"
                  style={{ background: 'hsl(42 88% 70% / 0.6)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
