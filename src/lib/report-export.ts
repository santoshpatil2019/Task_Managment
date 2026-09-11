export function reportCsv(rows: unknown[][]): string {
 return '\uFEFF'+rows.map(row=>row.map(value=>{const raw=String(value??'');const safe=/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
}
export function downloadCsv(filename:string,rows:unknown[][]){
 const url=URL.createObjectURL(new Blob([reportCsv(rows)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
