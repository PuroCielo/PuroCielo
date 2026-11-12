const fs = require('node:fs');
const path = require('node:path');
require('../web/build.js');
const version = require('../web/package.json').version;
const packagePath = path.join(__dirname, 'package.json');
const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (metadata.version !== version) {
  metadata.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(metadata, null, 2) + '\n');
}
fs.cpSync(path.join(__dirname, '../app'), path.join(__dirname, 'renderer'), { recursive: true });
console.log(`Windows renderer: ${version}`);
