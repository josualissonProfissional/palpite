import { redirect } from "next/navigation";
import { PasswordScreen } from "@/components/palpite/screens/password-screen";
import { createClient } from "@/lib/supabase/server";

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/recuperar-senha");
  }

  return <PasswordScreen mode="update" />;
}
