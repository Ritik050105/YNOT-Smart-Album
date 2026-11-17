/** The face model, run in the hidden window electron/faceWindow.ts opens (the renderer loaded with `?view=face-worker`); never in the editor.
 *
 *  @vladmandic/face-api (MIT, SSD MobileNet) runs on this computer with no network and no account. Its weights travel inside the app's
 *  JavaScript as a data: URL (a packaged app is opened from file://, where a neighbouring file cannot be fetched). */
type FaceApi = typeof import('@vladmandic/face-api')
export type FoundFace = { x: number; y: number; width: number; height: number; score: number }

let loading: Promise<FaceApi> | undefined
function load(): Promise<FaceApi> {
  loading ??= (async () => {
    const faceapi = await import('@vladmandic/face-api')
    // The package types its bundled TensorFlow namespace narrowly; these are the three calls used.
    const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void>; io: { decodeWeights(data: ArrayBuffer, specs: unknown): Parameters<typeof faceapi.nets.ssdMobilenetv1.loadFromWeightMap>[0] } }
    try { await tf.setBackend('webgl') } catch { await tf.setBackend('cpu') }
    await tf.ready()
    const manifest = (await import('@vladmandic/face-api/model/ssd_mobilenetv1_model-weights_manifest.json')).default
    const weights = (await import('@vladmandic/face-api/model/ssd_mobilenetv1_model.bin?inline')).default as string
    faceapi.nets.ssdMobilenetv1.loadFromWeightMap(tf.io.decodeWeights(await (await fetch(weights)).arrayBuffer(), manifest[0].weights))
    return faceapi
  })()
  loading.catch(() => { loading = undefined })
  return loading
}

export async function findFacesIn(dataUrl: string): Promise<FoundFace[] | null> {
  try {
    const faceapi = await load()
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = dataUrl })
    const found = await faceapi.detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    return found.map(f => ({ x: f.box.x, y: f.box.y, width: f.box.width, height: f.box.height, score: f.score }))
  } catch (error) {
    console.warn('Face detector failed.', error)
    return null
  }
}
