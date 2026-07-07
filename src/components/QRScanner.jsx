import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url';
import './QRScanner.css';

QrScanner.WORKER_PATH = QrScannerWorkerPath;

/**
 * QRScanner — opens the device camera and decodes QR codes in real time.
 * Purely a decode-and-report component: it hands the raw decoded text to
 * onDecode on every read (the caller owns parsing, validation, and
 * de-duplicating repeat scans of the same code).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(text: string) => void} props.onDecode
 * @param {() => void} props.onClose
 */
export default function QRScanner({ open, onDecode, onClose }) {
  const videoRef = useRef(null);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState('');

  useEffect(() => { onDecodeRef.current = onDecode; }, [onDecode]);

  // Only (re)initializes when the scanner opens/closes — not on every parent
  // render, which would otherwise restart the camera constantly since
  // onDecode is typically a fresh inline function each render.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Deferred so we don't setState synchronously in the effect body.
    const resetTimer = setTimeout(() => setError(''), 0);

    const scanner = new QrScanner(
      videoRef.current,
      (result) => { if (!cancelled) onDecodeRef.current?.(result?.data ?? result); },
      { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: 'environment' }
    );

    scanner.start().catch((err) => {
      if (cancelled) return;
      console.error('QRScanner start failed:', err);
      setError('Could not access the camera. Check permissions and try again.');
    });

    return () => {
      cancelled = true;
      clearTimeout(resetTimer);
      scanner.stop();
      scanner.destroy();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="qr-scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan entry QR">
      <div className="qr-scanner-backdrop" onClick={onClose} />
      <div className="qr-scanner-card animate-scale-in">
        <div className="qr-scanner-header">
          <span className="qr-scanner-title">Scan Entry QR</span>
          <button className="qr-scanner-close" onClick={onClose} type="button" aria-label="Close">×</button>
        </div>
        <div className="qr-scanner-viewport">
          <video ref={videoRef} className="qr-scanner-video" muted playsInline />
        </div>
        {error ? (
          <p className="qr-scanner-error" role="alert">{error}</p>
        ) : (
          <p className="qr-scanner-hint">Point the camera at a guest's entry QR.</p>
        )}
      </div>
    </div>
  );
}
