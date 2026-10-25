const path = require('node:path'), fs = require('node:fs/promises'), assert = require('node:assert/strict');
if (!process.versions.electron) {
  (async () => {
    const out = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'ynot-text-location-'));
    const result = await require('esbuild').build({stdin:{contents:"import {useProjectStore} from './src/state/projectStore';window.store=useProjectStore",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'browser',loader:{'.png':'dataurl','.icc':'dataurl'}});
    await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles[0].text);
    await fs.writeFile(path.join(out,'index.html'),'<script src="fixture.js"></script>');
    for (const phase of ['write','read','invalid','broken']) {
      const result = require('node:child_process').spawnSync(require('electron'),[__filename,out,phase],{encoding:'utf8',timeout:60000,windowsHide:true});
      assert.equal(result.status,0,result.stderr || result.stdout || String(result.error));
    }
    console.log('Remembered text survived a full Electron restart; invalid storage and project/history isolation checks passed.');
  })().catch(error => { console.error(error); process.exitCode=1 });
} else {
  const {app,BrowserWindow}=require('electron'),out=process.argv[2],phase=process.argv[3];
  app.setPath('userData',path.join(out,'profile'));app.disableHardwareAcceleration();
  app.whenReady().then(async()=>{
    const win=new BrowserWindow({show:false,webPreferences:{offscreen:true}});
    const load=()=>win.loadFile(path.join(out,'index.html')),run=code=>win.webContents.executeJavaScript(code);
    await load();
    const before=await run('JSON.stringify({project:store.getState().project,history:store.getState().history,future:store.getState().future})');
    if(phase==='write') {
      await run("store.setState({lastLocatedTextIds:{spreadA:'textA',spreadB:'textB'}})");
      assert.deepEqual(await run("JSON.parse(localStorage.getItem('albumstudio.lastLocatedTextIds'))"),{spreadA:'textA',spreadB:'textB'});
      assert.equal(await run('JSON.stringify({project:store.getState().project,history:store.getState().history,future:store.getState().future})'),before);
    } else if(phase==='read') {
      assert.deepEqual(await run('store.getState().lastLocatedTextIds'),{spreadA:'textA',spreadB:'textB'});
      assert.deepEqual(await run('({history:store.getState().history,future:store.getState().future,located:store.getState().locatedTextBox})'),{history:[],future:[],located:null});
    } else {
      await run(`localStorage.setItem('albumstudio.lastLocatedTextIds',${JSON.stringify(phase==='invalid'?'{"spreadA":"textA","bad":42,"empty":""}':'{broken')})`);
      await load();
      assert.deepEqual(await run('store.getState().lastLocatedTextIds'),phase==='invalid'?{spreadA:'textA'}:{});
    }
    win.webContents.session.flushStorageData();win.destroy();app.quit();
  }).catch(error=>{console.error(error);app.exit(1)});
}
