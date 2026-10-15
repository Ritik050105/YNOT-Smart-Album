export interface CoverCrop {
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
}

/**
 * Computes an object-fit:"cover" crop box (in source-pixel space) for placing an image of
 * (imgW x imgH) into a box of (boxW x boxH), respecting a focal point (0-1) and extra zoom.
 */
export function computeCoverCrop(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  focalX = 0.5,
  focalY = 0.5,
  zoom = 1
): CoverCrop {
  const boxAspect = boxW / boxH
  const imgAspect = imgW / imgH

  let cropWidth: number
  let cropHeight: number
  if (imgAspect > boxAspect) {
    cropHeight = imgH
    cropWidth = cropHeight * boxAspect
  } else {
    cropWidth = imgW
    cropHeight = cropWidth / boxAspect
  }

  cropWidth /= zoom
  cropHeight /= zoom

  const maxX = imgW - cropWidth
  const maxY = imgH - cropHeight
  const cropX = clamp(focalX * imgW - cropWidth / 2, 0, Math.max(maxX, 0))
  const cropY = clamp(focalY * imgH - cropHeight / 2, 0, Math.max(maxY, 0))

  return { cropX, cropY, cropWidth, cropHeight }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

/** Effective print DPI once a photo of (imgW x imgH) source px is cropped to fill a box of boxIn inches. */
export function effectiveDpi(imgW: number, imgH: number, crop: CoverCrop, boxWIn: number, boxHIn: number): number {
  const dpiX = crop.cropWidth / boxWIn
  const dpiY = crop.cropHeight / boxHIn
  return Math.min(dpiX, dpiY)
}
