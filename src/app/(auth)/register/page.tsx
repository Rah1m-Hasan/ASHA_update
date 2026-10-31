import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/features/auth/RegisterForm";

export const metadata: Metadata = { title: "Create account · Asha" };

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up Asha for yourself or someone you care for."
      showcase={{
        eyebrow: "A little support. A lot more independence.",
        title: "A blink, a gesture, a word — becomes a message.",
        text: "Asha turns the movements someone can comfortably make into confirmed requests, and keeps caregivers in the loop.",
      }}
    >
      <RegisterForm />
    </AuthLayout>
  );
}
