'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconX } from './icons'

type Props = {
  /** Called with each code read. Return a short status line to show under the viewfinder. */
  onCode: (code: string) => void
  onClose: () => void
  hint: string
  lastResult?: { text: string; tone: 'ok' | 'bad' | 'warn' } | null
}

// The same code is counted again only after it has left the camera view for this long,
// so holding one bottle in front of the camera never counts it twice.
const GONE_MS = 1000
const MIN_GAP_MS = 400

/**
 * Full-screen phone camera scanner. Reads shipping-label barcodes (Code 128 etc.) and the
 * Data Matrix on products, including light-on-dark (inverted) Data Matrix.
 */
export function CameraScanner({ onCode, onClose, hint, lastResult }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const cb = useRef(onCode)
  cb.current = onCode

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let lastAt = 0
    let lastText = ''
    let lastSeen = 0

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('เบราว์เซอร์นี้เปิดกล้องไม่ได้')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        setError('ไม่ได้รับอนุญาตให้ใช้กล้อง กดอนุญาตในเบราว์เซอร์แล้วลองใหม่')
        return
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})

      const z = await import('@zxing/library')
      const hints = new Map()
      hints.set(z.DecodeHintType.POSSIBLE_FORMATS, [
        z.BarcodeFormat.CODE_128, z.BarcodeFormat.CODE_39, z.BarcodeFormat.CODE_93, z.BarcodeFormat.EAN_13,
        z.BarcodeFormat.ITF, z.BarcodeFormat.QR_CODE, z.BarcodeFormat.DATA_MATRIX,
      ])
      hints.set(z.DecodeHintType.TRY_HARDER, true)
      const reader = new z.MultiFormatReader()
      reader.setHints(hints)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      let frame = 0

      const tick = () => {
        if (stopped) return
        raf = requestAnimationFrame(tick)
        if (++frame % 3 !== 0 || v.readyState < 2) return
        // Read the centre of the frame (where the viewfinder is), scaled down for speed.
        const side = Math.min(v.videoWidth, v.videoHeight) * 0.8
        const sx = (v.videoWidth - side) / 2, sy = (v.videoHeight - side) / 2
        const out = Math.min(640, side)
        canvas.width = canvas.height = out
        ctx.drawImage(v, sx, sy, side, side, 0, 0, out, out)
        const src = new z.HTMLCanvasElementLuminanceSource(canvas)
        let text: string | null = null
        for (const lum of [src, src.invert()]) {
          try {
            text = reader.decodeWithState(new z.BinaryBitmap(new z.HybridBinarizer(lum))).getText()
            break
          } catch { reader.reset() }
        }
        if (text) {
          const now = Date.now()
          const repeat = text === lastText && now - lastSeen < GONE_MS
          lastSeen = now
          if (repeat || now - lastAt < MIN_GAP_MS) return
          lastText = text
          lastAt = now
          setFlash(true); setTimeout(() => setFlash(false), 250)
          try { navigator.vibrate?.(60) } catch {}
          cb.current(text.trim())
        }
      }
      raf = requestAnimationFrame(tick)
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Rendered on <body> so the page's entrance animation cannot shrink it into the card.
  return createPortal(
    <div className="cam" role="dialog" aria-modal="true" aria-label="สแกนด้วยกล้อง">
      <video ref={video} className="cam-video" playsInline muted />
      <div className={`cam-frame ${flash ? 'hit' : ''}`} aria-hidden="true" />
      <div className="cam-top">
        <span>{hint}</span>
        <button type="button" className="cam-x" onClick={onClose} aria-label="ปิดกล้อง"><IconX size={18} /></button>
      </div>
      <div className="cam-bottom">
        {error ? <div className="cam-msg bad">{error}</div>
          : lastResult ? <div className={`cam-msg ${lastResult.tone}`}>{lastResult.text}</div>
          : <div className="cam-msg">เล็งบาร์โค้ดให้อยู่ในกรอบ</div>}
        <button type="button" className="btn" onClick={onClose}>เสร็จ</button>
      </div>
    </div>,
    document.body,
  )
}
