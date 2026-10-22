import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result=await build({entryPoints:['src/components/Modal.tsx'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'dialog-root',setup(build){
  const stub=(filter,namespace,contents)=>{build.onResolve({filter},()=>({path:namespace,namespace}));build.onLoad({filter:/.*/,namespace},()=>({contents}))}
  stub(/^react$/,'react','export const useRef=(current)=>({current});export const useEffect=()=>{};')
  stub(/^react-dom$/,'portal','export const createPortal=(node,target)=>({node,target});')
  stub(/^react\/jsx-runtime$/,'jsx','export const jsx=(type,props)=>({type,props});export const jsxs=jsx;')
}}]})
const {default:Modal}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
globalThis.document={body:{id:'body'}}
const dialog=Modal({title:'Templates',onClose(){},children:'body',footer:'Apply'})
assert.equal(dialog.target,document.body,'Dialogs escape panel containment and clipping')
assert.equal(dialog.node.props.className,'modal-backdrop')
const bare=Modal({title:'New Project',onClose(){},children:'wizard',bare:true})
assert.equal(bare.props.role,'dialog','Dedicated wizard remains inside its own window')
assert.equal(bare.target,undefined)
console.log('Modal checks passed: floating dialogs mount at the document root; dedicated wizard stays inline.')
