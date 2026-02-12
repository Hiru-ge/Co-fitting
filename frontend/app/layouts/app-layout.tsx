import { Outlet } from "react-router";
import BottomNav from "~/components/bottom-nav";

export default function AppLayout() {
  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col">
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
