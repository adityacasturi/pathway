const MAX_EMAIL_LENGTH = 320;
const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 1024;

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "dispostable.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

export type PasswordRule = {
  id: "length" | "lowercase" | "uppercase" | "digit" | "symbol" | "email";
  label: string;
  met: boolean;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getEmailValidationError(email: string): string | null {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || cleanEmail.length > MAX_EMAIL_LENGTH) {
    return "Enter a valid email address.";
  }

  const parts = cleanEmail.split("@");
  if (parts.length !== 2) {
    return "Enter a valid email address.";
  }

  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
  ) {
    return "Enter a valid email address.";
  }

  if (
    !domain ||
    domain.length > 253 ||
    !domain.includes(".") ||
    domain.includes("..") ||
    domain === "localhost" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(domain)
  ) {
    return "Enter a valid email address.";
  }

  const labels = domain.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !/^[a-z0-9-]+$/.test(label),
    )
  ) {
    return "Enter a valid email address.";
  }

  const tld = labels.at(-1);
  if (!tld || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return "Enter a valid email address.";
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Use a permanent email address.";
  }

  return null;
}

/**
 * Validation applied specifically at signup. Currently identical to
 * {@link getEmailValidationError}; kept as a distinct seam so signup-only rules
 * (e.g. domain allow/deny lists) can be reintroduced without touching callers.
 */
export function getSignupEmailValidationError(email: string): string | null {
  return getEmailValidationError(email);
}

export function getSignupPasswordRules(password: string, email: string): PasswordRule[] {
  const emailUser = normalizeEmail(email).split("@")[0] ?? "";
  const includesEmailUser =
    emailUser.length >= 4 && password.toLowerCase().includes(emailUser.toLowerCase());

  return [
    { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH },
    { id: "lowercase", label: "One lowercase letter", met: /[a-z]/.test(password) },
    { id: "uppercase", label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { id: "digit", label: "One number", met: /\d/.test(password) },
    { id: "symbol", label: "One symbol", met: /[^A-Za-z0-9]/.test(password) },
    { id: "email", label: "Does not contain your email name", met: !includesEmailUser },
  ];
}

export function getSignupPasswordError(password: string, email: string): string | null {
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return "Enter a valid password.";
  }

  const failedRule = getSignupPasswordRules(password, email).find((rule) => !rule.met);
  if (!failedRule) return null;

  if (failedRule.id === "email") {
    return "Password cannot contain the first part of your email address.";
  }

  return "Password must be at least 8 characters and include lowercase, uppercase, number, and symbol.";
}
