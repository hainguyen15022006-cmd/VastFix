// Kiểm tra tích hợp xuyên suốt bản chạy chung VastFix (Hoàng Anh - tích hợp/QA).
// Sau `npm run stack:up`, chạy:  npm run check:integration
// Tùy chọn (thêm sau `--`):
//   --write      tạo Report thật qua API (ghi vào DB của bản chung) rồi kiểm tra hàng đợi quản lý
//   --auth       đăng ký 1 tài khoản thử @usth.edu.vn, xác minh qua Mailpit, đăng nhập phiên thật
//   --fallback   tạm dừng service ai bằng Docker Compose, kiểm tra aiStatus "unavailable" và vẫn gửi được Report
//   --report <file.md>   ghi bảng kết quả ra Markdown
// Biến môi trường: WEB_URL (mặc định http://127.0.0.1:3000), AI_URL (mặc định http://127.0.0.1:8000),
// VASTFIX_DEMO_*_PASSWORD (đọc từ .env qua --env-file).
// Kết quả mỗi ca: ĐẠT | LỖI | BỎ QUA. Tên trường lấy đúng từ API contract v1.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const WEB = (process.env.WEB_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const AI = (process.env.AI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const MAIL = (process.env.MAIL_URL ?? "http://127.0.0.1:8025").replace(/\/$/, "");
for (const url of [WEB, AI, MAIL]) {
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Chỉ chạy trên máy local");
}
const args = process.argv.slice(2);
const WRITE = args.includes("--write") || args.includes("--fallback");
const FALLBACK = args.includes("--fallback");
const AUTH = args.includes("--auth");
const reportIdx = args.indexOf("--report");
const REPORT_FILE = reportIdx >= 0 ? args[reportIdx + 1] : null;

// ID cố định từ database-starter/prisma/seed.ts.
const R001 = "55555555-5555-4555-8555-555555555555"; // H2-03, ứng viên trùng thật
const R002 = "50000000-0000-4000-8000-000000000002"; // H2-04, negative khó
const DEMO_INPUT = {
  description: "Đèn H2-03 ở hành lang giữa tầng 2 không sáng",
  proposedCategoryCode: "ELECTRICAL",
  location: {
    kind: "INDOOR",
    buildingId: "11111111-1111-4111-8111-111111111111",
    floorId: "22222222-2222-4222-8222-222222222222",
    areaId: "33333333-3333-4333-8333-333333333333",
    detail: "H2-03",
  },
};

const PASS = "ĐẠT", FAIL = "LỖI", SKIP = "BỎ QUA";
const results = [];
const cookies = {};

async function call(method, url, { body, role } = {}) {
  // Better Auth yêu cầu Origin; phiên demo của Chúc không cần (và chỉ nhận đúng origin của chính server).
  const headers = url.includes("/api/auth/") ? { origin: WEB } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (role && cookies[role]) headers.cookie = cookies[role];
  const started = Date.now();
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* không phải JSON */ }
  const allCookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, text, json, ms: Date.now() - started, setCookie: allCookies || null };
}

const isUuid = (v) => typeof v === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v);
const isIsoTz = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v);
const short = (r) => `HTTP ${r.status} ${r.text.slice(0, 140)}`;

function checkList(list, { idKey, reasonKey }) {
  const problems = [];
  if (!Array.isArray(list)) return ["suggestions không phải mảng"];
  if (list.length > 5) problems.push(`có ${list.length} gợi ý (> 5)`);
  const seen = new Set();
  let prev = Infinity;
  for (const s of list) {
    if (seen.has(s?.[idKey])) problems.push(`lặp ${idKey}`);
    seen.add(s?.[idKey]);
    if (typeof s?.score !== "number" || s.score < 0 || s.score > 1) problems.push("score ngoài [0,1]");
    else if (s.score > prev) problems.push("score không giảm dần");
    else prev = s.score;
    if (!Array.isArray(s?.[reasonKey])) problems.push(`${reasonKey} không phải mảng`);
  }
  return problems;
}
function ranking(ids) {
  const a = ids.indexOf(R001), b = ids.indexOf(R002);
  return a >= 0 && (b < 0 || a < b);
}

