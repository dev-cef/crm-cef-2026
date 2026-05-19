"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = {
  stage: "password" | "totp";
  error?: string;
  // Repopulados no passo 2FA (form é resetado pelo React 19 após a action).
  email?: string;
  password?: string;
};

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "").trim();

  try {
    await signIn("credentials", {
      email,
      password,
      ...(token ? { token } : {}),
      redirectTo: "/dashboard",
    });
    return { stage: "password" };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "2fa_required") {
        return { stage: "totp", email, password };
      }
      if (error.code === "2fa_invalid") {
        return {
          stage: "totp",
          email,
          password,
          error: "Código de verificação inválido.",
        };
      }
      return { stage: "password", error: "E-mail ou senha inválidos." };
    }
    if (error instanceof AuthError) {
      return { stage: "password", error: "Não foi possível entrar." };
    }
    // NEXT_REDIRECT (sucesso) precisa ser repropagado
    throw error;
  }
}
