import { AuthForm } from "@/components/auth-form";
export default function Login() {
  return <AuthForm mode="login" localMail={process.env.NODE_ENV === "development" && process.env.SMTP_HOST === "127.0.0.1"} />;
}