async function test(id, name, owner, fn) {
  try {
    const { result, detail } = await fn();
    results.push({ id, name, owner, result, detail });
  } catch (err) {
    const msg = err?.name === "TimeoutError" ? "quá 15 giây không trả lời" : (err?.cause?.code ?? err?.message ?? String(err));
    results.push({ id, name, owner, result: FAIL, detail: `không gọi được: ${msg}` });
  }
}
const pass = (detail) => ({ result: PASS, detail });
const fail = (detail) => ({ result: FAIL, detail });

// ---- 1. Ba thành phần sống ----
await test("WEB-01", "Trang đầu Next.js mở được (/vi)", "Hải Anh + Sơn", async () => {
  const r = await call("GET", `${WEB}/vi`);
  return r.status === 200 && r.text.includes("VastFix") ? pass(`HTTP 200, ${r.ms} ms`) : fail(short(r));
});
await test("WEB-02", "Next.js kết nối PostgreSQL (/api/health)", "Hải Anh", async () => {
  const r = await call("GET", `${WEB}/api/health`);
  return r.json?.status === "ok" && r.json?.database === "ok" ? pass(JSON.stringify(r.json)) : fail(short(r));
});
await test("AI-01", "FastAPI /health đúng contract 4.5", "Thành Lê", async () => {
  const r = await call("GET", `${AI}/health`);
  return r.json?.status === "ok" && typeof r.json?.model_version === "string" ? pass(`model_version=${r.json.model_version}`) : fail(short(r));
});
await test("AI-02", "FastAPI /duplicates với ai-service/demo/h2-03.json", "Thành Lê", async () => {
  const fixture = JSON.parse(readFileSync(new URL("../ai-service/demo/h2-03.json", import.meta.url), "utf8"));
  const r = await call("POST", `${AI}/duplicates`, { body: fixture });
  if (r.status !== 200) return fail(short(r));
  const allowed = fixture.candidates.map((c) => c.report_id);
  const problems = checkList(r.json.suggestions, { idKey: "report_id", reasonKey: "reason_codes" });
  if (r.json.request_id !== fixture.request_id) problems.push("request_id không khớp");
  if (r.json.suggestions.some((s) => !allowed.includes(s.report_id))) problems.push("report_id ngoài candidates");
  const ids = r.json.suggestions.map((s) => s.report_id);
  if (!ranking(ids)) problems.push("H2-03 (R-001) không xếp trên H2-04");
  return problems.length ? fail(problems.join("; ")) : pass(`${ids.length} gợi ý, H2-03 trên H2-04, ${r.ms} ms`);
});

// ---- 2. Phiên demo và quyền ----
await test("AUTH-01", "Không có phiên: gửi Report và xem hàng đợi đều 401", "Chúc", async () => {
  const a = await call("POST", `${WEB}/api/reports`, { body: DEMO_INPUT });
  const b = await call("GET", `${WEB}/api/manager/issues?status=SUBMITTED`);
  const ok = a.status === 401 && b.status === 401 && a.json?.error?.code === "UNAUTHENTICATED" && isUuid(a.json?.requestId);
  return ok ? pass("401 UNAUTHENTICATED cả hai") : fail(`reports ${a.status}, queue ${b.status}`);
});
await test("AUTH-00", "Đăng nhập demo 3 vai qua /api/dev/session", "Chúc", async () => {
  const roles = [];
  for (const role of ["reporter", "staff", "manager"]) {
    const password = process.env[`VASTFIX_DEMO_${role.toUpperCase()}_PASSWORD`];
    if (!password) return fail(`thiếu VASTFIX_DEMO_${role.toUpperCase()}_PASSWORD trong .env (chạy npm run demo:env)`);
    const r = await call("POST", `${WEB}/api/dev/session`, { body: { email: `${role}@demo.invalid`, password } });
    if (r.status !== 200 || !r.setCookie) return fail(`${role}: ${short(r)}`);
    cookies[role] = r.setCookie.split(";")[0];
    roles.push(r.json.role);
  }
  return pass(roles.join(", "));
});
const loggedIn = () => ["reporter", "staff", "manager"].every((r) => cookies[r]);

