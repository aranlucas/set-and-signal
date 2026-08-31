import { Link, Navigate, lazyRouteComponent } from "@tanstack/react-router";
import { Button } from "./components/ui/button";
import { useStore } from "./store/useStore";

const Admin = lazyRouteComponent(() => import("./views/Admin"));

export function HomeRedirect() {
  return <Navigate to="/home" replace />;
}

export function NotFoundView() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-160 flex-col items-center justify-center gap-4 px-5 text-center">
      <div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-1 text-sm text-foreground/60">The page you requested does not exist.</p>
      </div>
      <Button render={<Link to="/home" />} nativeButton={false} className="w-auto">
        Return home
      </Button>
    </main>
  );
}

export function AdminGate() {
  const user = useStore((state) => state.user) as { admin?: boolean } | null;
  return user?.admin ? <Admin /> : <Navigate to="/home" replace />;
}
