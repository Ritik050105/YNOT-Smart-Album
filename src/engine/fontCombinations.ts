import {TextBox, TextEffect} from '@/types'
// Original editable combinations, using the bundled OFL font families.
const pairs=[
 ['Scary story','SCARY','story','Creepster','Caveat','#202020','#e34b55'],
 ['Custom paint','CUSTOM','PAINT','Bebas Neue','Bangers','#707070','#ef712e'],
 ['Rock','ROCK','YOUR WORLD','Bangers','Montserrat','#08a9bf','#202020'],
 ['Bold moves','BOLD','MOVES','Bangers','Oswald','#ee5028','#147184'],
 ['Spooky','SPOOKY','NIGHTS','Creepster','Bebas Neue','#82ad24','#563e75'],
 ['Glitch','static','SIGNAL','Rubik Glitch','Montserrat','#789b15','#292929'],
 ['Forever together','FOREVER','together','Playfair Display','Great Vibes','#563d48','#826752'],
 ['Our story','OUR','story','Montserrat','Dancing Script','#303030','#a77c56'],
 ['Save the date','SAVE THE DATE','for our forever','Montserrat','Great Vibes','#333333','#93694d'],
 ['Wedding day','Wedding','DAY','Great Vibes','Montserrat','#603d4b','#603d4b'],
 ['Just married','JUST','married','Bebas Neue','Dancing Script','#303030','#a56865'],
 ['Golden hour','GOLDEN','hour','Marcellus','Caveat','#9a772e','#493a28'],
 ['Little miracle','Little','MIRACLE','Pacifico','Montserrat','#62867c','#485c57'],
 ['Birthday wishes','HAPPY','birthday','Bangers','Pacifico','#d35060','#c98e23'],
 ['Adventure awaits','ADVENTURE','awaits','Oswald','Caveat','#315958','#bd792f'],
 ['The journey','THE JOURNEY','begins here','Bebas Neue','Dancing Script','#343434','#777777'],
 ['Sweet memories','Sweet','MEMORIES','Great Vibes','Montserrat','#9b687d','#553948'],
 ['Class of tomorrow','CLASS OF','TOMORROW','Oswald','Montserrat','#273b65','#aa803e'],
 ['Live music','LIVE','music','Bangers','Caveat','#bc4537','#303030'],
 ['Summer days','SUMMER','days','Bebas Neue','Pacifico','#db7836','#368d94'],
 ['Thank you','Thank you','WITH ALL OUR HEARTS','Great Vibes','Montserrat','#5b4d65','#5b4d65'],
 ['Family forever','FAMILY','forever','Marcellus','Dancing Script','#334d43','#927450'],
 ['Love and laughter','LOVE','& laughter','Playfair Display','Caveat','#66464e','#b57666'],
 ['New beginnings','NEW','beginnings','Montserrat','Great Vibes','#4c6475','#927d6b'],
]
// Canvas-reference recreations use editable type, not flattened screenshots.
// shortcut: bundled font substitutes approximate proprietary lettering; replace only with licensed fonts.
type Lettering = Pick<TextBox,'text'|'fontFamily'|'fontSize'|'color'> & Partial<TextBox>
const stroke=(color:string,size:number):TextEffect=>({enabled:true,color,size,opacity:1,angle:0,distance:0,position:'outside'})
const shadow=(color:string,distance:number,size=0):TextEffect=>({enabled:true,color,size,opacity:1,angle:45,distance})
const references:Record<number,Lettering[]>={
 0:[{text:'SCARY',fontFamily:'Creepster',fontSize:112,color:'#101010',height:120}, {text:'story',fontFamily:'Caveat',fontSize:94,color:'#ff5365',italic:true,bold:true,y:104,height:110,rotationDeg:-5}],
 1:[{text:'CUSTOM',fontFamily:'Bebas Neue',fontSize:64,color:'#888888',italic:true,height:70}, {text:'PAINT',fontFamily:'Bangers',fontSize:116,color:'#f56b2c',y:62,height:130,rotationDeg:-6}],
 2:[{text:'ROCK',fontFamily:'Bangers',fontSize:128,color:'#ffffff',height:155,effects:{stroke:stroke('#00acc1',17)},rotationDeg:-5}],
 3:[{text:'BOLD',fontFamily:'Bangers',fontSize:102,color:'#f0652c',italic:true,height:110,rotationDeg:-7}, {text:'MOVES',fontFamily:'Bangers',fontSize:102,color:'#13738b',italic:true,y:92,height:115,rotationDeg:-7}],
 4:[{text:'SPOOKY',fontFamily:'Creepster',fontSize:102,color:'#d4f51e',height:130,rotationDeg:-7,effects:{stroke:stroke('#ff861c',10)}}],
 5:[{text:'static',fontFamily:'Rubik Glitch',fontSize:98,color:'#c8ff05',height:130,effects:{stroke:stroke('#101010',14)}}],
 24:[{text:'BOO!',fontFamily:'Bangers',fontSize:124,color:'#f97b35',height:155,effects:{dropShadow:shadow('#ba9bda',10)}}],
 25:[{text:'Thank',fontFamily:'Caveat',fontSize:94,color:'#2668b2',bold:true,italic:true,height:105,rotationDeg:-5}, {text:'you!',fontFamily:'Caveat',fontSize:94,color:'#2668b2',bold:true,italic:true,y:80,height:110,rotationDeg:-5}],
 26:[{text:'FIRE',fontFamily:'Bangers',fontSize:110,color:'#f27839',italic:true,height:120,rotationDeg:-6}, {text:'away',fontFamily:'Caveat',fontSize:84,color:'#7b7b7b',bold:true,italic:true,y:94,height:100,rotationDeg:-6}],
 27:[{text:'Coffee Break',fontFamily:'Playfair Display',fontSize:65,color:'#14724f',bold:true,height:95}],
 28:[{text:'A day in',fontFamily:'Playfair Display',fontSize:65,color:'#ad87e1',bold:true,height:80}, {text:'my life',fontFamily:'Caveat',fontSize:85,color:'#ad87e1',bold:true,italic:true,y:65,height:105}],
 29:[{text:'PIXEL',fontFamily:'Rubik Glitch',fontSize:78,color:'#cf69da',height:90,effects:{dropShadow:shadow('#8ce9ee',3)}}, {text:'DREAMS',fontFamily:'Rubik Glitch',fontSize:78,color:'#8ce9ee',y:78,height:95,effects:{dropShadow:shadow('#cf69da',3)}}],
 30:[{text:'player',fontFamily:'Montserrat',fontSize:81,color:'#ed35ce',bold:true,italic:true,height:100,effects:{dropShadow:shadow('#65dfea',3)}}, {text:'one',fontFamily:'Montserrat',fontSize:81,color:'#ed35ce',bold:true,italic:true,y:81,height:100,effects:{dropShadow:shadow('#65dfea',3)}}],
 31:[{text:'Happy',fontFamily:'Caveat',fontSize:80,color:'#141414',bold:true,height:95}, {text:'BIRTHDAY',fontFamily:'Montserrat',fontSize:60,color:'#141414',bold:true,y:80,height:85}],
}
const referenceNames=['BOO!','Thank you! — Blue brush','Fire away','Coffee Break','A day in my life','Pixel Dreams','Player one','Happy Birthday']

