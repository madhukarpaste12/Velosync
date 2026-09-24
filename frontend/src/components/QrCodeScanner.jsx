import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { getBike } from '../services/api';
import { getUserFriendlyError } from '../utils/errorUtils';
import { parseVeloSyncQrCode } from '../utils/qrUtils';

const buildPermissionError = (error) => {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission is required to scan a QR code.';
  }

  if (name === 'NotFoundError') {
    return 'No camera device found on this device.';
  }

  if (name === 'NotSupportedError' || /secure|https|supported/i.test(error?.message || '')) {
    return 'Camera access is not supported in this browser or context.';
  }

  return 'Camera access is unavailable right now.';
};

export default function QrCodeScanner({ onClose, onValidScan, setToast }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const scanHandledRef = useRef(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const stopCamera = useCallback(() => {
    if (codeReaderRef.current && typeof codeReaderRef.current.reset === 'function') {
      try {
        codeReaderRef.current.reset();
      } catch {
        // No-op: reset is best-effort.
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeScanner = useCallback(() => {
    stopCamera();
    if (onClose) onClose();
  }, [onClose, stopCamera]);

  const handleValidQr = useCallback(async (rawValue) => {
    if (scanHandledRef.current) return;
    scanHandledRef.current = true;

    const bikeId = parseVeloSyncQrCode(rawValue);
    if (!bikeId) {
      stopCamera();
      setError('Invalid VeloSync QR Code');
      if (setToast) setToast('Invalid VeloSync QR Code');
      return;
    }

    try {
      setIsProcessing(true);
      const bicycle = await getBike(bikeId);

      if (!bicycle) {
        stopCamera();
        const friendly = getUserFriendlyError({ response: { status: 404, data: { message: 'Bicycle not found.' } } }, 'Invalid VeloSync QR Code');
        setError(friendly);
        if (setToast) setToast(friendly);
        return;
      }

      if (!bicycle.is_locked || bicycle.health !== 'Good') {
        stopCamera();
        const friendly = getUserFriendlyError({ response: { status: 409, data: { message: 'Bike not available or already rented.' } } }, 'This bicycle is currently unavailable. Please choose another bicycle.');
        setError(friendly);
        if (setToast) setToast(friendly);
        return;
      }

      stopCamera();
      if (onValidScan) onValidScan(bicycle);
    } catch (err) {
      stopCamera();
      const friendly = getUserFriendlyError(err, 'Invalid VeloSync QR Code');
      setError(friendly);
      if (setToast) setToast(friendly);
      console.error('QR scan failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [onValidScan, setToast, stopCamera]);

  const startScanner = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera access is not supported by this browser.');
      return;
    }

    try {
      const codeReader = new BrowserQRCodeReader();
      codeReaderRef.current = codeReader;
      const devices = await codeReader.listVideoInputDevices();

      if (!devices || devices.length === 0) {
        setError('No camera device found.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      await codeReader.decodeFromVideoDevice(
        devices[0].deviceId,
        video,
        (result, err) => {
          if (scanHandledRef.current) return;

          if (result) {
            const scannedText = result.getText();
            void handleValidQr(scannedText);
            return;
          }

          if (err && !/NotFoundException|NoMultiFormatReader|NotFound/i.test(String(err?.message || err))) {
            const permissionMessage = buildPermissionError(err);
            if (permissionMessage) {
              setError(permissionMessage);
            }
          }
        }
      );
    } catch (err) {
      setError(buildPermissionError(err));
      stopCamera();
    }
  }, [handleValidQr, stopCamera]);

  useEffect(() => {
    scanHandledRef.current = false;
    setError('');
    setIsProcessing(false);
    void startScanner();

    return () => {
      stopCamera();
    };
  }, [startScanner, stopCamera]);

  return (
    <div className="qr-scanner-backdrop">
      <div className="qr-scanner-panel">
        <div className="qr-scanner-header">
          <h2>Scan QR Code</h2>
        </div>

        <div className="qr-scanner-stage">
          {error ? (
            <div className="qr-scanner-error">
              <p>{error}</p>
            </div>
          ) : (
            <video ref={videoRef} className="qr-scanner-video" playsInline muted autoPlay />
          )}
          {!error && <div className="qr-scanner-frame" aria-hidden="true" />}
        </div>

        <p className="qr-scanner-instruction">
          {isProcessing ? 'Checking bicycle availability...' : 'Point your camera at the bicycle QR code'}
        </p>

        {error && (
          <div className="qr-scanner-alert">
            {error}
          </div>
        )}

        <button type="button" className="button button-secondary full-width" onClick={closeScanner}>
          Close
        </button>
      </div>

      <style>{`
        .qr-scanner-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .qr-scanner-panel {
          width: min(100%, 430px);
          background: rgba(255, 255, 255, 0.98);
          border-radius: 24px;
          padding: 1.25rem 1rem 1rem;
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
        }

        .qr-scanner-header {
          text-align: center;
          margin-bottom: 0.8rem;
        }

        .qr-scanner-header h2 {
          margin: 0;
          font-size: clamp(1.5rem, 3vw, 2rem);
          color: #111827;
        }

        .qr-scanner-stage {
          position: relative;
          width: 100%;
          height: 320px;
          border-radius: 20px;
          overflow: hidden;
          background: #0f172a;
          border: 1px solid rgba(148, 163, 184, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qr-scanner-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          background: #0f172a;
        }

        .qr-scanner-error,
        .qr-scanner-alert {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: rgba(254, 242, 242, 0.95);
          color: #b91c1c;
          border-radius: 14px;
          padding: 1rem;
          font-weight: 600;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }

        .qr-scanner-frame {
          position: absolute;
          inset: 18% 18%;
          border: 3px solid rgba(255, 255, 255, 0.95);
          border-radius: 18px;
          box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.28);
          pointer-events: none;
        }

        .qr-scanner-frame::before,
        .qr-scanner-frame::after {
          content: '';
          position: absolute;
          width: 28px;
          height: 28px;
          border-color: #fff;
          border-style: solid;
        }

        .qr-scanner-frame::before {
          left: 12px;
          top: 12px;
          border-width: 4px 0 0 4px;
          border-top-left-radius: 10px;
        }

        .qr-scanner-frame::after {
          right: 12px;
          bottom: 12px;
          border-width: 0 4px 4px 0;
          border-bottom-right-radius: 10px;
        }

        .qr-scanner-instruction {
          margin: 0.9rem 0 0.7rem;
          text-align: center;
          color: #374151;
          line-height: 1.5;
          font-size: 0.96rem;
        }

        .button {
          appearance: none;
          border: none;
          border-radius: 12px;
          padding: 0.8rem 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .button:hover {
          transform: translateY(-1px);
        }

        .button-secondary {
          background: #e2e8f0;
          color: #0f172a;
        }

        .full-width {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
