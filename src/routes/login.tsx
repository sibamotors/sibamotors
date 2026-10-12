import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoginScreen } from "@/components/login-screen";
import { useLocalSession } from "@/lib/local-session";
import { BootScreen } from "@/components/app-shell";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, ready } = useLocalSession();
  if (!ready) return <BootScreen />;
  if (user) return <Navigate to="/" />;
  return <LoginScreen />;
}