// Four distinct type treatments per phrase: editorial, script, poster and caption.
const collectionPhrases=[
 ['Wedding','Forever','starts today'],['Wedding','Together','is our favorite place'],
 ['Wedding','Our promise','a lifetime of love'],['Wedding','Just us','and forever'],
 ['Wedding','The beginning','of our always'],['Wedding','Two hearts','one beautiful story'],
 ['Wedding','I choose you','today and every day'],['Wedding','Made for love','made for each other'],
 ['Wedding','Better together','a love worth celebrating'],['Wedding','Always yours','from this day forward'],
 ['Wedding','Happily ever after','begins with us'],['Wedding','With all my heart','now and always'],
 ['Engagement','We said yes','to a lifetime together'],['Engagement','The next chapter','our forever begins'],
 ['Engagement','A perfect match','two souls one journey'],['Engagement','You and me','the sweetest beginning'],
 ['Reception','Celebrate love','a night to remember'],['Reception','Cheers to us','love laughter and dancing'],
 ['Reception','Under the stars','we danced into forever'],['Reception','The afterglow','of a perfect day'],
 ['Family','Our little world','full of great love'],['Family','Home','is where we belong'],
 ['Family','Family moments','the memories we keep'],['Family','Growing together','one day at a time'],
 ['Family','The good days','are the days with you'],['Family','Roots and wings','a story of belonging'],
 ['Maternity','Hello little one','we have been waiting'],['Maternity','Tiny moments','the biggest love'],
 ['Maternity','A new adventure','begins with you'],['Maternity','Love grows here','one heartbeat at a time'],
 ['Birthday','Make a wish','your story shines on'],['Birthday','Another chapter','another beautiful year'],
 ['Birthday','Born to shine','today is all about you'],['Birthday','Let us celebrate','a little joy a lot of cake'],
 ['Birthday','Sweet sixteen','a world of possibilities'],['Birthday','Stay golden','the best is yet to come'],
 ['Travel','Wander often','wonder always'],['Travel','Lost in the moment','found in the journey'],
 ['Travel','Chasing sunsets','collecting memories'],['Travel','Into the wild','where our hearts wander'],
 ['Travel','Ocean air','and a little adventure'],['Travel','Take the scenic route','there is beauty everywhere'],
 ['Travel','Somewhere new','something unforgettable'],['Travel','Meet me here','beneath an endless sky'],
 ['Editorial','Slow mornings','simple pleasures'],['Editorial','Quiet beauty','in the everyday'],
 ['Editorial','Less but better','make room for meaning'],['Editorial','A little magic','hidden in plain sight'],
 ['Editorial','In full bloom','a season of becoming'],['Editorial','The art of living','one beautiful detail'],
 ['Editorial','Sunday stories','moments worth keeping'],['Editorial','Coffee and calm','take a moment for yourself'],
 ['Concert','Turn it up','feel every beat'],['Concert','Live tonight','a night made for music'],
 ['Concert','Sound and soul','let the rhythm find you'],['Concert','After hours','the city comes alive'],
 ['Celebration','Dream big','begin where you are'],['Celebration','You did it','the future is yours'],
 ['Celebration','New horizons','an extraordinary beginning'],['Celebration','Thank you','for being part of our story'],
 ['Promotional','Fresh ideas','made to stand out'],['Promotional','Create boldly','make something meaningful'],
 ['Promotional','The new collection','discover your next favorite'],['Promotional','Good things ahead','watch this space'],
 ['Promotional','Made with care','crafted for you'],['Promotional','Your next chapter','starts right here'],
 ['Promotional','Be unforgettable','leave a little inspiration'],
 ['Wedding','Written in the stars','a love beyond words'],
 ['Wedding','The sweetest vow','to love and to cherish'],
 ['Wedding','All roads led to you','our beautiful destination'],
 ['Wedding','A thousand forevers','would never be enough'],
 ['Wedding','Love in every detail','a day made just for us'],
 ['Wedding','Hand in hand','into our next adventure'],
 ['Wedding','Until the end of time','my heart is yours'],
 ['Wedding','This kind of love','feels like coming home'],
 ['Wedding','One wonderful day','a lifetime to remember'],
 ['Wedding','Where love begins','our story unfolds'],
 ['Engagement','The easiest yes','to my favorite person'],
 ['Engagement','Officially forever','let the countdown begin'],
 ['Engagement','A ring and a promise','a future full of love'],
 ['Engagement','Soon to be us','a beautiful life together'],
 ['Engagement','Our forever date','mark your calendar'],
 ['Reception','Dance with me','until the morning light'],
 ['Reception','Raise your glass','to all the years ahead'],
 ['Reception','Love lights the night','let the celebration begin'],
 ['Reception','An evening to cherish','surrounded by our people'],
 ['Reception','The last dance','the first of many memories'],
 ['Family','Small joys','big family memories'],
 ['Family','Our happy place','right here together'],
 ['Family','All of us','a love like no other'],
 ['Family','Generations of love','a legacy worth keeping'],
 ['Family','The everyday treasures','that make a life'],
 ['Family','Life around our table','stories laughter and love'],
 ['Family','Side by side','through every season'],
 ['Family','Little traditions','lasting memories'],
 ['Maternity','Before we meet','we already love you'],
 ['Maternity','Waiting for you','our most precious chapter'],
 ['Maternity','The tiniest heartbeat','the greatest adventure'],
 ['Maternity','A little more love','is on the way'],
 ['Maternity','Soon in our arms','always in our hearts'],
 ['Birthday','Confetti moments','a day bursting with joy'],
 ['Birthday','Another trip around','the sun looks good on you'],
 ['Birthday','Cake and candles','wishes and wonderful things'],
 ['Birthday','A year of wonder','so much more to come'],
 ['Birthday','Your golden chapter','celebrate every moment'],
 ['Birthday','Young at heart','and full of possibility'],
 ['Birthday','A toast to today','and everything ahead'],
 ['Birthday','Let joy lead','it is your special day'],
 ['Travel','Beyond the horizon','there is a story waiting'],
 ['Travel','Postcards from paradise','wish you were here'],
 ['Travel','Miles of memories','one extraordinary journey'],
 ['Travel','Wild and free','follow the open road'],
 ['Travel','Beneath the palms','time moves a little slower'],
 ['Travel','Mountain mornings','a breath of something new'],
 ['Travel','City of dreams','find your own rhythm'],
 ['Travel','Out of the ordinary','into the unforgettable'],
 ['Editorial','Perfectly imperfect','beautiful in your own way'],
 ['Editorial','A softer pace','space to simply be'],
 ['Editorial','Collected moments','a journal of little wonders'],
 ['Editorial','Light and shadow','the poetry of the everyday'],
 ['Editorial','Season of change','room for something new'],
 ['Editorial','Considered details','a quiet kind of luxury'],
 ['Editorial','Stories in color','see the world differently'],
 ['Editorial','A fresh perspective','find beauty in the familiar'],
 ['Concert','Feel the sound','let the night take over'],
 ['Concert','On the main stage','made for this moment'],
 ['Concert','Electric evenings','music that moves you'],
 ['Concert','One more song','one unforgettable night'],
 ['Concert','Meet at midnight','where the music never ends'],
 ['Celebration','A moment of pride','you earned every bit'],
 ['Celebration','Here is to tomorrow','and all that you will be'],
 ['Celebration','Milestones and memories','celebrate the journey'],
 ['Celebration','A bright new start','the world is waiting'],
 ['Celebration','Look how far','your dreams have taken you'],
 ['Promotional','Something extraordinary','is coming your way'],
 ['Promotional','Designed for living','made for your everyday'],
 ['Promotional','Discover the difference','details that matter'],
 ['Promotional','A bold new season','make it your own'],
 ['Promotional','Small batch','big on character'],
 ['Promotional','Freshly inspired','thoughtfully created'],
 ['Promotional','Your signature style','beautifully individual'],
 ['Promotional','The next big thing','starts with a little idea'],
]
const treatmentNames=['Editorial','Signature','Bold poster','Modern caption']
function collectionLettering(index:number):Lettering[]{
 const [,heading,caption]=collectionPhrases[Math.floor(index/4)],style=index%4
 const palettes=[['#553b4b','#a16a75'],['#254d48','#8c7447'],['#293c64','#b36c3e'],['#49335b','#976aab']]
 const [ink,accent]=palettes[Math.floor(index/4)%palettes.length]
 const titleSize=Math.min(style===2?86:70,480/(heading.length*.65))
 const captionSize=Math.min(29,480/(caption.length*.58))
 if(style===0)return [
  {text:heading.toUpperCase(),fontFamily:'Marcellus',fontSize:titleSize,color:ink,height:95,letterSpacing:1},
  {text:caption,fontFamily:'EB Garamond',fontSize:captionSize,color:accent,italic:true,y:104,height:55},
 ]
 if(style===1)return [
  {text:heading,fontFamily:'Great Vibes',fontSize:titleSize+10,color:ink,height:110},
  {text:caption.toUpperCase(),fontFamily:'Montserrat',fontSize:captionSize*.8,color:accent,y:122,height:50,letterSpacing:1},
 ]
 if(style===2)return [
  {text:heading.toUpperCase(),fontFamily:'Bangers',fontSize:titleSize,color:accent,height:110,rotationDeg:-4,effects:{dropShadow:shadow(ink,3)}},
  {text:caption,fontFamily:'Caveat',fontSize:captionSize*1.25,color:ink,bold:true,y:120,height:65},
 ]
 return [
  {text:caption.toUpperCase(),fontFamily:'Montserrat',fontSize:captionSize*.8,color:accent,align:'left',height:55,letterSpacing:.6},
  {text:heading,fontFamily:'Playfair Display',fontSize:titleSize,color:ink,bold:true,align:'left',y:65,height:100},
 ]
}

