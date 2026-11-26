// Real file/API verification on isolated PostgreSQL and production Next.js.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";

const port = Number(process.env.PHOTO_TEST_PORT || 3123);
const dbPort = Number(process.env.PHOTO_TEST_DB_PORT || 55443);
const base = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString("base64url"), dbPassword = randomBytes(24).toString("base64url");
await mkdir("data/private", { recursive: true });
const root = await mkdtemp(resolve("data/private/photo-api-"));
const photoDir = join(root, "photos");
const database = new EmbeddedPostgres({ databaseDir: join(root,"postgres"), user:"postgres", password:dbPassword, port:dbPort, persistent:false,
  initdbFlags:["--encoding=UTF8","--locale=C"], postgresFlags:["-h","127.0.0.1"], onLog:()=>{}, onError:()=>{} });
const env = { ...process.env, DATABASE_URL:`postgresql://postgres:${dbPassword}@127.0.0.1:${dbPort}/postgres?schema=public`,
  BETTER_AUTH_URL:base, BETTER_AUTH_SECRET:randomBytes(48).toString("base64url"), VASTFIX_DEMO_AUTH:"0", VASTFIX_UPLOAD_DIR:photoDir, NEXT_TELEMETRY_DISABLED:"1" };
let db, web, started=false, logs="";
const users={}, checks=[];
const pass = label => { checks.push(label); console.log("PASS "+label); };
function run(args) {
  const child=spawn(process.execPath,args,{env,stdio:["ignore","pipe","pipe"]});
  child.stdout.on("data",chunk=>logs+=chunk); child.stderr.on("data",chunk=>logs+=chunk); return child;
}
const image=sharp({create:{width:24,height:18,channels:3,background:{r:35,g:130,b:95}}});
const png=await image.clone().png().toBuffer();
const jpeg=await image.clone().withMetadata({orientation:6}).jpeg().toBuffer();
const webp=await image.clone().webp().toBuffer();

