// Simple shared-password gate for the admin endpoints.
// The password is sent in the `x-admin-password` header from the admin page.

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const provided = req.headers.get("x-admin-password") || "";
  // constant-ish comparison
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