await test("AUTH-06", "REPORTER và STAFF bị chặn ở hàng đợi quản lý (403, không lộ items)", "Chúc", async () => {
  if (!loggedIn()) return { result: SKIP, detail: "chưa đăng nhập được" };
  const out = [];
  for (const role of ["reporter", "staff"]) {
    const r = await call("GET", `${WEB}/api/manager/issues?status=SUBMITTED`, { role });
    if (r.status !== 403 || r.json?.items !== undefined) return fail(`${role}: ${short(r)}`);
    out.push(`${role} 403`);
  }
  return pass(out.join(", "));
});

// ---- 3. Lát cắt demo ----
await test("API-01", "Gợi ý trùng qua web: ≤5, đúng field, H2-03 trên H2-04", "Chúc + Thành Lê", async () => {
  if (!loggedIn()) return { result: SKIP, detail: "chưa đăng nhập được" };
  const r = await call("POST", `${WEB}/api/duplicate-suggestions`, { body: DEMO_INPUT, role: "reporter" });
  if (r.status !== 200) return fail(short(r));
  const problems = checkList(r.json.suggestions, { idKey: "reportId", reasonKey: "reasonCodes" });
  if (!isUuid(r.json.requestId)) problems.push("requestId không phải UUID");
  if (r.json.aiStatus !== "ok") problems.push(`aiStatus=${r.json.aiStatus} (AI đang chạy thì phải là ok)`);
  for (const s of r.json.suggestions ?? []) {
    for (const k of ["issueId", "summary", "locationLabel"]) if (s[k] === undefined) problems.push(`thiếu ${k}`);
    if (!isIsoTz(s.createdAt)) problems.push("createdAt sai định dạng");
  }
  const ids = (r.json.suggestions ?? []).map((s) => s.reportId);
  if (!ranking(ids)) problems.push("H2-03 (R-001) không xếp trên H2-04");
  return problems.length ? fail([...new Set(problems)].join("; ")) : pass(`${ids.length} gợi ý, H2-03 trên H2-04, ${r.ms} ms`);
});


// ---- Giao diện Sơn/Dương (chỉ kiểm tra trang trả về được, nội dung động do test Playwright của hai bạn kiểm tra) ----
await test("UI-01", "Trang /vi, /en, form báo sự cố và hàng đợi quản lý mở được", "Sơn + Dương", async () => {
  const pages = ["/vi", "/en", "/vi/reports/new", "/en/reports/new", "/vi/manager/issues", "/en/manager/issues", "/login", "/register"];
  const bad = [];
  for (const path of pages) {
    const r = await call("GET", `${WEB}${path}`);
    if (r.status !== 200) bad.push(`${path} → ${r.status}`);
  }
  return bad.length ? fail(bad.join(", ")) : pass(`${pages.length} trang HTTP 200`);
});
await test("UI-02", "/ tự chuyển sang trang theo ngôn ngữ", "Sơn", async () => {
  const r = await call("GET", `${WEB}/`);
  return (r.status >= 300 && r.status < 400) || (r.status === 200 && r.text.includes("VastFix")) ? pass(`HTTP ${r.status}`) : fail(short(r));
});
await test("OPT-01", "GET /api/report-options cho form: có A1 → tầng 2 → hành lang giữa", "Dương", async () => {
  if (!loggedIn()) return { result: SKIP, detail: "chưa đăng nhập được" };
  const r = await call("GET", `${WEB}/api/report-options`, { role: "reporter" });
  if (r.status !== 200) return fail(short(r));
  const a1 = r.json.buildings?.find((b) => b.id === DEMO_INPUT.location.buildingId);
  const ok = a1?.floors?.some((f) => f.id === DEMO_INPUT.location.floorId && f.areas?.some((a) => a.id === DEMO_INPUT.location.areaId));
  return ok ? pass(`${r.json.buildings.length} tòa, ${r.json.categories?.length ?? 0} danh mục`) : fail("thiếu cây vị trí seed");
});

async function createReport(tag) {
  const r = await call("POST", `${WEB}/api/reports`, { body: { ...DEMO_INPUT, description: `${DEMO_INPUT.description} [${tag} ${new Date().toISOString()}]` }, role: "reporter" });
  const ok = r.status === 201 && isUuid(r.json?.report?.id) && isIsoTz(r.json?.report?.submittedAt) && isUuid(r.json?.issue?.id) && r.json?.issue?.status === "SUBMITTED" && isUuid(r.json?.requestId);
  return { ok, r };
}

