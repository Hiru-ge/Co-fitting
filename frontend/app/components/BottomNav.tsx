import { NavLink, useLocation } from "react-router";
import { Icon } from "~/components/Icon";

const navItems = [
  { to: "/home", label: "発見", icon: "explore" },
  { to: "/history", label: "履歴", icon: "history" },
  { to: "/profile", label: "マイページ", icon: "person" },
] as const;

export default function BottomNav() {
  // NavLinkのclassName引数から子spanのFILL制御にisActiveを渡しづらいため、
  // アイコン塗りつぶしだけuseLocationで判定する。
  const location = useLocation();

  return (
    <nav
      data-tour="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-white/10"
    >
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map(({ to, label, icon }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 py-2 flex-1 justify-center transition-colors ${
                isActive ? "text-primary" : "text-gray-400"
              }`}
            >
              <Icon name={icon} fill={isActive} className="text-2xl" />
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
