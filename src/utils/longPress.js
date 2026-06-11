// Pridanie rezervácie na dotykových zariadeniach (mobil/tablet) vyžaduje
// dlhšie podržanie bunky (~500 ms), aby nevznikali náhodné kliknutia pri
// rolovaní kalendárom. Na desktope (myš) ostáva obyčajný klik.
const LONG_PRESS_MS  = 500
const MOVE_TOLERANCE = 12 // px – väčší pohyb = rolovanie, podržanie sa zruší

const isTouch = typeof window !== 'undefined' &&
  window.matchMedia('(hover: none), (pointer: coarse)').matches

// Vráti props pre element: { onClick } na desktope, pointer handlery na dotyku.
export function pressToAdd(fn) {
  if (!fn) return {}

  if (!isTouch) {
    return { onClick: (e) => { e.stopPropagation?.(); fn() } }
  }

  let timer = null
  let startX = 0
  let startY = 0
  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }

  return {
    onPointerDown: (e) => {
      startX = e.clientX
      startY = e.clientY
      clear()
      timer = setTimeout(() => { timer = null; fn() }, LONG_PRESS_MS)
    },
    onPointerMove: (e) => {
      if (timer && (Math.abs(e.clientX - startX) > MOVE_TOLERANCE ||
                    Math.abs(e.clientY - startY) > MOVE_TOLERANCE)) {
        clear()
      }
    },
    onPointerUp:     clear,
    onPointerCancel: clear,
    onPointerLeave:  clear,
    onContextMenu:   (e) => e.preventDefault(),
  }
}
