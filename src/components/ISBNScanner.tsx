import {
  Html5QrcodeScanner,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode"
import { useEffect } from "react"

export function ISBNScanner({
  onDetected,
  onClose,
}: {
  onDetected: (isbn: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "isbn-scanner",
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
        ],
      },
      false
    )

    scanner.render(
      (decodedText) => {
        scanner.clear().then(onClose)
        onDetected(decodedText)
      },
      () => {}
    )

    return () => {
      scanner.clear().catch(() => {})
    }
  }, [onDetected, onClose])

  return <div id="isbn-scanner" />
}