let createdIssueId = null;
await test("API-02", "Người báo gửi Report: 201, Issue SUBMITTED", "Chúc + Hải Anh", async () => {
  if (!WRITE) return { result: SKIP, detail: "cần --write (ca này ghi DB)" };
  if (!loggedIn()) return { result: SKIP, detail: "chưa đăng nhập được" };
  const { ok, r } = await createReport("check");
  if (!ok) return fail(short(r));
  createdIssueId = r.json.issue.id;
  return pass(`issue ${createdIssueId}, ${r.ms} ms`);
});

await test("API-03", "Quản lý thấy hàng đợi SUBMITTED đúng field, có Issue vừa tạo", "Chúc + Sơn", async () => {
  if (!loggedIn()) return { result: SKIP, detail: "chưa đăng nhập được" };
  const r = await call("GET", `${WEB}/api/manager/issues?status=SUBMITTED`, { role: "manager" });
  if (r.status !== 200 || !Array.isArray(r.json?.items)) return fail(short(r));
  const problems = [];
  if (!("nextCursor" in r.json)) problems.push("thiếu nextCursor");
  for (const it of r.json.items) {
    for (const k of ["issueId", "originReportId", "summary", "locationLabel", "status", "createdAt"]) if (it[k] === undefined) problems.push(`thiếu ${k}`);
    if (it.status !== "SUBMITTED") problems.push(`có Issue ${it.status}`);
  }
  if (createdIssueId && !r.json.items.some((it) => it.issueId === createdIssueId)) problems.push("không thấy Issue vừa tạo ở trang đầu");
  return problems.length ? fail([...new Set(problems)].join("; ")) : pass(`${r.json.items.length} Issue ở trang đầu${createdIssueId ? ", có Issue vừa tạo" : ""}`);
});

