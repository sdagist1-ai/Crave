import { List, Dices, Globe2, User } from "lucide-react";
import { TabId } from "../types";
import { C } from "../constants/theme";

export function BottomTabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: typeof List }[] = [
    { id: "list", label: "List", icon: List },
    { id: "calendar", label: "Passport", icon: Globe2 },
    { id: "spin", label: "Spin", icon: Dices },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="flex-shrink-0 pb-safe bg-white border-t border-slate-100">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
              style={{ color: isActive ? C.rose : C.slate400 }}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
