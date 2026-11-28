// Exercises real merge/reverse/review HTTP APIs with real auth and isolated DB.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";

const port=Number(process.env.MERGE_TEST_PORT||3124),dbPort=Number(process.env.MERGE_TEST_DB_PORT||55444),aiPort=Number(process.env.MERGE_TEST_AI_PORT||18344);
const base=`http://127.0.0.1:${port}`;
const password=randomBytes(24).toString("base64url"),dbPassword=randomBytes(24).toString("base64url");
await mkdir("data/private",{recursive:true});
const root=await mkdtemp(resolve("data/private/merge-api-"));
const postgres=new EmbeddedPostgres({databaseDir:join(root,"db"),user:"postgres",password:dbPassword,port:dbPort,persistent:false,
  initdbFlags:["--encoding=UTF8","--locale=C"],postgresFlags:["-h","127.0.0.1"],onLog:()=>{},onError:()=>{}});
const env={...process.env,DATABASE_URL:`postgresql://postgres:${dbPassword}@127.0.0.1:${dbPort}/postgres?schema=public`,
  BETTER_AUTH_URL:base,BETTER_AUTH_SECRET:randomBytes(48).toString("base64url"),VASTFIX_DEMO_AUTH:"0",VASTFIX_UPLOAD_DIR:join(root,"photos"),
  FASTAPI_BASE_URL:`http://127.0.0.1:${aiPort}`,NEXT_TELEMETRY_DISABLED:"1"};
