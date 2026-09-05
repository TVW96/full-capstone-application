import * as z from "zod";

export const SignupFormSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, { error: "Enter your first name." })
      .max(60, { error: "Keep your first name under 60 characters." }),
    lastName: z
      .string()
      .trim()
      .min(1, { error: "Enter your last name." })
      .max(60, { error: "Keep your last name under 60 characters." }),
    mailingAddressLine1: z
      .string()
      .trim()
      .min(3, { error: "Enter the street address or PO box." })
      .max(255, { error: "Keep address line 1 under 255 characters." }),
    mailingAddressLine2: z
      .string()
      .trim()
      .max(255, { error: "Keep address line 2 under 255 characters." }),
    region: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, { error: "Select a country." }),
    username: z
      .string()
      .trim()
      .min(3, { error: "Use at least 3 characters." })
      .max(50, { error: "Keep your username under 50 characters." })
      .regex(/^[a-zA-Z0-9_]+$/, {
        error: "Use only letters, numbers, and underscores.",
      }),
    email: z
      .string()
      .trim()
      .email({ error: "Enter a valid email address." })
      .max(320, { error: "Email must be 320 characters or fewer." }),
    password: z
      .string()
      .min(8, { error: "Use at least 8 characters." })
      .max(128, { error: "Keep your password under 128 characters." })
      .regex(/[a-zA-Z]/, { error: "Add at least one letter." })
      .regex(/[0-9]/, { error: "Add at least one number." })
      .regex(/[^a-zA-Z0-9]/, {
        error: "Add at least one special character.",
      }),
    confirmPassword: z.string(),
    acceptedTerms: z.literal("on", {
      error: "Accept the terms to create an account.",
    }),
  })
  .transform((fields) => ({
    ...fields,
    fullName: `${fields.firstName} ${fields.lastName}`.trim(),
  }))
  .refine((fields) => fields.password === fields.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupField =
  | "firstName"
  | "lastName"
  | "mailingAddressLine1"
  | "mailingAddressLine2"
  | "region"
  | "username"
  | "email"
  | "password"
  | "confirmPassword"
  | "acceptedTerms";

export type SignupFieldValues = {
  firstName: string;
  lastName: string;
  fullName: string;
  mailingAddressLine1: string;
  mailingAddressLine2: string;
  region: string;
  username: string;
  email: string;
};

export type FormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<SignupField, string[]>>;
  message?: string;
  values?: SignupFieldValues;
};

export const initialSignupState: FormState = {
  status: "idle",
};

export const LoginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ error: "Enter a valid email address." })
    .max(320, { error: "Email must be 320 characters or fewer." }),
  password: z
    .string()
    .min(1, { error: "Enter your password." })
    .max(128, { error: "Password must be 128 characters or fewer." }),
  rememberMe: z.boolean(),
});

export type LoginField = "email" | "password";

export type LoginFormState = {
  status: "idle" | "error" | "success";
  errors?: Partial<Record<LoginField, string[]>>;
  message?: string;
  values?: {
    email: string;
    fullName?: string;
    username?: string;
  };
};

export const initialLoginState: LoginFormState = {
  status: "idle",
};
