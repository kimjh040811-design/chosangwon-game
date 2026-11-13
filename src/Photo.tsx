import { useEffect, useRef } from "react";
import { photoById, isRetiredPhoto } from "./data";
import type { Edit, PhotoId } from "./model";
const mosaicLayers = new WeakMap<
  HTMLImageElement,
  { mosaic: HTMLCanvasElement; overlay: HTMLCanvasElement }
>();
export function paintPhoto(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  edits: Edit[],
  photo?: PhotoId,
) {
  const definition = photo ? photoById(photo) : undefined;
  const w = definition?.width ?? image.naturalWidth,
    h = definition?.height ?? image.naturalHeight;
  const draw = (
    target: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    const crop = definition?.crop;
    if (crop)
      target.drawImage(
        image,
        crop.x * image.naturalWidth,
        crop.y * image.naturalHeight,
        crop.width * image.naturalWidth,
        crop.height * image.naturalHeight,
        0,
        0,
        width,
        height,
      );
    else target.drawImage(image, 0, 0, width, height);
  };
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  if (!edits.length) return;
  let cached = mosaicLayers.get(image);
  if (!cached) {
    const mosaic = document.createElement("canvas");
    mosaic.width = 24;
    mosaic.height = Math.max(1, Math.round((24 * h) / w));
    draw(mosaic.getContext("2d")!, mosaic.width, mosaic.height);
    const overlay = document.createElement("canvas");
    overlay.width = w;
    overlay.height = h;
    cached = { mosaic, overlay };
    mosaicLayers.set(image, cached);
  }
  const { mosaic, overlay } = cached;
  const layer = overlay.getContext("2d")!;
  for (const edit of edits) {
    if (edit.kind === "brush") {
      layer.clearRect(0, 0, w, h);
      layer.globalCompositeOperation = "source-over";
      layer.imageSmoothingEnabled = false;
      layer.drawImage(mosaic, 0, 0, w, h);
      layer.globalCompositeOperation = "destination-in";
      // All segments form one path so overlap never erases earlier mask pixels.
      layer.beginPath();
      layer.lineWidth = edit.size * w;
      layer.lineCap = "round";
      layer.lineJoin = "round";
      edit.points.forEach((p, i) =>
        i ? layer.lineTo(p.x * w, p.y * h) : layer.moveTo(p.x * w, p.y * h),
      );
      if (edit.points.length === 1) {
        const p = edit.points[0];
        layer.lineTo(p.x * w + 0.01, p.y * h);
      }
      layer.stroke();
      ctx.drawImage(overlay, 0, 0);
    } else {
      const size = edit.size * w;
      ctx.fillStyle = "#f8d37c";
      ctx.fillRect(edit.x * w - size / 2, edit.y * h - size / 2, size, size);
      ctx.font = `${size * 0.66}px "Segoe UI Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#5f5340";
      ctx.fillText(edit.symbol, edit.x * w, edit.y * h + size * 0.04);
    }
  }
}
export default function Photo({
  photo,
  edits = [],
  className = "",
  label,
}: {
  photo: PhotoId;
  edits?: Edit[];
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (isRetiredPhoto(photo)) return;
    let active = true;
    const img = new Image();
    img.src = photoById(photo).file;
    img.onload = () => {
      if (active && ref.current) paintPhoto(ref.current, img, edits, photo);
    };
    return () => {
      active = false;
    };
  }, [photo, edits]);
  if (isRetiredPhoto(photo))
    return (
      <div className="retired-photo" role="img" aria-label="제외된 사진">
        사진 목록에서 제외된 항목이에요.
      </div>
    );
  return (
    <canvas
      ref={ref}
      width={photoById(photo).width ?? 1448}
      height={photoById(photo).height ?? 1086}
      style={{
        aspectRatio: `${photoById(photo).width ?? 1448}/${photoById(photo).height ?? 1086}`,
      }}
      className={`photo ${className}`}
      role="img"
      aria-label={label ?? photoById(photo).title}
    />
  );
}
