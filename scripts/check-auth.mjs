// Integration test: only run against a local app configured to send mail to Mailpit.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import pg from "pg";

const base = process.env.BETTER_AUTH_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname));
assert.equal(process.env.SMTP_HOST, "127.0.0.1", "Use local Mailpit only");
assert.equal(process.env.SMTP_PORT, "1025");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const email = `review-${crypto.randomUUID()}@usth.edu.vn`;
const password = crypto.randomUUID() + "-auth-review";
async function api(path, payload, cookie, method = "POST") {
  const response = await fetch(base + path, {
    method, headers: { "content-type": "application/json", origin: base, ...(cookie ? { cookie } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload), redirect: "manual",
  });
  const data = await response.json();
  const cookies = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  return { status: response.status, data, cookie: cookies };
}
try {
  const denied = await api("/api/auth/sign-up/email", { name: "Invalid", email: `outside-${crypto.randomUUID()}@example.com`, password });
  assert.equal(denied.status, 400, JSON.stringify(denied.data));
  const registered = await api("/api/auth/sign-up/email", { name: "Auth review", email, password, role: "MANAGER", emailVerified: true, callbackURL: "/login" });
  assert.equal(registered.status, 200, JSON.stringify(registered.data));
  const user = (await db.query('SELECT * FROM "User" WHERE email=$1', [email])).rows[0];
  assert.equal(user.role, "REPORTER"); assert.equal(user.emailVerified, false);
  const account = (await db.query('SELECT password FROM "Account" WHERE "userId"=$1', [user.id])).rows[0];
  assert.ok(account.password && account.password !== password);
  assert.equal((await api("/api/me", undefined, undefined, "GET")).status, 401);
  assert.equal((await api("/api/auth/sign-in/email", { email, password })).status, 403);

  const inbox = await (await fetch("http://127.0.0.1:8025/api/v1/messages")).json();
  const message = inbox.messages.find(message => message.To.some(to => to.Address === email));
  assert.ok(message, "Verification email must arrive in Mailpit");
  const contents = await (await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
  const url = contents.Text.match(/https?:\/\/[^\s]+/)[0];
  assert.equal(new URL(url).origin, base);
  const verification = await fetch(url, { redirect: "manual" });
  assert.equal(verification.status, 302);
  assert.equal((await db.query('SELECT "emailVerified" FROM "User" WHERE id=$1', [user.id])).rows[0].emailVerified, true);
  const login = await api("/api/auth/sign-in/email", { email, password });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.ok(login.cookie);
  const me = await api("/api/me", undefined, login.cookie, "GET");
  assert.equal(me.status, 200); assert.equal(me.data.user.id, user.id); assert.equal(me.data.user.role, "REPORTER");
  assert.equal((await api("/api/manager/issues?status=SUBMITTED", undefined, login.cookie, "GET")).status, 403);
  const report = await api("/api/reports", { description: "Auth review report", location: { kind: "OUTDOOR", detail: "Khu thử xác thực" } }, login.cookie);
  assert.equal(report.status, 201, JSON.stringify(report.data));
  assert.equal((await db.query('SELECT "reporterId" FROM "Report" WHERE id=$1', [report.data.report.id])).rows[0].reporterId, user.id);

  execFileSync("npm", ["run", "auth:bootstrap-manager", "--", email], { stdio: "pipe" });
  assert.equal((await api("/api/manager/issues?status=SUBMITTED", undefined, login.cookie, "GET")).status, 200);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "UserRoleEvent" WHERE "subjectUserId"=$1', [user.id])).rows[0].n, 1);
  await db.query('UPDATE "User" SET role=\'REPORTER\' WHERE id=$1', [user.id]);
  assert.equal((await api("/api/manager/issues?status=SUBMITTED", undefined, login.cookie, "GET")).status, 403);
  const logout = await api("/api/auth/sign-out", {}, login.cookie);
  assert.equal(logout.status, 200);
  assert.equal((await api("/api/me", undefined, login.cookie, "GET")).status, 401);
  const secondLogin = await api("/api/auth/sign-in/email", { email, password });
  await db.query('UPDATE "Session" SET "expiresAt"=now()-interval \'1 minute\' WHERE "userId"=$1', [user.id]);
  assert.equal((await api("/api/me", undefined, secondLogin.cookie, "GET")).status, 401);
  console.log("PASS: domain restriction, protected role, hashed password, Mailpit verification, real sessions, Report ownership, 401/403, manager bootstrap/audit, role revocation, logout and expiry.");
} finally { await db.end(); }
