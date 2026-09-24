import { Dices, Globe, List, User, type LucideIcon } from "lucide-react";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "list", label: "Cravelist", Icon: List },
  { id: "passport", label: "Passport", Icon: Globe },
  { id: "spin", label: "Spin", Icon: Dices },
  { id: "profile", label: "Profile", Icon: User },
];

export function BottomTabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-5 bottom-safe z-40 mx-auto flex h-[68px] max-w-md items-center justify-around rounded-[26px] border border-border bg-surface/90 shadow-float backdrop-blur-xl"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-11 w-[52px] items-center justify-center rounded-2xl transition-colors ${
              isActive ? "bg-accent-soft text-accent" : "text-muted active:bg-subtle"
            }`}
          >
            <Icon size={22} strokeWidth={2} />
          </button>
        );
      })}
    </nav>
  );
}
