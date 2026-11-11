// Сборка веб-плеера: node web/build.js   (нужен только TypeScript: npm i -g typescript или npm i в папке web)
//
// Исходники (правьте их):           Что получается (не правьте руками, перезапишется):
//   web/js/*.js       ES-модули       android/app/src/main/assets/www/dist/app.js   — один скрипт для Android
//   web/css/styles.css                android/app/src/main/assets/www/css/styles.css
//   web/index.src.html разметка       android/app/src/main/assets/www/index.html
//   web/sw.js, web/manifest.webmanifest → www/ и app/
//                                     app/index.html — всё в одном файле: плеер на сайте, открывается и двойным кликом
// Версия берётся из web/package.json и подставляется в sw.js, лендинг (index.html) и Android-сборку.
const fs = require('fs'), path = require('path');
let ts;
for (const p of ['typescript', path.join(__dirname, 'node_modules/typescript'), '/opt/node22/lib/node_modules/typescript', '/opt/npm-tools/node_modules/typescript']) { try { ts = require(p); break; } catch { /* дальше */ } }
if (!ts) { console.error('Нужен TypeScript: npm i -g typescript'); process.exit(1); }
const ROOT = path.join(__dirname, '..'), WWW = path.join(ROOT, 'android/app/src/main/assets/www'), APP = path.join(ROOT, 'app');
const rd = p => fs.readFileSync(p, 'utf8'), wr = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const VERSION = JSON.parse(rd(path.join(__dirname, 'package.json'))).version;

// 1) модули → один скрипт
const dir = path.join(__dirname, 'js');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
let out = '(function(){"use strict";var defs={},cache={};function req(n){n=n.replace(/^\\.\\//,"");if(cache[n])return cache[n].exports;var m=cache[n]={exports:{}};defs[n](m,m.exports,req);return m.exports}\n';
for (const f of files) {
  const src = rd(path.join(dir, f)).replace(/__APP_VERSION__/g, VERSION);
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  out += `defs[${JSON.stringify(f)}]=function(module,exports,require){${js}\n};\n`;
}
out += 'req("app.js")})();\n';
wr(path.join(WWW, 'dist/app.js'), out);

// 2) стили, разметка, service worker, манифест
const css = rd(path.join(__dirname, 'css/styles.css'));
const shell = rd(path.join(__dirname, 'index.src.html'));
const sw = rd(path.join(__dirname, 'sw.js')).replace(/__VERSION__/g, VERSION);
const manifest = rd(path.join(__dirname, 'manifest.webmanifest'));
wr(path.join(WWW, 'css/styles.css'), css);
wr(path.join(WWW, 'index.html'), shell);
wr(path.join(WWW, 'sw.js'), sw);
wr(path.join(WWW, 'manifest.webmanifest'), manifest);

// 3) app/index.html — всё в одном файле
const LINK_CSS = '<link rel="stylesheet" href="css/styles.css">', SCRIPT = '<script src="dist/app.js"></script>';
if (!shell.includes(LINK_CSS) || !shell.includes(SCRIPT)) { console.error('index.src.html: нет ссылок на css/styles.css и dist/app.js'); process.exit(1); }
const single = shell.replace(LINK_CSS, () => '<style>\n' + css.trim() + '\n</style>').replace(SCRIPT, () => '<script>\n' + out.trim() + '\n</script>');
wr(path.join(APP, 'index.html'), single);
// для app/ офлайн-кэш — только сама страница, манифест и иконки
wr(path.join(APP, 'sw.js'), sw.replace(/'css\/styles\.css', 'dist\/app\.js', /, ''));
wr(path.join(APP, 'manifest.webmanifest'), manifest);
for (const ic of fs.readdirSync(path.join(WWW, 'icons'))) {
  fs.mkdirSync(path.join(APP, 'icons'), { recursive: true });
  fs.copyFileSync(path.join(WWW, 'icons', ic), path.join(APP, 'icons', ic));
}

// 4) версия на лендинге (<span data-version>…</span>)
const lp = path.join(ROOT, 'index.html');
if (fs.existsSync(lp)) {
  const land = rd(lp), next = land.replace(/(<span data-version>)[^<]*(<\/span>)/g, `$1версия ${VERSION}$2`).replace(/(<span data-v>)[^<]*(<\/span>)/g, `$1${VERSION}$2`);
  if (next !== land) wr(lp, next);
}
console.log(`Puro Cielo ${VERSION}: dist/app.js ${(out.length / 1024).toFixed(0)} KB, app/index.html ${(single.length / 1024).toFixed(0)} KB`);
