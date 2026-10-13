// Portable OOXML export in the browser, with no external dependency or service.
// All user content is stored as literal strings, never spreadsheet formulas.
const encoder = new TextEncoder();
const xml = (v) => String(v ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]);
const stamp = v => v ? new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(v)) : "";
const label = n => { let s=""; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; };
const crcTable = Uint32Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
function crc32(bytes) { let c=0xffffffff; for(const b of bytes)c=(c>>>8)^crcTable[(c^b)&255];return (c^0xffffffff)>>>0; }
function zip(files) {
  const chunks=[], directory=[]; let offset=0;
  const header=(size, entries)=>{const a=new Uint8Array(size),v=new DataView(a.buffer);for(const [at,value,bits] of entries)bits===16?v.setUint16(at,value,true):v.setUint32(at,value,true);return a;};
  for(const [name,text] of files){
    const n=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
    const local=header(30,[[0,0x04034b50],[4,20,16],[6,0x800,16],[12,0x21,16],[14,crc],[18,data.length],[22,data.length],[26,n.length,16]]);
    chunks.push(local,n,data);
    const central=header(46,[[0,0x02014b50],[4,20,16],[6,20,16],[8,0x800,16],[14,0x21,16],[16,crc],[20,data.length],[24,data.length],[28,n.length,16],[42,offset]]);
    directory.push(central,n);offset+=local.length+n.length+data.length;
  }
  const directorySize=directory.reduce((n,a)=>n+a.length,0);
  chunks.push(...directory,header(22,[[0,0x06054b50],[8,files.length,16],[10,files.length,16],[12,directorySize],[16,offset]]));
  const output=new Uint8Array(chunks.reduce((n,a)=>n+a.length,0));let at=0;for(const a of chunks){output.set(a,at);at+=a.length;}return output;
}
function expand(rows) {
  const pieces = value => {
    if (typeof value !== "string" || value.length <= 30000) return [value];
    const parts=[];
    for(let start=0;start<value.length;) {
      let end=Math.min(start+30000,value.length);
      if(end<value.length && /[\ud800-\udbff]/.test(value[end-1])) end--;
      parts.push(value.slice(start,end));start=end;
    }
    return parts;
  };
  return rows.flatMap(row=>{
    const columns=row.map(pieces),count=Math.max(1,...columns.map(c=>c.length));
    return Array.from({length:count},(_,part)=>columns.map(c=>c.length===1?c[0]:(c[part]||"")));
  });
}
function worksheet(sheet, title, exported) {
  const rows=[[title],[`출력 시각: ${stamp(exported)} (한국 시간)`],["파일 편집은 웹앱에 반영되지 않습니다. 긴 글은 셀 선택 또는 행 높이 조정으로 확인하세요."],sheet.headers,...expand(sheet.rows)];
  const end=`${label(sheet.headers.length-1)}${rows.length}`;
  const cells=rows.map((row,r)=>`<row r="${r+1}" ht="${r===0?28:r<4?32:sheet.long?76:30}" customHeight="1">${row.map((v,c)=>{
    const style=r===0?2:r<3?3:r===3?1:c===sheet.headers.length-1&&sheet.notes?5:4;
    return typeof v==="number"?`<c r="${label(c)}${r+1}" s="${style}"><v>${v}</v></c>`:`<c r="${label(c)}${r+1}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="1" ySplit="4" topLeftCell="B5" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${sheet.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${cells}</sheetData><autoFilter ref="A4:${end}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`;
}
export function buildRecordSheets(record) {
  const students=record.students||[],posts=record.posts||[],comments=record.comments||[], names=new Map(students.map(s=>[s.id,s.nickname]));
  const postMap=new Map(posts.map(p=>[p.id,p]));
  const fields=[[1,"memo","읽기 메모"],[2,"career","희망 분야"],[2,"topic","에세이 주제"],[2,"claim","주장"],[2,"outline","개요"],[2,"comparison","진로별 주제 비교"],[3,"draft","학생 초안"],[3,"revision","피드백 수용·수정 사유"],[3,"rejection","피드백 거절 사유"],[3,"keywords","수정 키워드"],[4,"title","완성 글 제목"],[4,"final","최종 에세이"],[4,"reflection","소감"],[4,"aiDisclosure","AI 활용 공개"]];
  const material=record.class?.material||{};
  return [
    {name:"학생 현황",headers:["별명","희망 분야","선택 주제","읽기 기록","초안 기록","완성 글 기록","AI 피드백 수","작성 댓글 수","최근 수정 (한국 시간)","교사 메모"],widths:[18,22,42,14,14,16,16,16,25,40],notes:true,rows:students.map(s=>[s.nickname,s.data?.career||"",s.data?.topic||"",s.data?.memo?"있음":"없음",s.data?.draft?"있음":"없음",s.data?.final?"있음":"없음",s.feedback?.length||0,comments.filter(c=>c.student_id===s.id).length,stamp(s.updated),""])},
    {name:"활동 상세",headers:["별명","단계","활동 항목","학생 작성 내용","교사 메모"],widths:[18,12,28,90,40],notes:true,long:true,rows:students.flatMap(s=>[...fields.map(([step,key,title])=>[s.nickname,`${step}단계`,title,s.data?.[key]||"",""]),[s.nickname,"2단계","주제 공유",s.data?.shareTopic?"공유":"미공유",""],[s.nickname,"3단계","초안 글자 확인",s.data?.ocrConfirmed?"확인":"미확인",""]])},
    {name:"AI 피드백",headers:["별명","피드백 번호","생성 시각 (한국 시간)","분석 당시 초안","AI 피드백 내용","교사 메모"],widths:[18,16,25,75,90,40],notes:true,long:true,rows:students.flatMap(s=>(s.feedback||[]).map((f,i)=>[s.nickname,i+1,stamp(f.created),f.draft,f.content,""]))},
    {name:"게시글",headers:["별명","희망 분야","제목","공유한 에세이","소감","공개 상태","게시 시각 (한국 시간)","교사 메모"],widths:[18,22,36,90,55,16,25,40],notes:true,long:true,rows:posts.map(p=>[names.get(p.student_id)||"",p.career,p.title,p.body,p.reflection,p.hidden?"숨김":"공개",stamp(p.created),""])},
    {name:"댓글",headers:["작성자 별명","대상 글 작성자","대상 글 제목","댓글 내용","공개 상태","작성 시각 (한국 시간)","교사 메모"],widths:[18,18,36,85,16,25,40],notes:true,long:true,rows:comments.map(c=>{const p=postMap.get(c.post_id);return[names.get(c.student_id)||"",names.get(p?.student_id)||"",p?.title||"",c.body,c.hidden?"숨김":"공개",stamp(c.created),""];})},
    {name:"공통 자료",headers:["항목","내용"],widths:[28,110],long:true,rows:[["수업 이름",record.class?.title||""],["수업 참여 코드",record.class?.code||""],["자료 제목",material.title||""],["공통 읽기 자료",material.body||""],["출처와 읽기 안내",material.source||""],["자료 유형",material.type||""],["긴 내용 읽기","긴 글은 셀 선택 후 수식 입력줄에서 확인하거나 행 높이를 늘려 읽을 수 있습니다. 30,000자를 넘는 값은 다음 행으로 이어집니다."],["교사 편집","교사 메모 열을 자유롭게 작성하세요. 이 파일은 다운로드 시점의 기록이며 파일 편집은 웹앱에 자동 반영되지 않습니다."]]},
  ];
}
export function exportRecordsXlsx(record, exported=new Date().toISOString()) {
  const sheets=buildRecordSheets(record), ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const files=[
    ["[Content_Types].xml",`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml",`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="15"/><color rgb="FF174B42"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174B42"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="0"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheet(s,record.class?.title||"학생 활동 기록",exported)]),
  ];
  return zip(files);
}
