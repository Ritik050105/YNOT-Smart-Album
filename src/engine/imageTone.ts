import { PlacedPhoto } from '@/types'

export function imageToneFilter(tone: Pick<PlacedPhoto, 'brightness' | 'contrast' | 'saturation'>) {
  return `brightness(${1 + tone.brightness / 100}) contrast(${1 + tone.contrast / 100}) saturate(${1 + tone.saturation / 100})`
}
