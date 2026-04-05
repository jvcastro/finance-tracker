import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  const googleEnabled =
    Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

  return <RegisterForm googleEnabled={googleEnabled} />;
}
