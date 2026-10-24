import mark from '@/assets/ynot-mark-white.png'

/** Use the original alpha silhouette without a badge or background tile. */
export default function BrandMark() {
  return <span className="brand-mark" role="img" aria-label="YNOT Photography" style={{maskImage: `url(${mark})`}} />
}