// ---- 4. Fallback khi AI tắt ----
if (FALLBACK) {
  await test("FB-01", "AI tắt: gợi ý trả aiStatus unavailable, vẫn gửi được Report", "Chúc", async () => {
    if (!loggedIn()) return { result: SKIP, detail: "chưa đăng nhập được" };
    execFileSync("docker", ["compose", "stop", "ai"], { stdio: "ignore" });
    try {
      const s = await call("POST", `${WEB}/api/duplicate-suggestions`, { body: DEMO_INPUT, role: "reporter" });
      if (s.status !== 200 || s.json?.aiStatus !== "unavailable" || s.json?.suggestions?.length !== 0) return fail(`gợi ý: ${short(s)}`);
      const { ok, r } = await createReport("fallback");
      if (!ok) return fail(`gửi Report: ${short(r)}`);
      const q = await call("GET", `${WEB}/api/manager/issues?status=SUBMITTED`, { role: "manager" });
      if (!q.json?.items?.some((it) => it.issueId === r.json.issue.id)) return fail("quản lý không thấy Issue tạo lúc AI tắt");
      return pass(`aiStatus=unavailable sau ${s.ms} ms; Report 201; quản lý thấy Issue`);
    } finally {
      execFileSync("docker", ["compose", "start", "ai"], { stdio: "ignore" });
      // Đợi AI sống lại để các ca sau không bị ảnh hưởng.
      for (let i = 0; i < 40; i++) {
        if (await fetch(`${AI}/health`).then((r) => r.ok).catch(() => false)) break;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  });
}


// ---- 5. Đăng nhập thật (Better Auth + Mailpit) ----
if (AUTH) {
  await test("AUTH-R1", "Đăng ký @usth.edu.vn, xác minh qua Mailpit, đăng nhập thật, quyền REPORTER", "Hải Anh", async () => {
    const email = `check-${crypto.randomUUID()}@usth.edu.vn`;
    const password = `${crypto.randomUUID()}-check`;
    const outside = await call("POST", `${WEB}/api/auth/sign-up/email`, { body: { name: "Outside", email: `x-${crypto.randomUUID()}@example.com`, password } });
    if (outside.status !== 400) return fail(`email ngoài USTH không bị chặn: ${short(outside)}`);
    const reg = await call("POST", `${WEB}/api/auth/sign-up/email`, { body: { name: "Integration check", email, password, role: "MANAGER" } });
    if (reg.status !== 200) return fail(`đăng ký: ${short(reg)}`);
    const early = await call("POST", `${WEB}/api/auth/sign-in/email`, { body: { email, password } });
    if (early.status !== 403) return fail(`chưa xác minh mà đăng nhập được: HTTP ${early.status}`);
    let message;
    for (let i = 0; i < 10 && !message; i++) {
      const inbox = await (await fetch(`${MAIL}/api/v1/messages`)).json();
      message = inbox.messages?.find((m) => m.To?.some((t) => t.Address === email));
      if (!message) await new Promise((r) => setTimeout(r, 500));
    }
    if (!message) return fail("không thấy thư xác minh trong Mailpit");
    const body = await (await fetch(`${MAIL}/api/v1/message/${message.ID}`)).json();
    const link = body.Text?.match(/https?:\/\/\S+/)?.[0];
    if (!link || new URL(link).origin !== WEB) return fail(`link xác minh sai địa chỉ: ${link}`);
    const verify = await fetch(link, { redirect: "manual" });
    if (verify.status >= 400) return fail(`xác minh HTTP ${verify.status}`);
    const login = await call("POST", `${WEB}/api/auth/sign-in/email`, { body: { email, password } });
    if (login.status !== 200 || !login.setCookie) return fail(`đăng nhập: ${short(login)}`);
    cookies.real = login.setCookie;
    const me = await call("GET", `${WEB}/api/me`, { role: "real" });
    if (me.json?.user?.role !== "REPORTER") return fail(`vai sau đăng ký: ${me.json?.user?.role} (tự xin MANAGER phải bị bỏ qua)`);
    const queue = await call("GET", `${WEB}/api/manager/issues?status=SUBMITTED`, { role: "real" });
    if (queue.status !== 403) return fail(`REPORTER thật xem được hàng đợi: HTTP ${queue.status}`);
    const sug = await call("POST", `${WEB}/api/duplicate-suggestions`, { body: DEMO_INPUT, role: "real" });
    if (sug.status !== 200 || sug.json?.aiStatus !== "ok") return fail(`gợi ý bằng phiên thật: ${short(sug)}`);
    await call("POST", `${WEB}/api/auth/sign-out`, { body: {}, role: "real" });
    const after = await call("GET", `${WEB}/api/me`, { role: "real" });
    delete cookies.real;
    if (after.status !== 401) return fail(`sau đăng xuất vẫn còn phiên: HTTP ${after.status}`);
    return pass("chặn email ngoài, chặn đăng nhập trước xác minh, thư tới Mailpit, vai REPORTER, 403 hàng đợi, gợi ý ok, đăng xuất 401");
  });
}

// Thu hồi phiên demo.
for (const role of ["reporter", "staff", "manager"].filter((r) => cookies[r])) await call("DELETE", `${WEB}/api/dev/session`, { role }).catch(() => {});

// ---- In kết quả ----
const when = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const lines = [
  `# Kiểm tra tích hợp VastFix — ${when} (giờ Việt Nam)`,
  "",
  `Web: ${WEB} · AI: ${AI}${WRITE ? " · có ghi DB" : ""}${FALLBACK ? " · có thử AI tắt" : ""}${AUTH ? " · có đăng nhập thật" : ""}`,
  "",
  "| Mã | Kiểm tra | Owner khi lỗi | Kết quả | Chi tiết |",
  "| --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.id} | ${r.name} | ${r.owner} | ${r.result} | ${String(r.detail).replace(/\|/g, "\\|")} |`),
];
const failed = results.filter((r) => r.result === FAIL);
lines.push("", `Tổng: ${results.filter((r) => r.result === PASS).length} đạt, ${failed.length} lỗi, ${results.filter((r) => r.result === SKIP).length} bỏ qua.`);
const out = lines.join("\n");
console.log(out);
if (REPORT_FILE) writeFileSync(REPORT_FILE, out + "\n");
process.exit(failed.length ? 1 : 0);
