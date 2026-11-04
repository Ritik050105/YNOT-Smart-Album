export default function ImportProgress({done,total}:{done:number;total:number}){
  const percent=Math.round(done/Math.max(1,total)*100)
  return <section className="import-progress" aria-label="Import progress" role="status">
    <div><strong>Preparing photo previews</strong><span>{done} of {total} · {percent}%</span></div>
    <progress max={Math.max(1,total)} value={done}/>
    <small>Original files stay unchanged. Full-resolution originals are used for export.</small>
  </section>
}
