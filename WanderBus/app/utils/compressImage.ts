// Shrinks a photo in the browser before it's saved: longest side scaled down to PHOTO_MAX_SIDE, white behind any
// transparency, re-encoded as a JPEG data URL. The result goes straight into passport_entries.photo_url.
// Source: copied from pages/passport.vue (the "Photo Upload & Compression" block, ~line 366) with its constants,
// which carry a PHOTO_ prefix here so the auto-imported names cannot clash. The End adventure dialog uses it,
// so its photos are stored in exactly the format the passport page already shows.
// passport.vue keeps its own copy and is left unchanged.

const PHOTO_MAX_SIDE = 1280
const PHOTO_JPEG_QUALITY = 0.8
export const PHOTO_MAX_FILE_MB = 20

export const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('canvas'))
        return
      }
      ctx.fillStyle = '#ffffff' // taste-skill-ignore: canvas fill behind transparent pixels, not a UI colour
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('decode'))
    }
    img.src = objectUrl
  })
