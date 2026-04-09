interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'dashboard', label: 'דשבורד' },
  { id: 'students',  label: 'תלמידים' },
  { id: 'attendance', label: 'נוכחות' },
  { id: 'payments',  label: 'תשלומים' },
  { id: 'settings',  label: 'הגדרות' },
];

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="sticky z-40 top-[57px] bg-white/80 backdrop-blur-xl border-b border-border/60">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative px-4 py-2.5 text-sm font-medium whitespace-nowrap
                  transition-all duration-200 rounded-lg flex-shrink-0
                  ${isActive
                    ? 'text-primary bg-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }
                `}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 right-3 left-3 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
