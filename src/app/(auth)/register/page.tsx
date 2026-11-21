import { AuthForm } from "@/components/auth-form";
export default function Register() {
  return <AuthForm mode="register" localMail={process.env.NODE_ENV === "development" && process.env.SMTP_HOST === "127.0.0.1"} />;
}
