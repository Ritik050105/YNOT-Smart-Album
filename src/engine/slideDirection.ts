/** Which way a layout change should slide: 1 when the new layout comes from the right (Next, or a browser tile to the right
 *  of the last), -1 when it comes from the left. Set by whatever caused the change just before it is applied, and read by the
 *  card that redraws; it lapses after a moment so an unrelated change later does not slide the wrong way. */
let direction: 1 | -1 = 1
let setAt = 0
export function setSlideDirection(next: 1 | -1) { direction = next; setAt = performance.now() }
export function slideDirection(): 1 | -1 { return performance.now() - setAt < 800 ? direction : 1 }
