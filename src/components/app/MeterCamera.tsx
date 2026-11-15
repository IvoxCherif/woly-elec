"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";
import { captureFrame, prepareFile } from "@/lib/photo";

/**
 * Appareil photo plein écran avec cadre de visée : le client place l'écran du compteur dans le cadre,
 * seule cette zone est envoyée (recadrée, nettoyée). Si la caméra n'est pas accessible, on propose la galerie.
 */
export function MeterCamera({ code, onImage, onClose }: { code: string; onImage: (dataUrl: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"start" | "live" | "off">("start");
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("indisponible");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setStatus("live");
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
        if (caps.torch) setTorch({ on: false, track });
        if (caps.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  function shoot() {
    if (!video.current || !guide.current || status !== "live") return;
    onImage(captureFrame(video.current, guide.current));
  }

  async function toggleTorch() {
    if (!torch) return;
    const on = !torch.on;
    await torch.track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {});
    setTorch({ ...torch, on });
  }

  async function fromGallery(f: File | undefined) {
    if (!f) return;
    try {
      onImage(await prepareFile(f));
    } catch {
      onClose();
    }
  }

  return createPortal(
    <div className="cam" role="dialog" aria-modal="true" aria-label={`Photographier l'écran du compteur, code ${code}`}>
      <video ref={video} className="cam-video" playsInline muted />
      {status === "live" && (
        <div className="cam-mask">
          <div ref={guide} className="cam-guide">
            <i /><i /><i /><i />
          </div>
          <p className="cam-tip">Placez <b>les chiffres de l&apos;écran</b> dans le cadre, bien droit, sans reflet. Code {code}.</p>
        </div>
      )}
      {status === "start" && <p className="cam-msg">Ouverture de l&apos;appareil photo…</p>}
      {status === "off" && (
        <div className="cam-msg col" style={{ gap: 12, alignItems: "center" }}>
          <b>Appareil photo inaccessible</b>
          <span>Autorisez l&apos;appareil photo pour wolyelec.com, ou choisissez une photo de l&apos;écran du compteur prise de près.</span>
        </div>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void fromGallery(e.target.files?.[0])} />
      <div className="cam-bar">
        <button type="button" className="cam-side" onClick={onClose}>Annuler</button>
        {status === "live" ? (
          <button type="button" className="cam-shoot" onClick={shoot} aria-label="Prendre la photo"><span /></button>
        ) : (
          <button type="button" className="btn btn-yel" onClick={() => file.current?.click()}>Choisir une photo</button>
        )}
        {status === "live" && torch ? (
          <button type="button" className="cam-side" onClick={() => void toggleTorch()} aria-pressed={torch.on}>{torch.on ? "Lampe ✓" : "Lampe"}</button>
        ) : status === "live" ? (
          <button type="button" className="cam-side" onClick={() => file.current?.click()} aria-label="Choisir dans la galerie"><Icon name="download" size="s" /></button>
        ) : (
          <span className="cam-side" />
        )}
      </div>
    </div>,
    document.body,
  );
}
