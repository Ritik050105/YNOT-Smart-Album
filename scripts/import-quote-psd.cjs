const fs=require('node:fs'),assert=require('node:assert/strict'),psd=require('ag-psd'),sharp=require('sharp');
psd.initializeCanvas(()=>{throw new Error('Canvas rendering is not used')},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
(async()=>{
 const doc=psd.readPsd(fs.readFileSync(process.argv[2]),{useImageData:true,skipCompositeImageData:true,skipThumbnail:true}),leaves=n=>n.children?n.children.flatMap(leaves):n.text?[n]:[],groups=[];
 for(const [i,n] of doc.children.entries()){
  if(n.name==='Background')continue;const layers=leaves(n);if(!layers.length)continue;
  const left=Math.min(...layers.map(l=>l.left)),top=Math.min(...layers.map(l=>l.top)),right=Math.max(...layers.map(l=>l.right)),bottom=Math.max(...layers.map(l=>l.bottom));
  const group={id:'psd-quote-'+i,name:n.name,width:right-left,height:bottom-top,layers:[]};
  for(const l of layers){const t=l.text,s=t.style||{},tr=t.transform||[1,0,0,1],data=l.imageData;assert(data&&data.width&&data.height,'Original PSD glyph pixels required');
   const png=await sharp(Buffer.from(data.data),{raw:{width:data.width,height:data.height,channels:4}}).png().toBuffer();
   group.layers.push({text:t.text,x:l.left-left,y:l.top-top,width:l.right-l.left,height:l.bottom-l.top,fontFamily:s.font?.name||'Georgia',fontSize:(s.fontSize||30)*Math.hypot(tr[2],tr[3]),bold:!!s.fauxBold,italic:!!s.fauxItalic,color:s.fillColor||{r:0,g:0,b:0},artwork:'data:image/png;base64,'+png.toString('base64')});
  }
  assert(group.width>0&&group.height>0);groups.push(group);
 }
 fs.writeFileSync('src/data/quoteGroups.json',JSON.stringify(groups));console.log(groups.length+' intact PSD compositions extracted with original glyph artwork');
})().catch(e=>{console.error(e);process.exitCode=1});
