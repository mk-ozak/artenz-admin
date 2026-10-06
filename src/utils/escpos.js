// Prevod lístka (plátno 576 px) na príkazy ESC/POS pre termotlačiareň
// a odoslanie cez Android aplikáciu RawBT (IP tlačiarne má nastavenú RawBT).
// Tlačí sa ako obrázok (raster), nie text — znaková sada tlačiarne je
// čínska a slovenskú diakritiku by rozsypala.

const ESC = 0x1b
const GS  = 0x1d

// Plátno → 1-bit raster: čierna, keď je jas < 140 (bez ditheringu).
// Riadok = width/8 bajtov, najvyšší bit = ľavý bod, 1 = čierna.
export function canvasToRaster(canvas) {
  const { width, height } = canvas
  const rowBytes = width >> 3
  const px = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const data = new Uint8Array(rowBytes * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 140) {
        data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return { width, height, rowBytes, data }
}

// Raster → plátno: náhľad a PNG presne tak, ako vyjde z tlačiarne
export function rasterToCanvas({ width, height, rowBytes, data }) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[y * rowBytes + (x >> 3)] & (0x80 >> (x & 7)) ? 0 : 255
      const i = (y * width + x) * 4
      img.data[i] = v
      img.data[i + 1] = v
      img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Najviac dát v jednom odkaze pre RawBT. Android prenáša odkaz (intent) medzi
// aplikáciami s obmedzenou veľkosťou — pri prekročení Chrome namiesto otvorenia
// RawBT spadne. 256 KB dát ≈ 350 000 znakov base64, s rezervou pod limitom.
export const MAX_PART_BYTES = 256 * 1024

const concat = chunks => {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

// Príkazy pre tlačiareň: raster lístka cez GS v 0 po pásoch max. 256 riadkov
// (hlavička pásu + dáta spolu), za každým lístkom ESC d 4 a čiastočný rez GS V 66 0
function commands(rasters) {
  const cmds = []
  for (const r of rasters) {
    for (let y = 0; y < r.height; y += 256) {
      const h = Math.min(256, r.height - y)
      cmds.push(concat([
        Uint8Array.of(GS, 0x76, 0x30, 0, r.rowBytes & 0xff, r.rowBytes >> 8, h & 0xff, h >> 8),
        r.data.subarray(y * r.rowBytes, (y + h) * r.rowBytes),
      ]))
    }
    cmds.push(Uint8Array.of(ESC, 0x64, 4))      // posun papiera o 4 riadky
    cmds.push(Uint8Array.of(GS, 0x56, 0x42, 0)) // čiastočný rez
  }
  return cmds
}

// Balíky pre tlačiareň: ESC @ → raster lístka → ESC d 4 → čiastočný rez → ďalší
// lístok… Dlhá tlač sa rozdelí na časti do maxBytes (na hranici pásov rastra);
// každá časť je samostatná tlač v RawBT so začiatkom ESC @ a papier medzi
// časťami pokračuje bez rezu — vyjde jeden súvislý lístok.
export function buildEscPosParts(rasters, maxBytes = MAX_PART_BYTES) {
  const init = Uint8Array.of(ESC, 0x40)
  const parts = []
  let cur = [init]
  let size = init.length
  for (const c of commands(rasters)) {
    if (cur.length > 1 && size + c.length > maxBytes) {
      parts.push(concat(cur))
      cur = [init]
      size = init.length
    }
    cur.push(c)
    size += c.length
  }
  parts.push(concat(cur))
  return parts
}

// Uint8Array → base64 po kúskoch (celé pole naraz by pri dlhom lístku
// prekročilo limit argumentov String.fromCharCode)
export function toBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

// Odkaz, ktorý otvorí RawBT a pošle mu dáta pre tlačiareň
export function rawbtUrl(bytes) {
  return `intent:base64,${toBase64(bytes)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`
}
