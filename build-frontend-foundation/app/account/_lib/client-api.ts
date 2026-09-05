"use client";

import type {
  AccountActionResult,
  AccountUser,
} from "@/app/account/_lib/account-types";
import { COUNTRY_OPTIONS } from "@/app/account/_lib/countries";
import {
  LoginFormSchema,
  SignupFormSchema,
  type FormState,
  type LoginFormState,
  type SignupFieldValues,
} from "@/app/account/_lib/definitions";
import * as z from "zod";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");
const SESSION_KEY = "manga_session";
export const AUTH_CHANGE_EVENT = "manga-auth-change";

type Session = {
  token: string;
  expiresAt: string;
};

type SessionResponse = {
  user: {
    userId: string;
    email: string;
    username: string;
    fullName: string;
    region: string | null;
    createdAt: string;
  };
  session: Session;
};

type ApiErrorResponse = {
  field?: "email" | "username";
  message?: string | string[];
};

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function saveSession(session: Session, persistent: boolean) {
  const serialized = JSON.stringify(session);
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  (persistent ? localStorage : sessionStorage).setItem(SESSION_KEY, serialized);
  notifyAuthChanged();
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  notifyAuthChanged();
}

export function readSession(): Session | null {
  const serialized =
    sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!serialized) return null;

  try {
    const session = JSON.parse(serialized) as Session;
    if (!session.token || Date.parse(session.expiresAt) <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

async function apiRequest(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

async function authenticatedRequest(
  path: string,
  init: RequestInit,
): Promise<Response | null> {
  const token = readSession()?.token;
  if (!token) return null;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await apiRequest(path, { ...init, headers });
    if (response.status === 401) clearSession();
    return response;
  } catch {
    return null;
  }
}

function getApiMessage(body: ApiErrorResponse, fallback: string) {
  return Array.isArray(body.message)
    ? body.message.join(" ")
    : (body.message ?? fallback);
}

function getSignupValues(formData: FormData): SignupFieldValues {
  const firstName = String(formData.get("firstName") ?? "");
  const lastName = String(formData.get("lastName") ?? "");

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    mailingAddressLine1: String(formData.get("mailingAddressLine1") ?? ""),
    mailingAddressLine2: String(formData.get("mailingAddressLine2") ?? ""),
    region: String(formData.get("region") ?? ""),
    username: String(formData.get("username") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

export async function signup(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = getSignupValues(formData);
  const validation = SignupFormSchema.safeParse({
    ...values,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptedTerms: formData.get("acceptedTerms"),
  });

  if (!validation.success) {
    return {
      status: "error",
      errors: validation.error.flatten().fieldErrors,
      message: "Check the highlighted fields and try again.",
      values,
    };
  }

  let response: Response;
  try {
    response = await apiRequest("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: validation.data.fullName,
        mailingAddressLine1: validation.data.mailingAddressLine1,
        mailingAddressLine2:
          validation.data.mailingAddressLine2 || undefined,
        region: validation.data.region,
        username: validation.data.username,
        email: validation.data.email,
        password: validation.data.password,
      }),
    });
  } catch {
    return {
      status: "error",
      message: "The account service is unavailable. Try again later.",
      values,
    };
  }

  const body = (await response.json().catch(() => ({}))) as
    | SessionResponse
    | ApiErrorResponse;
  if (!response.ok) {
    const error = body as ApiErrorResponse;
    const message = getApiMessage(error, "We could not create your account.");
    return {
      status: "error",
      errors: error.field ? { [error.field]: [message] } : undefined,
      message,
      values,
    };
  }

  const account = body as SessionResponse;
  saveSession(account.session, true);
  return {
    status: "success",
    message: "Your account was created and your session is active.",
    values: {
      ...values,
      fullName: account.user.fullName,
      region: account.user.region ?? values.region,
      username: account.user.username,
      email: account.user.email,
    },
  };
}

export async function login(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const validation = LoginFormSchema.safeParse({
    email,
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });

  if (!validation.success) {
    return {
      status: "error",
      errors: validation.error.flatten().fieldErrors,
      message: "Check the highlighted fields and try again.",
      values: { email },
    };
  }

  let response: Response;
  try {
    response = await apiRequest("/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: validation.data.email,
        password: validation.data.password,
      }),
    });
  } catch {
    return {
      status: "error",
      message: "The sign-in service is unavailable. Try again later.",
      values: { email: validation.data.email },
    };
  }

  const body = (await response.json().catch(() => ({}))) as
    | SessionResponse
    | ApiErrorResponse;
  if (!response.ok) {
    return {
      status: "error",
      message: getApiMessage(
        body as ApiErrorResponse,
        "We could not sign you in.",
      ),
      values: { email: validation.data.email },
    };
  }

  const account = body as SessionResponse;
  saveSession(account.session, validation.data.rememberMe);
  return {
    status: "success",
    message: "Welcome back. Your session is active.",
    values: {
      email: account.user.email,
      fullName: account.user.fullName,
      username: account.user.username,
    },
  };
}

