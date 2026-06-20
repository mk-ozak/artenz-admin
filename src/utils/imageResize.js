// Zmenší a skomprimuje obrázok cez canvas pred odoslaním na OCR.
// Vráti data URL ('data:image/jpeg;base64,...').
export async function zmensiObrazok(file, maxSide = 1600, quality = 0.8) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Obrázok sa nepodarilo načítať'))
    im.src = dataUrl
  })

  let { width, height } = img
  const longest = Math.max(width, height)
  if (longest > maxSide) {
    const scale = maxSide / longest
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}