const users={},checks=[];
let aiMode="ok";
let db,web,ai,started=false,logs="",lastCandidates=[];
const pass=label=>{checks.push(label);console.log("PASS "+label);};
function run(args){const p=spawn(process.execPath,args,{env,stdio:["ignore","pipe","pipe"]});p.stdout.on("data",c=>logs+=c);p.stderr.on("data",c=>logs+=c);return p;}
async function raw(user,path,input,origin=base){
  const headers={};if(origin)headers.origin=origin;if(user)headers.cookie=users[user].cookie;if(input!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(base+"/api/"+path,{method:input===undefined?"GET":"POST",headers,body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
  const body=await response.json();return {status:response.status,body};
}
async function call(user,path,input,expected=200){const res=await raw(user,path,input);assert.equal(res.status,expected,path+" "+JSON.stringify(res.body));return res.body;}
const detail=async id=>(await call("manager","manager/issues/"+id)).issue;
const make=async(description="Đèn kiểm thử gộp",location={kind:"OUTDOOR",detail:"Sân kiểm thử gộp"})=>(await call("reporter","reports",{description,location},201)).issue.id;
async function params(source,target,reason="Cùng đối tượng và cùng lần hỏng"){return {sourceIssueId:source,targetIssueId:target,
  expectedSourceVersion:(await detail(source)).version,expectedTargetVersion:(await detail(target)).version,reason};}
const merge=async(source,target)=>(await call("manager","manager/merges",await params(source,target),201));
async function reverseInput(source,target){return {expectedSourceVersion:(await detail(source)).version,expectedTargetVersion:(await detail(target)).version,reason:"Tách ra để kiểm tra lại"};}
const triage={categoryCode:"ELECTRICAL",priority:"P1",dueAt:"2026-12-01T12:00:00+07:00"};
async function act(user,id,name,extra={},expected=200){return call(user,`${user.startsWith("manager")?"manager":"staff"}/issues/${id}/${name}`,{expectedVersion:(await detail(id)).version,...extra},expected);}
async function awaiting(id){
  let d=await detail(id);if(d.status==="SUBMITTED")await act("manager",id,"triage",triage);
  await act("manager",id,"assign",{assigneeId:users.staff.id});await act("staff",id,"start");
  const png=await sharp({create:{width:4,height:4,channels:3,background:{r:20,g:90,b:150}}}).png().toBuffer();
  const form=new FormData();form.set("purpose","WORK_EVIDENCE");form.set("issueId",id);form.set("file",new File([png],"work.png",{type:"image/png"}));
  const res=await fetch(base+"/api/uploads",{method:"POST",headers:{cookie:users.staff.cookie,origin:base},body:form});
  const dto=await res.json();assert.equal(res.status,201,JSON.stringify(dto));
  await act("staff",id,"submit",{completionNote:"Đã xử lý trong diễn tập",evidencePhotoIds:[dto.photo.photoId]});
}
async function reportSnapshot(){return (await db.query('SELECT row_to_json(r) AS data FROM "Report" r ORDER BY id')).rows;}
async function suggestions(){await call("reporter","duplicate-suggestions",{description:"Đèn không sáng",location:{kind:"OUTDOOR",detail:"Sân kiểm thử gộp"}});return lastCandidates;}
async function checkRace(calls,successStatus){
  const results=await Promise.all(calls);assert.equal(results.filter(r=>successStatus.includes(r.status)).length,1,JSON.stringify(results));
  assert.equal(results.filter(r=>r.status===409).length,1,JSON.stringify(results));return results;
}

try{
  await postgres.initialise();await postgres.start();started=true;db=postgres.getPgClient();await db.connect();
  for(const name of (await readdir("database-starter/prisma/migrations",{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort())
    await db.query(await readFile(join("database-starter/prisma/migrations",name,"migration.sql"),"utf8"));
  assert.equal((await once(run(["--import","tsx","database-starter/prisma/seed.ts"]),"exit"))[0],0,logs);
  const hash=await hashPassword(password);
  for(const [name,role] of Object.entries({reporter:"REPORTER",staff:"STAFF",manager:"MANAGER",managerB:"MANAGER"})){
    const id=randomUUID(),email=name.toLowerCase()+".merge@usth.edu.vn";
    await db.query('INSERT INTO "User" (id,email,name,role,"emailVerified") VALUES ($1,$2,$3,$4,true)',[id,email,name,role]);
    await db.query('INSERT INTO "Account" (id,"userId","accountId","providerId",password) VALUES ($1,$2,$3,\'credential\',$4)',[randomUUID(),id,id,hash]);users[name]={id,email};
  }
  ai=createServer(async(req,res)=>{
    let text="";for await(const chunk of req)text+=chunk;const data=JSON.parse(text);lastCandidates=data.candidates.map(c=>c.issue_id);
    if(aiMode==="error"){res.writeHead(503).end();return;}
    if(aiMode==="timeout"){await new Promise(r=>setTimeout(r,6000));res.writeHead(503).end();return;}
    const upstream=await fetch("http://127.0.0.1:18481/duplicates", {
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)
    });
    assert.equal(upstream.status,200);
    const ranked=await upstream.json();
    assert.equal(ranked.model_version,"multilingual-e5-small-q8-v1");
    assert.ok(ranked.suggestions.length<=5);
    assert.ok(ranked.suggestions.every(s=>data.candidates.some(c=>c.report_id===s.report_id)));
    res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(ranked));
  });ai.listen(aiPort,"127.0.0.1");await once(ai,"listening");
  web=run(["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port",String(port)]);
  let ready=false;for(let i=0;i<400&&web.exitCode===null;i++){try{if((await fetch(base+"/api/health")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,logs);
  for(const user of Object.values(users)){
    const sign=()=>fetch(base+"/api/auth/sign-in/email",{method:"POST",headers:{origin:base,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,password})});
    let res=await sign();if(res.status===429){const seconds=Number(res.headers.get("x-retry-after")||10);await res.body?.cancel();await new Promise(r=>setTimeout(r,(seconds+1)*1000));res=await sign();}
    assert.equal(res.status,200);user.cookie=res.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  }
  const a=await make(),b=await make(),c=await make();
  const p=await params(a,b);
  await call(null,"manager/merges",p,401);await call("reporter","manager/merges",p,403);await call("staff","manager/merges",p,403);
  assert.equal((await raw("manager","manager/merges",p,"https://invalid.example")).status,403);
  await call("manager","manager/merges",{...p,actorUserId:users.staff.id},400);
  await call("manager","manager/merges",{...p,reason:" "},400);
  await call("manager","manager/merges",{...p,expectedSourceVersion:-1},400);
  await call("manager","manager/merges",{...p,sourceIssueId:b.toUpperCase()},400);
  await call("manager","manager/merges",{...p,sourceIssueId:randomUUID()},404);
  pass("manager-only auth, same-origin writes, strict payload, versions and self-merge validation");

  await act("manager",a,"triage",{...triage,priority:"P2"});
  const original=(await db.query('SELECT status,priority,"dueAt","confirmedCategoryId","assigneeId","closedAt" FROM "Issue" WHERE id=$1',[a])).rows[0];
  const reportBefore=await reportSnapshot();
  assert.ok((await suggestions()).includes(a));
  const first=await merge(a,b);const mid=first.merge.mergeId;
  const second=await merge(c,b);
  const target=await detail(b),source=await detail(a);
  assert.equal(target.activeMerges.length,2);assert.equal(target.reports.length,3);
  assert.ok(target.activeMerges.some(m=>m.mergeId===mid));assert.equal(source.outgoingMerge.mergeId,mid);
  assert.ok(target.history.some(e=>e.details.mergeId===mid&&e.details.sourceIssueId===a&&e.details.targetIssueId===b));
  assert.equal((await call("manager","manager/issues?status=TRIAGED")).items.some(i=>i.issueId===a),false);
  assert.equal((await suggestions()).includes(a),false);
  assert.deepEqual(await reportSnapshot(),reportBefore);
  await call("manager","manager/merges",p,409);
  await act("manager",a,"assign",{assigneeId:users.staff.id},409);
  pass("one-level star merge returns reloadable merge IDs, logs both sides, hides sources from queues/AI and preserves all Reports");

  const d=await make();
  await call("manager","manager/merges",await params(b,d),409);
  await call("manager","manager/merges",await params(a,d),409);
  await call("manager","manager/merges",await params(d,a),409);
  await act("manager",d,"triage",triage);await act("manager",d,"assign",{assigneeId:users.staff.id});
  await call("manager","manager/merges",await params(d,b),409);
  await call("manager","manager/merges",await params(b,d),409);
  pass("duplicate, chained, cyclic and assigned-source/target merges are rejected");

  await awaiting(b);await act("manager",b,"close",{evidenceReviewed:true});
  const closedBefore=(await db.query('SELECT status,"closedAt",priority,"assigneeId","dueAt" FROM "Issue" WHERE id=$1',[b])).rows[0];
  await call("manager","manager/merges",await params(await make(),b),409);
  const reverse=await reverseInput(a,b);
  await call("staff",`manager/merges/${mid}/reverse`,reverse,403);
  await call("manager",`manager/merges/${mid}/reverse`,{...reverse,reason:" "},400);
  await call("manager",`manager/merges/${mid}/reverse`,reverse);
  const restored=await detail(a);assert.equal(restored.status,"TRIAGED");assert.equal(restored.reviewRequired,true);
  assert.deepEqual((await db.query('SELECT status,priority,"dueAt","confirmedCategoryId","assigneeId","closedAt" FROM "Issue" WHERE id=$1',[a])).rows[0],original);
  assert.deepEqual((await db.query('SELECT status,"closedAt",priority,"assigneeId","dueAt" FROM "Issue" WHERE id=$1',[b])).rows[0],closedBefore);
  assert.equal((await detail(b)).activeMerges.length,1);
  assert.ok((await detail(b)).mergeHistory.find(m=>m.id===mid).reversedAt);
  assert.equal((await detail(b)).activeMerges[0].mergeId,second.merge.mergeId);
  assert.ok((await suggestions()).includes(a));
  await call("manager",`manager/merges/${mid}/reverse`,await reverseInput(a,b),409);
  await act("manager",a,"triage",triage,409);await act("manager",a,"assign",{assigneeId:users.staff.id},409);
  const review={expectedVersion:restored.version,...triage,reason:"Đã kiểm tra đúng đối tượng và cần sửa riêng"};
  await call("reporter",`manager/issues/${a}/review-after-unmerge`,review,403);
  await call("manager",`manager/issues/${a}/review-after-unmerge`,{...review,categoryCode:"UNKNOWN"},400);
  const reviewed=await call("manager",`manager/issues/${a}/review-after-unmerge`,review);
  assert.equal(reviewed.issue.reviewRequired,false);assert.equal(reviewed.issue.status,"TRIAGED");
  await call("manager",`manager/issues/${a}/review-after-unmerge`,{...review,expectedVersion:reviewed.issue.version},409);
  assert.equal((await detail(a)).history.find(e=>e.eventType==="ISSUE_REVIEWED_AFTER_UNMERGE").details.mergeId,mid);
  const notReversed=await make("Cờ review không có lịch sử hủy gộp");
  await db.query('UPDATE "Issue" SET "reviewRequired"=true WHERE id=$1',[notReversed]);
  await call("manager",`manager/issues/${notReversed}/review-after-unmerge`,{...review,expectedVersion:(await detail(notReversed)).version},409);
  await act("manager",a,"assign",{assigneeId:users.staff.id});
  const afterReverseReports=new Map((await reportSnapshot()).map(({data})=>[data.id,data]));
  for(const {data} of reportBefore)assert.deepEqual(afterReverseReports.get(data.id),data);
  pass("reverse after target closure preserves source/target state, retains history, unlocks only after explicit manager review and then permits assignment");

  const indoor=(await db.query('SELECT a.id AS "areaId",a."floorId",f."buildingId" FROM "Area" a JOIN "Floor" f ON f.id=a."floorId" LIMIT 1')).rows[0];
  const precise="Phòng 2-15 - tủ điện phía Tây";
  const room=await make("Thiết bị không hoạt động",{kind:"INDOOR",...indoor,detail:precise});
  assert.equal((await detail(room)).reports[0].location.detail,precise);
  await act("manager",room,"triage",triage);await act("manager",room,"assign",{assigneeId:users.staff.id});
  assert.equal((await call("staff",`staff/issues/${room}`)).issue.reports[0].location.detail,precise);
  await act("manager",room,"return-to-triage",{reason:"Cần cập nhật đánh giá"});
  await act("manager",room,"triage",{...triage,priority:"P0"});assert.equal((await detail(room)).priority,"P0");
  await act("manager",b,"reopen",{reason:"Cần xem lại lần xử lý"});
  await act("manager",b,"triage",{...triage,priority:"P2"});assert.equal((await detail(b)).priority,"P2");
  pass("manager/staff detail retains precise indoor location and reopened/returned TRIAGED issues can be re-assessed");

  for(const mode of ["same-source","chain","cycle"]){
    const x=await make(mode+" X"),y=await make(mode+" Y"),z=await make(mode+" Z");
    const p1=await params(x,y),p2=await params(mode==="same-source"?x:y,mode==="cycle"?x:z);
    await checkRace([raw("manager","manager/merges",p1),raw("managerB","manager/merges",p2)],[201]);
    const rows=(await db.query('SELECT "sourceIssueId","targetIssueId" FROM "IssueMerge" WHERE "reversedAt" IS NULL AND "sourceIssueId"=ANY($1::uuid[])',[[x,y,z]])).rows;
    assert.equal(rows.length,1);
    pass(`concurrent ${mode} merges commit once and return 409 for the competing transaction`);
  }

  const s=await make("Assign race source"),t=await make("Assign race target");await act("manager",t,"triage",triage);
  const mp=await params(s,t),tv=(await detail(t)).version;
  await checkRace([raw("manager","manager/merges",mp),raw("managerB",`manager/issues/${t}/assign`,{expectedVersion:tv,assigneeId:users.staff.id})],[200,201]);
  pass("merge versus assignment shares Issue locks and a single event-count version");

  const rs=await make("Reverse race source"),rt=await make("Reverse race target"),rm=await merge(rs,rt),rp=await reverseInput(rs,rt);
  await checkRace([raw("manager",`manager/merges/${rm.merge.mergeId}/reverse`,rp),raw("managerB",`manager/merges/${rm.merge.mergeId}/reverse`,rp)],[200]);
  assert.equal((await detail(rs)).history.filter(e=>e.eventType==="ISSUE_UNMERGED").length,1);
  const rv={expectedVersion:(await detail(rs)).version,...triage,reason:"Rà lại sau hủy gộp"};
  await checkRace([raw("manager",`manager/issues/${rs}/review-after-unmerge`,rv),raw("managerB",`manager/issues/${rs}/review-after-unmerge`,rv)],[200]);
  assert.equal((await detail(rs)).history.filter(e=>e.eventType==="ISSUE_REVIEWED_AFTER_UNMERGE").length,1);
  pass("concurrent reverse/review each apply once and do not duplicate events");

  const cs=await make("Close race source"),ct=await make("Close race target"),cm=await merge(cs,ct);await awaiting(ct);
  const cr=await reverseInput(cs,ct),cv=(await detail(ct)).version;
  await checkRace([raw("manager",`manager/merges/${cm.merge.mergeId}/reverse`,cr),raw("managerB",`manager/issues/${ct}/close`,{expectedVersion:cv,evidenceReviewed:true})],[200]);
  pass("reverse versus close cannot both commit from the same target version");

  for(aiMode of ["error","timeout"]){
    const response=await call("reporter","duplicate-suggestions",{description:"Đèn không sáng",location:{kind:"OUTDOOR",detail:"Sân kiểm thử gộp"}});
    assert.equal(response.aiStatus,"unavailable");assert.deepEqual(response.suggestions,[]);
    await make("Report after AI "+aiMode);
  }
  aiMode="ok";
  pass("CP2 web fallback on AI 503 and timeout still permits Report creation");
  const active=(await db.query('SELECT "sourceIssueId","targetIssueId" FROM "IssueMerge" WHERE "reversedAt" IS NULL')).rows;
  const sources=new Set(active.map(m=>m.sourceIssueId));assert.equal(sources.size,active.length);assert.ok(active.every(m=>!sources.has(m.targetIssueId)));
  const originals=new Map(reportBefore.map(r=>[r.data.id,r.data]));
  for(const {data} of await reportSnapshot())if(originals.has(data.id))assert.deepEqual(data,originals.get(data.id));
  await writeFile(resolve("../merge-api-verification.json"),JSON.stringify({checks,scope:"Real merge/reverse/review APIs, Better Auth, PostgreSQL 17, real evidence image uploads; Candidate capture proxy forwards every request to real E5 FastAPI; model version, IDs and top5 checked"},null,2));
  console.log(`PASS merge API: ${checks.length} groups; active graph remains a one-level star and original Reports are unchanged.`);
}catch(error){
  console.error((error?.stack||String(error)).replaceAll(password,"[test-password]").replaceAll(dbPassword,"[db-password]"));
  console.error(logs.replaceAll(password,"[test-password]").replaceAll(dbPassword,"[db-password]"));process.exitCode=1;
}finally{
  if(web&&web.exitCode===null){const exited=once(web,"exit");web.kill();await exited;}
  if(ai?.listening)await new Promise(r=>ai.close(r));if(db)await db.end();if(started)await postgres.stop();
}
