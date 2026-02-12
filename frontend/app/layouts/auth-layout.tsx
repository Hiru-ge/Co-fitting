import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="max-w-md mx-auto min-h-dvh flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold font-display-alt text-primary mb-8">
        Roamble
      </h1>
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}