async function call(user,path,input,expected=200) {
  const headers={origin:base};
  if(user) headers.cookie=users[user].cookie;
  if(input!==undefined) headers["Content-Type"]="application/json";
  const response=await fetch(base+"/api/"+path,{method:input===undefined?"GET":"POST",headers,body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  assert.equal(response.status,expected,path+" "+JSON.stringify(data)); return data;
}
async function upload(user,bytes=png,type="image/png",options={}) {
  const form=new FormData();
  form.set("purpose",options.purpose||"REPORT"); if(options.issueId) form.set("issueId",options.issueId);
  form.set("file",new File([bytes],options.name||"../original-name.png",{type}));
  const headers={origin:options.origin||base}; if(user) headers.cookie=users[user].cookie;
  const response=await fetch(base+"/api/uploads",{method:"POST",headers,body:form,signal:AbortSignal.timeout(15000)});
  const body=await response.json(); assert.equal(response.status,options.expected??201,JSON.stringify(body));
  return body.photo;
}
async function get(user,id,expected=200,method="GET") {
  const response=await fetch(base+"/api/photos/"+id,{method,headers:user?{cookie:users[user].cookie}:{},signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,expected,`photo ${method} status ${response.status}`); return response;
}
async function remove(user,id,expected=200) {
  const response=await fetch(base+"/api/photos/"+id,{method:"DELETE",headers:{cookie:users[user].cookie,origin:base}});
  assert.equal(response.status,expected); return response;
}
const makeReport=(user,photoIds=[])=>call(user,"reports",{description:"[PHOTO-TEST] Thiết bị cần kiểm tra",location:{kind:"OUTDOOR",detail:"Vị trí diễn tập"},photoIds},201);
const detail=async id=>(await call("manager","manager/issues/"+id)).issue;
const action=async(user,id,name,fields={},status=200)=>call(user,`${user==="manager"?"manager":"staff"}/issues/${id}/${name}`,{expectedVersion:(await detail(id)).version,...fields},status);

try {
  await database.initialise(); await database.start(); started=true;
  db=database.getPgClient(); await db.connect();
  for(const entry of (await readdir("database-starter/prisma/migrations",{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort()) {
    await db.query(await readFile(join("database-starter/prisma/migrations",entry,"migration.sql"),"utf8"));
  }
  assert.equal((await once(run(["--import","tsx","database-starter/prisma/seed.ts"]),"exit"))[0],0,logs);
  const hash=await hashPassword(password);
  for(const [name,role] of Object.entries({reporter:"REPORTER",other:"REPORTER",manager:"MANAGER",staff:"STAFF",staffB:"STAFF"})) {
    const id=randomUUID(),email=name.toLowerCase()+".photos@usth.edu.vn";
    await db.query('INSERT INTO "User" (id,email,name,role,"emailVerified") VALUES ($1,$2,$3,$4,true)',[id,email,name,role]);
    await db.query('INSERT INTO "Account" (id,"userId","accountId","providerId",password) VALUES ($1,$2,$3,\'credential\',$4)',[randomUUID(),id,id,hash]);
    users[name]={id,email};
  }
  web=run(["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)]);
  let ready=false;
  for(let i=0;i<50&&web.exitCode===null;i++) {
    try{if((await fetch(base+"/api/health")).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,logs);
  for(const user of Object.values(users)) {
    const signIn=()=>fetch(base+"/api/auth/sign-in/email",{method:"POST",headers:{origin:base,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,password})});
    let res=await signIn();
    if(res.status===429){const seconds=Number(res.headers.get("x-retry-after")||10);await res.body?.cancel();await new Promise(r=>setTimeout(r,(seconds+1)*1000));res=await signIn();}
    assert.equal(res.status,200);user.cookie=res.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  }

  await upload(null,png,"image/png",{expected:401});
  await upload("reporter",png,"image/png",{origin:"https://example.invalid",expected:403});
  await upload("reporter",Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),"image/png",{expected:415});
  await upload("reporter",png.subarray(0,12),"image/png",{expected:415});
  await upload("reporter",png,"image/jpeg",{expected:415});
  await upload("reporter",Buffer.alloc(5*1024*1024+1),"image/png",{expected:413});
  const badBody=await fetch(base+"/api/uploads",{method:"POST",headers:{cookie:users.reporter.cookie,origin:base,"Content-Type":"application/json"},body:"{}"});
  assert.equal(badBody.status,415);
  const duplicate=new FormData();duplicate.append("purpose","REPORT");duplicate.append("purpose","REPORT");duplicate.append("file",new File([png],"x.png",{type:"image/png"}));
  assert.equal((await fetch(base+"/api/uploads",{method:"POST",headers:{cookie:users.reporter.cookie,origin:base},body:duplicate})).status,400);
  pass("authenticated same-origin upload; invalid, corrupt, mismatched, oversized and repeated-field requests rejected");

  const p1=await upload("reporter");
  const p2=await upload("reporter",jpeg,"image/jpeg");
  const p3=await upload("reporter",webp,"image/webp");
  const other=await upload("other");
  for(const photo of [p1,p2,p3]) {
    const response=await get("reporter",photo.photoId);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length,photo.sizeBytes);assert.equal(response.headers.get("content-type"),photo.mimeType);
    assert.equal(response.headers.get("cache-control"),"private, no-store");assert.equal(response.headers.get("x-content-type-options"),"nosniff");
    assert.ok(response.headers.get("vary").split(",").map(value=>value.trim().toLowerCase()).includes("cookie"));
    assert.ok(!(await sharp(bytes).metadata()).exif);
    await get(null,photo.photoId,401);await get("other",photo.photoId,404);await get("manager",photo.photoId,404);
  }
  const head = await get("reporter",p1.photoId,200,"HEAD");
  assert.equal(head.headers.get("content-type"),p1.mimeType);
  assert.equal(head.headers.get("cache-control"),"private, no-store");
  await get("other",p1.photoId,404,"HEAD");await remove("other",p1.photoId,404);
  pass("real JPEG/PNG/WebP files saved privately, decoded, metadata removed; draft/HEAD rights and response headers correct");

  const countBefore=(await db.query('SELECT COUNT(*)::int AS n FROM "Report"')).rows[0].n;
  await call("reporter","reports",{description:"Không được lưu",location:{kind:"OUTDOOR",detail:"Test"},photoIds:[p1.photoId,other.photoId]},400);
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM "Report"')).rows[0].n,countBefore);
  assert.equal((await db.query('SELECT "reportId" FROM "Photo" WHERE id=$1',[p1.photoId])).rows[0].reportId,null);
  await call("reporter","reports",{description:"Trùng ảnh",location:{kind:"OUTDOOR",detail:"Test"},photoIds:[p1.photoId,p1.photoId.toUpperCase()]},400);
  const target=await makeReport("reporter",[p1.photoId,p2.photoId]);
  const source=await makeReport("other",[other.photoId]);
  await remove("reporter",p1.photoId,409);await get("manager",p1.photoId);await get("other",p1.photoId,404);await get("staff",p1.photoId,404);
  await call("reporter","reports",{description:"Dùng lại",location:{kind:"OUTDOOR",detail:"Test"},photoIds:[p1.photoId]},400);
  pass("Report photo binding is atomic, owner-scoped, limited to unused IDs and immutable after submission");

  const beforeReport=(await db.query('SELECT row_to_json(r) AS data FROM "Report" r WHERE id=ANY($1::uuid[]) ORDER BY id',[[target.report.id,source.report.id]])).rows;
  const merged=await call("manager","manager/merges",{
    sourceIssueId:source.issue.id,targetIssueId:target.issue.id,
    expectedSourceVersion:(await detail(source.issue.id)).version,expectedTargetVersion:(await detail(target.issue.id)).version,
    reason:"Kiểm quyền ảnh qua API gộp thật"},201);
  const mergeId=merged.merge.mergeId;
  const id=target.issue.id;
  await action("manager",id,"triage",{categoryCode:"ELECTRICAL",priority:"P1",dueAt:"2026-12-01T12:00:00+07:00"});
  await action("manager",id,"assign",{assigneeId:users.staff.id});
  await get("staff",p1.photoId);await get("staff",other.photoId);await get("staffB",p1.photoId,404);await get("reporter",other.photoId,404);
  await action("staff",id,"start");
  await upload("manager",png,"image/png",{purpose:"WORK_EVIDENCE",issueId:id,expected:403});
  await upload("staffB",png,"image/png",{purpose:"WORK_EVIDENCE",issueId:id,expected:404});
  const evidence=await upload("staff",png,"image/png",{purpose:"WORK_EVIDENCE",issueId:id});
  const extra1=await upload("staff",png,"image/png",{purpose:"WORK_EVIDENCE",issueId:id});
  const extra2=await upload("staff",png,"image/png",{purpose:"WORK_EVIDENCE",issueId:id});
  await upload("staff",png,"image/png",{purpose:"WORK_EVIDENCE",issueId:id,expected:409});
  await remove("staff",extra1.photoId);await remove("staff",extra2.photoId);
  await get("staff",evidence.photoId);await get("manager",evidence.photoId,404);await get("reporter",evidence.photoId,404);
  await action("staff",id,"submit",{completionNote:"Đã kiểm tra bằng tệp thật",evidencePhotoIds:[evidence.photoId]});
  await get("manager",evidence.photoId);await get("reporter",evidence.photoId);await get("other",evidence.photoId);await get("staffB",evidence.photoId,404);
  await remove("staff",evidence.photoId,409);
  pass("assigned STAFF uploads real evidence, three-photo limit holds, Chuc submit links it to its event and authorized reporters/managers can read");

  await call("manager",`manager/merges/${mergeId}/reverse`,{
    expectedSourceVersion:(await detail(source.issue.id)).version,expectedTargetVersion:(await detail(target.issue.id)).version,
    reason:"Kiểm quyền ảnh sau hủy gộp thật"});
  await get("staff",other.photoId,404);await get("other",evidence.photoId,404);await get("other",other.photoId);await get("manager",other.photoId);
  assert.deepEqual((await db.query('SELECT row_to_json(r) AS data FROM "Report" r WHERE id=ANY($1::uuid[]) ORDER BY id',[[target.report.id,source.report.id]])).rows,beforeReport);
  pass("real merge/reverse APIs recalculate photo rights without modifying original Report rows or files");

  await action("manager",id,"return-work",{reason:"Kiểm tra lại"});
  const second=await upload("staff",jpeg,"image/jpeg",{purpose:"WORK_EVIDENCE",issueId:id});
  await action("staff",id,"submit",{completionNote:"Đã kiểm tra lại",evidencePhotoIds:[second.photoId]});
  await action("manager",id,"close",{evidenceReviewed:true});
  await action("manager",id,"reopen",{reason:"Kiểm tra lại lần xử lý"});
  await get("staff",p1.photoId,404);await get("staff",evidence.photoId,404);await get("reporter",evidence.photoId);
  pass("return/resubmit/close/reopen retain evidence history and revoke former assignee access");

  const row=(await db.query('SELECT "storageKey" FROM "Photo" WHERE id=$1',[p1.photoId])).rows[0];
  const filePath=join(photoDir,row.storageKey);
  await rename(filePath,filePath+".offline");
  try {await get("reporter",p1.photoId,503);await get("other",p1.photoId,404);} finally {await rename(filePath+".offline",filePath);}
  await db.query('UPDATE "Photo" SET "storageKey"=$2 WHERE id=$1',[p1.photoId,"../private-secret"]);
  try {await get("reporter",p1.photoId,404);} finally {await db.query('UPDATE "Photo" SET "storageKey"=$2 WHERE id=$1',[p1.photoId,row.storageKey]);}
  const draftRow=(await db.query('SELECT "storageKey" FROM "Photo" WHERE id=$1',[p3.photoId])).rows[0];
  await remove("reporter",p3.photoId);await get("reporter",p3.photoId,404);
  await assert.rejects(stat(join(photoDir,draftRow.storageKey)),{code:"ENOENT"});
  pass("missing files fail safely, database path tampering cannot read outside storage, draft deletion removes only its file");

  const race=await upload("other");
  const attempts=await Promise.all([1,2].map(()=>fetch(base+"/api/reports",{method:"POST",headers:{cookie:users.other.cookie,origin:base,"Content-Type":"application/json"},
    body:JSON.stringify({description:"Concurrent photo attachment",location:{kind:"OUTDOOR",detail:"Test"},photoIds:[race.photoId]})})));
  assert.equal(attempts.filter(r=>r.status===201).length,1);
  assert.ok(attempts.some(r=>r.status===400||r.status===409));
  pass("concurrent Report creation can consume a draft photo only once");

  const diskBefore=await readdir(photoDir);
  for(let i=0;i<12;i++) await upload("other");
  await upload("other",png,"image/png",{expected:409});
  const drafts=(await db.query('SELECT id FROM "Photo" WHERE "ownerUserId"=$1 AND "reportId" IS NULL AND "submissionEventId" IS NULL',[users.other.id])).rows;
  assert.equal(drafts.length,12);
  assert.equal((await readdir(photoDir)).length,diskBefore.length+12);
  for(const draft of drafts) await remove("other",draft.id);
  assert.equal((await readdir(photoDir)).length,diskBefore.length);
  pass("draft quota and failure cleanup prevent extra metadata/files; removing drafts restores quota");

  await writeFile(resolve("../photo-api-verification.json"),JSON.stringify({checks,scope:"Production Next + real Better Auth + PostgreSQL 17 + real image files + actual merge/reverse APIs"},null,2));
  console.log(`PASS photo API: ${checks.length} verification groups.`);
} catch(error) {
  console.error((error?.stack||String(error)).replaceAll(password,"[test-password]").replaceAll(dbPassword,"[db-password]"));
  console.error(logs.replaceAll(password,"[test-password]").replaceAll(dbPassword,"[db-password]"));
  process.exitCode=1;
} finally {
  if(web&&web.exitCode===null){const exited=once(web,"exit");web.kill();await exited;}
  if(db) await db.end();if(started) await database.stop();
}
