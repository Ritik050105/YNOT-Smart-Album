import fs from 'node:fs'; import sharp from 'sharp'; import assert from 'node:assert/strict'; import exifr from 'exifr';
const folder='C:/Users/ritik/AppData/Local/Temp/ynot-reference-workflow/mixed-72'; fs.mkdirSync(folder,{recursive:true});
for(let i=0;i<72;i++) {
 const [width,height]=[[900,600],[600,900],[700,700],[1200,400],[400,1000],[900,600]][i%6];
 const bw=Math.floor(i/6)%3===1; const color=bw?'#777777':`hsl(${i*37%360},60%,45%)`;
 const svg=`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}"/><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/3}" fill="white"/><text x="50%" y="52%" text-anchor="middle" font-size="80">${i+1}</text></svg>`;
 const date=new Date(Date.UTC(2026,9,22,8+Math.floor(i/18)*2,i%18)); const stamp=date.toISOString().slice(0,19).replace('T',' ').replaceAll('-' ,':');
 await sharp(Buffer.from(svg)).withExif({IFD0:{Model:Math.floor(i/9)%2?'Camera B':'Camera A'},IFD2:{DateTimeOriginal:stamp}}).jpeg().toFile(`${folder}/mixed-${String(i+1).padStart(3,'0')}.jpg`);
 const metadata=await exifr.parse(`${folder}/mixed-${String(i+1).padStart(3,'0')}.jpg`);
 assert.equal(metadata.Model,Math.floor(i/9)%2?'Camera B':'Camera A');
 assert.ok(metadata.DateTimeOriginal instanceof Date);
}
console.log(folder);
