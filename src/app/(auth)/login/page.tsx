import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Log in · Asha" };

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue with Asha."
      showcase={{
        eyebrow: "Here with you",
        title: "Every small signal, heard.",
        text: "Pick up where you left off — calibrated gestures, confirmed phrases and your care circle are ready.",
      }}
    >
      <LoginForm />
    </AuthLayout>
  );
}
