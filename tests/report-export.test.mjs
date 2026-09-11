import {test} from 'node:test';import assert from 'node:assert/strict';import {reportCsv} from '../src/lib/report-export.ts';
test('CSV quotes newlines, quotes and separators',()=>{assert.equal(reportCsv([['a,b','a"b','a\nb']]),'\uFEFF"a,b","a""b","a\nb"');});
test('CSV protects spreadsheet formula cells',()=>{assert.equal(reportCsv([['=SUM(A1)',' +1','@cmd','-1']]),'\uFEFF"\'=SUM(A1)","\' +1","\'@cmd","\'-1"');});
