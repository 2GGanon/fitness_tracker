const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

(async ()=>{
  const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
  const { window } = dom;
  // provide console forwarding
  window.console = console;
  // inject a simple localStorage shim if needed (jsdom provides one)
  // evaluate app.js in the window context
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = appJs;
  window.document.body.appendChild(scriptEl);

  // wait for DOMContentLoaded to run init
  await new Promise(r => setTimeout(r, 200));

  const history = window.document.getElementById('history');
  const btn = window.document.getElementById('toggleCalendarBtn');
  if(!history) return console.log('FAIL: #history not found')
  if(!btn) return console.log('FAIL: #toggleCalendarBtn not found')

  // initial visibility reported by updateCalendarVisibility after init
  const initiallyHidden = history.classList.contains('hidden');
  console.log('Initially hidden?', initiallyHidden);

  // simulate click
  btn.click();
  await new Promise(r => setTimeout(r, 50));
  const afterClickHidden = history.classList.contains('hidden');
  console.log('After click hidden?', afterClickHidden);

  // click again to toggle back
  btn.click();
  await new Promise(r => setTimeout(r, 50));
  const afterSecondClickHidden = history.classList.contains('hidden');
  console.log('After second click hidden?', afterSecondClickHidden);

  // decide pass/fail: after first click should be hidden (true)
  if(afterClickHidden === true) console.log('PASS: toggle hides calendar on first click')
  else console.log('FAIL: toggle did not hide calendar on first click')

})().catch(e=>{ console.error('Test error', e) });
