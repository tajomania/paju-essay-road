import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {setup} from "./helpers.js";
import worker from "../src/worker.js";
import {exportRecordsXlsx,buildRecordSheets} from "../public/export-xlsx.js";
function entries(bytes) {
 const map=new Map(),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=0;
 while(view.getUint32(at,true)===0x04034b50){const size=view.getUint32(at+18,true),nameLength=view.getUint16(at+26,true),extra=view.getUint16(at+28,true);const name=new TextDecoder().decode(bytes.slice(at+30,at+30+nameLength));const start=at+30+nameLength+extra;map.set(name,new TextDecoder().decode(bytes.slice(start,start+size)));at=start+size;}
 return map;
}
test("Excel export is owned-teacher only and uses the existing record scope",async()=>{
 const t=setup(),a=await t.teacher("export-a"),b=await t.teacher("export-b"),c=await t.classroom(a.cookie),student=await t.student(c.code);
 await t.req("/work","PUT",{career:"건축",draft:"학생 직접 초안",revision:"수용 이유",rejection:"거절 이유"},student.cookie);
 const req=cookie=>worker.fetch(new Request(`https://test.example/api/classes/${c.id}/export`,{headers:{Cookie:cookie}}),t.env);
 try{assert.equal((await req(student.cookie)).status,403);assert.equal((await req(b.cookie)).status,403);
 const r=await req(a.cookie);assert.equal(r.status,200);assert.match(r.headers.get("content-type"),/application\/json/);
 const files=entries(exportRecordsXlsx(await r.json()));assert.match(files.get("xl/worksheets/sheet2.xml"),/학생 직접 초안/);assert.match(files.get("xl/worksheets/sheet2.xml"),/수용 이유/);assert.match(files.get("xl/worksheets/sheet2.xml"),/거절 이유/);
 }finally{t.db.close();}
});
test("Excel preserves Korean, line breaks, long content and literal formula-like text without secrets",()=>{
 const long="가".repeat(29999)+"😀"+"나".repeat(100);
 const record={class:{title:"검증 수업",code:"TEST",material:{title:"파주",body:"공통 읽기 자료"}},students:[{id:"s",nickname:"학생<1>",password:"PRIVATE_PASSWORD",data:{career:"건축",memo:"읽기 메모\n두 번째 줄",draft:"=HYPERLINK(악성주소)",final:long},updated:"2026-10-14T00:00:00.000Z",feedback:[{draft:"직접 쓴 글",content:"AI 수정 과제",created:"2026-10-14T00:00:00.000Z"}]}],posts:[{id:"p",student_id:"s",title:"완성 글",body:"직접 완성한 글",reflection:"소감",hidden:1}],comments:[{post_id:"p",student_id:"s",body:"친구 댓글",hidden:0}]};
 const bytes=exportRecordsXlsx(record,"2026-10-14T00:00:00.000Z"),files=entries(bytes);
 assert.equal(buildRecordSheets(record).length,6);const text=[...files.values()].join("\n");assert.ok(text.includes("학생&lt;1&gt;"));assert.ok(text.includes("읽기 메모\n두 번째 줄"));assert.ok(text.includes("=HYPERLINK"));assert.ok(!text.includes("<f>"));assert.ok(!text.includes("PRIVATE_PASSWORD"));assert.ok(text.includes("2026-10-14 09:00:00"));assert.ok(text.includes("😀"));
 if(process.env.EXPORT_QA_FILE)fs.writeFileSync(process.env.EXPORT_QA_FILE,bytes);
});
