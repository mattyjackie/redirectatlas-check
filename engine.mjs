// Deterministic redirect-map analysis. Never visits URLs or changes a website.
export function parseCSV(text) {
 if(typeof text!=='string'||text.length>4_000_000) throw new Error('Use a CSV smaller than 4 MB.');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else field+=c;}else if(c==='"'){if(field||closed)throw new Error('Unexpected quote in CSV.');quoted=true;}else if(c===','){row.push(field);field='';closed=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';closed=false;}else{if(closed)throw new Error('Unexpected characters after a closing CSV quote.');field+=c;}}
 if(quoted)throw new Error('CSV has an unclosed quote.');row.push(field);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function normalize(value,base='https://example.invalid'){
 const s=String(value??'').trim();if(!s||s.length>2048||/[\s\\\u0000-\u001f]/.test(s)||s.startsWith('//')||(!s.startsWith('/')&&!/^https?:\/\//i.test(s)))return null;
 try{const u=new URL(s,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;return {key:u.origin+u.pathname+u.search,path:u.pathname+u.search,fragment:!!u.hash,external:u.origin!==new URL(base).origin};}catch{return null;}
}
export function analyze(text,{base='https://example.invalid',limit=10000}={}){
 const b=normalize(base);if(!b||!/^https?:\/\//.test(base))throw new Error('Enter a valid source site URL, such as https://example.com.');
 const table=parseCSV(text);if(!table.length)throw new Error('Add a redirect CSV first.');
 const headers=table[0].map(v=>v.trim().toLowerCase());let si=headers.findIndex(v=>['redirect from','source','from','old url','source url'].includes(v));let ti=headers.findIndex(v=>['redirect to','target','to','new url','destination','destination url'].includes(v));
 if(si<0||ti<0)throw new Error('CSV needs Source and Target headers (Shopify Redirect from / Redirect to also work).');
 if(table.length-1>limit)throw new Error('This audit supports up to '+limit.toLocaleString()+' rows.');
 if(table.length<2)throw new Error('The CSV has headers but no redirect rows.');
 const rows=table.slice(1).map((r,i)=>({row:i+2,source:r[si]?.trim()||'',target:r[ti]?.trim()||'',issues:[],s:normalize(r[si],base),t:normalize(r[ti],base)}));
 const bySource=new Map();for(const r of rows){if(!r.s||!r.t)r.issues.push('invalid_url');if(r.s){const bucket=bySource.get(r.s.key)||[];bucket.push(r);bySource.set(r.s.key,bucket);}if(r.s?.fragment||r.t?.fragment)r.issues.push('fragment');if(r.t?.external)r.issues.push('external_target');if(r.s&&r.t&&r.s.key===r.t.key)r.issues.push('self_redirect');}
 for(const bucket of bySource.values())if(bucket.length>1){const conflict=new Set(bucket.map(r=>r.t?.key||r.target)).size>1;for(const r of bucket)r.issues.push(conflict?'conflicting_source':'duplicate');}
 for(const r of rows){if(!r.s||!r.t)continue;let key=r.t.key;const seen=new Set([r.s.key]);let hops=1;
  while(bySource.has(key)){if(seen.has(key)){if(!r.issues.includes('self_redirect'))r.issues.push('loop');break;}seen.add(key);const bucket=bySource.get(key);if(new Set(bucket.map(x=>x.t?.key)).size!==1||!bucket[0].t){r.issues.push('ambiguous_chain');break;}key=bucket[0].t.key;hops++;if(hops>100){r.issues.push('long_chain');break;}}
  if(hops>1)r.issues.push('chain');r.hops=hops;r.final=key;
 }
 const counts={};for(const r of rows)for(const x of r.issues)counts[x]=(counts[x]||0)+1;
 const blocking=new Set(['invalid_url','self_redirect','conflicting_source','loop','ambiguous_chain','long_chain']);
 const output=rows.map(({s,t,...r})=>({...r,severity:r.issues.some(x=>blocking.has(x))?'error':r.issues.length?'review':'clear'}));
 return {rows:output,total:rows.length,errors:output.filter(r=>r.severity==='error').length,review:output.filter(r=>r.severity==='review').length,clear:output.filter(r=>r.severity==='clear').length,counts};
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function reportCSV(result){return [['Row','Source','Target','Severity','Findings','Hops','Terminal URL'],...result.rows.map(r=>[r.row,r.source,r.target,r.severity,r.issues.join('; '),r.hops||'',r.final||''])].map(r=>r.map(csvCell).join(',')).join('\r\n');}
export const descriptions={invalid_url:'Missing or invalid URL',self_redirect:'Redirects to itself',conflicting_source:'Same source, different destinations',duplicate:'Repeated redirect',loop:'Redirect loop',chain:'More than one redirect hop',ambiguous_chain:'Chain reaches conflicting or invalid rule',long_chain:'Chain exceeds 100 hops',fragment:'Fragment needs manual review',external_target:'Destination is on another origin'};
