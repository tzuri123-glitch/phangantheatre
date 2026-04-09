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
    <nav className="sticky z-40 top-[57px] border-b" style={{ background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-none py-1.5">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 rounded-lg flex-shrink-0"
                style={{
                  color: isActive ? 'var(--color-blue)' : 'rgba(255,255,255,0.4)',
                  background: isActive ? 'rgba(100,139,255,0.1)' : 'transparent',
                }}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 right-3 left-3 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--color-blue), var(--color-purple))' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
