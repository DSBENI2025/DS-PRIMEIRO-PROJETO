const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "MERCADO_PAGO_PLAN_ID",
  "TOKEN_ENCRYPTION_KEY",
  "RATE_LIMIT_SECRET",
];

const missing = required.filter(
  (name) => !process.env[name] || !process.env[name].trim()
);

if (missing.length > 0) {
  console.error(
    "Missing required environment variables: " + missing.join(", ")
  );
  process.exit(1);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL;

try {
  const parsed = new URL(appUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("invalid protocol");
  }
} catch {
  console.error("NEXT_PUBLIC_APP_URL must be an absolute http(s) URL.");
  process.exit(1);
}

if (process.env.TOKEN_ENCRYPTION_KEY.length < 32) {
  console.error("TOKEN_ENCRYPTION_KEY must have at least 32 characters.");
  process.exit(1);
}

if (process.env.RATE_LIMIT_SECRET.length < 32) {
  console.error("RATE_LIMIT_SECRET must have at least 32 characters.");
  process.exit(1);
}

console.log("Environment validation passed.");
