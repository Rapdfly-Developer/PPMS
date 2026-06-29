"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Camera, X, Aperture } from "lucide-react";

interface Props {
  onCapture: (blob: Blob, filename: string) => void;
}

export function CameraCapture({ onCapture }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
    setError("");
  }, []);

  async function openCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setOpen(true);
    } catch {
      setError("Camera access denied or unavailable.");
    }
  }

  useEffect(() => {
    if (open && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [open]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(blob, `scan-${Date.now()}.jpg`);
          stopCamera();
        }
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openCamera}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)] transition-colors"
      >
        <Camera size={15} /> Open Camera
      </button>

      {error && <p className="text-xs text-[var(--color-danger-600)] mt-1">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
          <div className="relative w-full max-w-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={stopCamera}
              className="absolute top-3 right-3 z-10 size-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <X size={18} />
            </button>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl"
            />

            {/* Capture button */}
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={capture}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[var(--color-ink-900)] font-semibold text-sm hover:bg-gray-100 transition-colors shadow-lg"
              >
                <Aperture size={18} /> Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
