// Read-only probes against the original Catalog Check implementation.
// No spreadsheet is opened and no formula is executed.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../commerce/index.html'), 'utf8');
const start = html.indexOf('function parseCSV(');
const end = html.indexOf('function download(', start);
assert.ok(start >= 0 && end > start);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(html.slice(start, end), sandbox);
const { parseCSV, csvEncode, analyzeCSV } = sandbox;
const results = [];
function probe(name, run) { run(); results.push({ name, observed: true }); }
probe('A quoted CRLF becomes LF during parsing', () => {
  const input = 'sku,title,price\r\nA,"line one\r\nline two",2\r\n';
  assert.equal(parseCSV(input)[1][1], 'line one\nline two');
  assert.notEqual(parseCSV(input)[1][1], 'line one\r\nline two');
});
probe('Cleanup changes case, whitespace and price spelling', () => {
  const r = analyzeCSV(' SKU ,title,price\n A , padded ,002.5\n');
  assert.equal(r.errors, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(r.rows)), [['sku','title','price'],['A','padded','2.50']]);
});
probe('SKUs differing only in case are rejected as duplicates', () => {
  const r = analyzeCSV('sku,title,price\nA,first,2\na,second,3\n');
  assert.equal(r.errors, 1);
  assert.ok(r.findings.some(x => x.message.includes('Duplicate SKU')));
});
probe('An ASCII formula marker in a title blocks export', () => {
  assert.ok(analyzeCSV('sku,title,price\nA,=1+1,2\n').errors > 0);
});
probe('A formula-like extra header is accepted', () => {
  const r = analyzeCSV('sku,title,price,=1+1\nA,first,2,note\n');
  assert.equal(r.errors, 0);
  assert.ok(csvEncode(r.rows).split('\r\n')[0].endsWith(',=1+1'));
});
probe('A full-width equals sign in a title is accepted', () => {
  assert.equal(analyzeCSV('sku,title,price\nA,＝1+1,2\n').errors, 0);
});
console.log(JSON.stringify({ runtime: process.version, probes: results.length, results }, null, 2));
