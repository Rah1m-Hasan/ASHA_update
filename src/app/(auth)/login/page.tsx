import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Choose a workspace · Asha" };

export default function LoginPage() {
  return (
    <AuthLayout
      title="Choose your workspace"
      subtitle="Explore Asha without an account, or connect with your private care-circle link."
      showcase={{
        eyebrow: "Here with you",
        title: "Every small signal, heard.",
        text: "Explore communication tools at your own pace. Use a private access link to connect with your care circle.",
      }}
    >
      <LoginForm />
    </AuthLayout>
  );
}
