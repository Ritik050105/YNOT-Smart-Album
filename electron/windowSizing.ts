type Size = { width: number; height: number }

export function fitWindowSize(workArea: Size, preferred: Size, minimum: Size) {
  return { width: Math.min(preferred.width, workArea.width), height: Math.min(preferred.height, workArea.height),
    minWidth: Math.min(minimum.width, workArea.width), minHeight: Math.min(minimum.height, workArea.height) }
}