export async function getCurrentAccount(): Promise<AccountUser | null> {
  const response = await authenticatedRequest("/users/me", { method: "GET" });
  if (!response?.ok) return null;
  return (await response.json()) as AccountUser;
}

const countryCodes = new Set(COUNTRY_OPTIONS.map((country) => country.code));
const ProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  username: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores."),
  region: z.string().refine((value) => countryCodes.has(value), {
    message: "Select a country.",
  }),
});
const AddressSchema = z.object({
  addressId: z.string().optional(),
  label: z.string().trim().min(1, "Name this address.").max(60),
  addressLine1: z.string().trim().min(3, "Enter an address.").max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().max(100),
  administrativeArea: z.string().trim().max(100),
  postalCode: z.string().trim().max(24),
  country: z.string().refine((value) => countryCodes.has(value), {
    message: "Select a country.",
  }),
  isDefault: z.boolean(),
});
const BioSchema = z.object({
  bio: z.string().trim().max(600, "Keep your bio under 600 characters."),
});
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

async function resultFromResponse(
  response: Response | null,
  successMessage: string,
): Promise<AccountActionResult> {
  if (!response) {
    return { ok: false, message: "Your session is unavailable. Sign in again." };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorResponse;
    return {
      ok: false,
      message: getApiMessage(body, "We could not save that change."),
    };
  }
  return { ok: true, message: successMessage };
}

export async function updateProfile(
  formData: FormData,
): Promise<AccountActionResult> {
  const validation = ProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    region: formData.get("region"),
  });
  if (!validation.success) {
    return {
      ok: false,
      message: "Check the highlighted details.",
      errors: validation.error.flatten().fieldErrors,
    };
  }
  return resultFromResponse(
    await authenticatedRequest("/users/me", {
      method: "PATCH",
      body: JSON.stringify(validation.data),
    }),
    "Profile updated.",
  );
}

export async function updateBio(bio: string): Promise<AccountActionResult> {
  const validation = BioSchema.safeParse({ bio });
  if (!validation.success) {
    return {
      ok: false,
      message: validation.error.issues[0]?.message ?? "Check your bio.",
    };
  }
  return resultFromResponse(
    await authenticatedRequest("/users/me/bio", {
      method: "PATCH",
      body: JSON.stringify(validation.data),
    }),
    "Bio updated.",
  );
}

export async function saveAddress(
  formData: FormData,
): Promise<AccountActionResult> {
  const validation = AddressSchema.safeParse({
    addressId: String(formData.get("addressId") ?? "") || undefined,
    label: formData.get("label"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    city: formData.get("city"),
    administrativeArea: formData.get("administrativeArea"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
    isDefault: formData.get("isDefault") === "on",
  });
  if (!validation.success) {
    return {
      ok: false,
      message: "Check the highlighted address fields.",
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { addressId, ...address } = validation.data;
  return resultFromResponse(
    await authenticatedRequest(
      addressId ? `/users/me/addresses/${addressId}` : "/users/me/addresses",
      {
        method: addressId ? "PATCH" : "POST",
        body: JSON.stringify(address),
      },
    ),
    addressId ? "Address updated." : "Address added.",
  );
}

export async function deleteAddress(
  addressId: string,
): Promise<AccountActionResult> {
  return resultFromResponse(
    await authenticatedRequest(`/users/me/addresses/${addressId}`, {
      method: "DELETE",
    }),
    "Address removed.",
  );
}

export async function uploadAvatar(
  formData: FormData,
): Promise<AccountActionResult> {
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || avatar.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!AVATAR_TYPES.has(avatar.type)) {
    return { ok: false, message: "Use a JPEG, PNG, WebP, or AVIF image." };
  }
  if (avatar.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: "Avatar images must be 2 MB or smaller." };
  }

  return resultFromResponse(
    await authenticatedRequest("/users/me/avatar", {
      method: "POST",
      body: formData,
    }),
    "Profile photo updated.",
  );
}

export async function removeAvatar(): Promise<AccountActionResult> {
  return resultFromResponse(
    await authenticatedRequest("/users/me/avatar", { method: "DELETE" }),
    "Profile photo removed.",
  );
}

export async function logout(): Promise<void> {
  await authenticatedRequest("/users/me/session", { method: "DELETE" });
  clearSession();
}

export async function deleteAccount(): Promise<AccountActionResult> {
  const response = await authenticatedRequest("/users/me", {
    method: "DELETE",
  });
  const result = await resultFromResponse(response, "Account deleted.");
  if (result.ok) clearSession();
  return result;
}
