import {test} from "node:test";
import assert from "node:assert/strict";
import {runGemini} from "../src/gemini.js";
const input={messages:[{role:"system",content:"연결 확인만 답하세요."},{role:"user",content:"연결 확인"}],max_completion_tokens:60};
test("transient Google service failures retry and recover",async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>++calls<3?Response.json({error:{message:"temporary"}},{status:503}):Response.json({candidates:[{finishReason:"STOP",content:{parts:[{text:"연결 확인"}]}}]});
 try{assert.equal((await runGemini("test-key","gemini-3.5-flash-lite",input)).choices[0].message.content,"연결 확인");assert.equal(calls,3);}finally{globalThis.fetch=original;}
});
test("persistent 503 is distinguished from credential failure and attempts are bounded",async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({error:{message:"temporary"}},{status:503})};
 try{await assert.rejects(runGemini("test-key","gemini-3.5-flash-lite",input),e=>e.status===503&&/Google HTTP 503.*TEMPORARY_UNAVAILABLE/.test(e.message));assert.equal(calls,3);}finally{globalThis.fetch=original;}
});
test("invalid key, billing and quota errors are classified without retries or leaking responses",async()=>{
 const original=globalThis.fetch;
 try{for(const [status,message,code] of [[400,"API key not valid. secret-project KEY-SECRET","KEY_INVALID"],[400,"Free tier is not available in your country. Please enable billing. secret-project","BILLING"],[403,"restricted secret-project","PERMISSION"],[429,"quota secret-project","QUOTA"]]){
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:{message}},{status})};
 await assert.rejects(runGemini("test-key","gemini-3.5-flash-lite",input),e=>e.message.includes(code)&&!e.message.includes("secret-project")&&!e.message.includes("KEY-SECRET"));assert.equal(calls,1);
 }}finally{globalThis.fetch=original;}
});

test("connection test has a shorter timeout and an explicit timeout diagnosis",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(_url,init)=>{assert.ok(init.signal);throw Object.assign(new Error("timeout"),{name:"TimeoutError"})};
 try{await assert.rejects(runGemini("test-key","gemini-3.5-flash-lite",input),e=>e.status===504&&e.message.includes("GOOGLE_TIMEOUT"));}finally{globalThis.fetch=original;}
});