export function fontCombinations(aspect:number){
 const height=900/(Number.isFinite(aspect)&&aspect>0?aspect:1)
 return [...pairs.map(p=>p[0]),...referenceNames,...collectionPhrases.flatMap(([,heading])=>treatmentNames.map(style=>heading+' — '+style))].map((name,i)=>{
  const pair=pairs[i]
  const lettering:Lettering[]=i>=32?collectionLettering(i-32):references[i]??[0,1].map(j=>({text:pair[j+1],fontFamily:pair[j+3],fontSize:j?42:60,color:pair[j+5],y:j*75,height:70}))
  const blockHeight=Math.max(...lettering.map(b=>(b.y??0)+(b.height??100)))
  const scale=Math.min(1,height*.55/(blockHeight+40)),groupId='ynot-combination-'+i
  const boxes=lettering.map((b,j):TextBox=>({
   bold:false,italic:false,align:'center',autoWidth:false,...b,
   id:groupId+'-'+j,groupId,x:.2,y:(height/2+( (b.y??0)-blockHeight/2)*scale)/height,
   width:.6,height:(b.height??100)*scale/height,fontSize:b.fontSize*scale,
   effects:b.effects?Object.fromEntries(Object.entries(b.effects).map(([key,e])=>[key,e?{...e,size:e.size*scale,distance:e.distance*scale}:e])):undefined,
  }))
  return {id:groupId,name,category:'Font combinations',subcategory:i>=32?collectionPhrases[Math.floor((i-32)/4)][0]:'Reference styles',title:true,content:true,boxes}
 })
}
