import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Política de senha — aplicada SEMPRE que uma senha é definida/alterada
// (criação de usuário, reset, seed). Não se aplica ao input de login.
export const passwordSchema = z
  .string()
  .min(12, "A senha deve ter ao menos 12 caracteres")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula")
  .regex(/[0-9]/, "Inclua ao menos um número")
  .regex(/[^A-Za-z0-9]/, "Inclua ao menos um símbolo");

export type Password = z.infer<typeof passwordSchema>;
