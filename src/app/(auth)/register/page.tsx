import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/features/auth/RegisterForm";

export const metadata: Metadata = { title: "Start using Asha · Asha" };

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Start using Asha"
      subtitle="Choose a demo workspace for yourself or someone you care for. No account is needed."
      showcase={{
        eyebrow: "A little support. Your way, every day.",
        title: "A blink, a gesture, a word — becomes a message.",
        text: "Practise comfortable movements and confirmed messages. A caregiver can set up a private care circle from the app.",
      }}
    >
      <RegisterForm />
    </AuthLayout>
  );
}
