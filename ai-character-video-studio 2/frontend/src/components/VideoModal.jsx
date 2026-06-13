// ─── components/VideoModal.jsx ───────────────────────────────────────────────
import { useEffect } from "react";
import "./VideoModal.css";

export default function VideoModal({ video, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filename = `${video.char?.replace(/\s/g, "-").toLowerCase()}-${video.id}`;

  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal" onClick={(e) => e.stopPropagation()}>
        <button className="vmodal-close" onClick={onClose} aria-label="Close">✕</button>

        {video.videoUrl ? (
          <video
            className="vmodal-video"
            src={video.videoUrl}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <div className="vmodal-no-video">
            <div className="vmodal-no-icon">▶</div>
            <p>
              {video.status === "processing"
                ? "⏳ Video is still generating…"
                : "No video file yet"}
            </p>
            {video.status !== "processing" && (
              <span>Add Kling / Runway / Luma API keys in Settings to generate real videos.</span>
            )}
          </div>
        )}

        <div className="vmodal-body">
          <div className="vmodal-title">{video.scene}</div>
          <div className="vmodal-meta">
            <span style={{ color: video.charColor, fontWeight: 600 }}>{video.char}</span>
            <span>{video.ratio}</span>
            <span>{video.dur}</span>
            <span>{video.model}</span>
            <span className="vmodal-ts">{video.ts}</span>
          </div>

          {video.videoUrl && (
            <div className="vmodal-actions">
              <a className="vmodal-btn vmodal-btn--primary" href={video.videoUrl} download={`${filename}.mp4`} target="_blank" rel="noreferrer">
                ⬇ Download MP4
              </a>
              <a className="vmodal-btn" href={video.videoUrl} download={`${filename}-tiktok.mp4`} target="_blank" rel="noreferrer">
                TikTok
              </a>
              <a className="vmodal-btn" href={video.videoUrl} download={`${filename}-reels.mp4`} target="_blank" rel="noreferrer">
                Reels
              </a>
              <a className="vmodal-btn" href={video.videoUrl} download={`${filename}-shorts.mp4`} target="_blank" rel="noreferrer">
                Shorts
              </a>
              <button className="vmodal-btn" onClick={() => navigator.clipboard?.writeText(video.videoUrl)}>
                📋 Copy URL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
