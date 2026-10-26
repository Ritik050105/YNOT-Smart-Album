const fs = require('fs'), path = require('path');
const file = path.resolve(process.argv[2] || 'package.json');
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
if(config.name !== 'ynot-album-studio') throw Error('Choose the YNOT-Mac-Source folder.');
config.build.asarUnpack = [...new Set([...(config.build.asarUnpack || []), 'node_modules/sharp/**/*', 'node_modules/@img/**/*'])];
config.build.mac.target = ['dmg'];
if(!fs.existsSync(file+'.before-sharp-fix')) fs.copyFileSync(file,file+'.before-sharp-fix');
fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
console.log('Fixed Sharp unpacking and native-only Mac build target.');
