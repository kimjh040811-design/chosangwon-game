import type { Edit, Point } from "./model";
import { photoById, type Face } from "./data";
function distanceToSegment(p: Point, a: Point, b: Point, imageRatio: number) {
  const dx = b.x - a.x,
    dy = (b.y - a.y) * imageRatio;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * imageRatio * dy) / length,
        ),
      )
    : 0;
  return Math.hypot(p.x - a.x - t * dx, (p.y - a.y) * imageRatio - t * dy);
}
export function covered(p: Point, edits: Edit[], imageRatio = 0.75): boolean {
  return edits.some((edit) => {
    if (edit.kind === "sticker")
      return (
        Math.abs(p.x - edit.x) <= edit.size / 2 &&
        Math.abs(p.y - edit.y) * imageRatio <= edit.size / 2
      );
    return edit.points.some(
      (point, i) =>
        distanceToSegment(
          p,
          edit.points[Math.max(0, i - 1)],
          point,
          imageRatio,
        ) <=
        edit.size / 2,
    );
  });
}
export function protection(face: Face, edits: Edit[]) {
  const imageRatio = face.imageRatio ?? 0.75;
  let total = 0,
    hidden = 0;
  for (let y = -1; y <= 1; y += 0.08)
    for (let x = -1; x <= 1; x += 0.08) {
      if (x * x + y * y > 1) continue;
      total++;
      if (
        covered(
          { x: face.center.x + x * face.rx, y: face.center.y + y * face.ry },
          edits,
          imageRatio,
        )
      )
        hidden++;
    }
  const featuresHidden = face.features.every((p) =>
    [-1, 0, 1].every((x) =>
      [-1, 0, 1].every((y) =>
        covered(
          { x: p.x + x * 0.008, y: p.y + (y * 0.011 * 0.75) / imageRatio },
          edits,
          imageRatio,
        ),
      ),
    ),
  );
  return {
    ratio: hidden / total,
    safe: hidden / total >= 0.9 && featuresHidden,
    featuresHidden,
  };
}

export function protectsFriend(photo: string, friend: string, edits: Edit[]) {
  return photoById(photo)
    .faces.filter((f) => f.friend === friend)
    .every((f) => protection(f, edits).safe);
}
