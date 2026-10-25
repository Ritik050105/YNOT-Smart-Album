const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
fs.writeFileSync('admin-license/public-key.json', JSON.stringify(require('../dist-electron/licensePublicKey').licensePublicKey));
const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--projectDir', 'admin-license', '--win', '--config.directories.output=' + path.resolve(process.argv[2] || 'admin-license/release')], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
