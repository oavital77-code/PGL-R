import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <SignIn appearance={{ elements: { formButtonPrimary: "bg-brand hover:bg-brand-600" } }} />;
}
