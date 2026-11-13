import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Hand,
  Paintbrush,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { photoById } from "./data";
import type { Edit, PhotoId, Point } from "./model";
import { paintPhoto } from "./Photo";
export default function Editor({
  photo,
  initial,
  onSave,
  onClose,
  onDraft,
  request,
}: {
  photo: PhotoId;
  initial: Edit[];
  onSave: (edits: Edit[]) => void;
  onClose: () => void;
  onDraft: (edits: Edit[]) => void;
  request?: string;
}) {
  const imageRatio =
    (photoById(photo).height ?? 1086) / (photoById(photo).width ?? 1448);
  const [edits, setEdits] = useState<Edit[]>(structuredClone(initial));
  const [zoom, setZoom] = useState(1);
  const [past, setPast] = useState<Edit[][]>([]),
    [future, setFuture] = useState<Edit[][]>([]);
  const [mode, setMode] = useState<"brush" | "move">("brush"),
    [size, setSize] = useState(0.09),
    [selected, setSelected] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    image = useRef<HTMLImageElement | null>(null);
  const gesture = useRef<{
    pointerId: number;
    before: Edit[];
    index: number;
    offset: Point;
  } | null>(null);
  const latestEdits = useRef(edits);
  latestEdits.current = edits;
  const draftWriter = useRef(onDraft);
  draftWriter.current = onDraft;
  const saved = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => draftWriter.current(edits), 200);
    return () => clearTimeout(timer);
  }, [edits]);
  useEffect(
    () => () => {
      if (!saved.current) draftWriter.current(latestEdits.current);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.src = photoById(photo).file;
    img.onload = () => {
      if (!active) return;
      image.current = img;
      if (canvas.current)
        paintPhoto(canvas.current, img, latestEdits.current, photo);
    };
    return () => {
      active = false;
    };
  }, [photo]);
  useEffect(() => {
    if (canvas.current && image.current)
      paintPhoto(canvas.current, image.current, edits, photo);
  }, [edits]);
  function commit(next: Edit[]) {
    setPast((p) => [...p, structuredClone(edits)]);
    setFuture([]);
    setEdits(next);
  }
  function point(e: React.PointerEvent): Point {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (
      !e.isPrimary ||
      gesture.current ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    const before = structuredClone(edits);
    if (mode === "brush") {
      gesture.current = {
        pointerId: e.pointerId,
        before,
        index: edits.length,
        offset: { x: 0, y: 0 },
      };
      setEdits([...edits, { kind: "brush", size, points: [p] }]);
      setSelected(null);
    } else {
      const index = edits.findLastIndex(
        (edit) =>
          edit.kind === "sticker" &&
          Math.abs(p.x - edit.x) <= edit.size / 2 &&
          Math.abs(p.y - edit.y) * imageRatio <= edit.size / 2,
      );
      if (index < 0) {
        setSelected(null);
        return;
      }
      const sticker = edits[index];
      if (sticker.kind !== "sticker") return;
      setSelected(index);
      gesture.current = {
        pointerId: e.pointerId,
        before,
        index,
        offset: { x: p.x - sticker.x, y: p.y - sticker.y },
      };
    }
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== e.pointerId) return;
    const p = point(e);
    setEdits((items) =>
      items.map((edit, i) =>
        i !== current.index
          ? edit
          : edit.kind === "brush"
            ? { ...edit, points: [...edit.points, p] }
            : { ...edit, x: p.x - current.offset.x, y: p.y - current.offset.y },
      ),
    );
  }
  function finish(e?: React.PointerEvent) {
    const current = gesture.current;
    if (current && (!e || current.pointerId === e.pointerId)) {
      if (e?.currentTarget instanceof Element && e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      setPast((p) => [...p, current.before]);
      setFuture([]);
      gesture.current = null;
    }
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [structuredClone(edits), ...f]);
    setEdits(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSelected(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, structuredClone(edits)]);
    setEdits(future[0]);
    setFuture((f) => f.slice(1));
    setSelected(null);
  }
  function save() {
    if (saved.current) return;
    finish();
    saved.current = true;
    onSave(latestEdits.current);
  }
  const sticker = selected === null ? null : edits[selected];
  return (
    <section
      className={`editor modal-sheet ${request !== undefined ? "integrated-editor" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="사진 편집기"
    >
      <header className="app-header">
        <button
          className="icon-button"
          aria-label="편집 닫기"
          onClick={() => {
            onClose();
          }}
        >
          <ArrowLeft />
        </button>
        <h2>사진 편집</h2>
        <button
          className="text-button"
          onClick={save}
        >
          <Check size={18} /> 저장
        </button>
      </header>
      {request !== undefined && <p className="editor-request">{request}</p>}
      {request !== undefined && (
        <div className="editor-zoom" aria-label="사진 확대">
          <button onClick={() => setZoom(Math.max(1, zoom - 1))} disabled={zoom === 1}>축소</button>
          <span>{zoom}배</span>
          <button onClick={() => setZoom(Math.min(3, zoom + 1))} disabled={zoom === 3}>확대</button>
          {zoom > 1 && <small>사진 영역을 스크롤해 다른 컷도 볼 수 있어요.</small>}
        </div>
      )}
      <div className={request !== undefined ? "editor-viewport" : undefined}>
      <div className="editor-image" style={request !== undefined ? { width: `min(${zoom * 100}%, calc(${zoom * 43}dvh / ${imageRatio}))` } : undefined}>
        <canvas
          ref={canvas}
          width={photoById(photo).width ?? 1448}
          height={photoById(photo).height ?? 1086}
          style={{ aspectRatio: `1/${imageRatio}` }}
          role="img"
          className="photo"
          aria-label="사진 위에 모자이크 칠하기 또는 스티커 이동"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
        {sticker?.kind === "sticker" && (
          <div
            className="sticker-outline"
            style={{
              left: `${(sticker.x - sticker.size / 2) * 100}%`,
              top: `${(sticker.y - sticker.size / imageRatio / 2) * 100}%`,
              width: `${sticker.size * 100}%`,
              height: `${(sticker.size / imageRatio) * 100}%`,
            }}
          />
        )}
      </div>
      </div>
      <div className="editor-controls">
        <p className="muted">
          {mode === "brush"
            ? "사진 위를 문질러 모자이크를 칠해 주세요."
            : "스티커를 누르고 끌어서 옮겨 주세요."}
        </p>
        <div className="tool-row">
          <button
            className={mode === "brush" ? "selected" : ""}
            onClick={() => setMode("brush")}
          >
            <Paintbrush size={18} /> 모자이크
          </button>
          <button
            className={mode === "move" ? "selected" : ""}
            onClick={() => setMode("move")}
          >
            <Hand size={18} /> 이동
          </button>
          <button aria-label="실행 취소" disabled={!past.length} onClick={undo}>
            <Undo2 size={20} />
          </button>
          <button
            aria-label="다시 실행"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={20} />
          </button>
        </div>
        <fieldset>
          <legend>브러시 크기</legend>
          <div className="tool-row">
            {[0.045, 0.09, 0.18].map((value, i) => (
              <button
                key={value}
                className={size === value ? "selected" : ""}
                onClick={() => {
                  setMode("brush");
                  setSize(value);
                }}
              >
                {["작게", "보통", "크게"][i]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>스티커 추가</legend>
          <div className="stickers">
            {["●", "■", "▲", "◆", "★", "⬟"].map((symbol) => (
              <button
                key={symbol}
                aria-label={`${symbol} 스티커 추가`}
                onClick={() => {
                  commit([
                    ...edits,
                    { kind: "sticker", symbol, x: 0.5, y: 0.5, size: 0.18 },
                  ]);
                  setSelected(edits.length);
                  setMode("move");
                }}
              >
                {symbol}
              </button>
            ))}
          </div>
        </fieldset>
        {sticker?.kind === "sticker" && (
          <div className="sticker-settings">
            <label>
              스티커 크기
              <input
                aria-label="스티커 크기"
                type="range"
                min="0.06"
                max="0.5"
                step="0.01"
                value={sticker.size}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    setPast((p) => [...p, structuredClone(edits)]);
                    setFuture([]);
                  }
                }}
                onPointerDown={() => {
                  setPast((p) => [...p, structuredClone(edits)]);
                  setFuture([]);
                }}
                onChange={(e) => {
                  setEdits(
                    edits.map((edit, i) =>
                      i === selected
                        ? { ...sticker, size: Number(e.target.value) }
                        : edit,
                    ),
                  );
                }}
              />
            </label>
            <button
              className="icon-button"
              aria-label="선택한 스티커 삭제"
              onClick={() => {
                commit(edits.filter((_, i) => i !== selected));
                setSelected(null);
              }}
            >
              <Trash2 size={19} />
            </button>
          </div>
        )}
        <p className="editor-note">
          원본은 따로 보관돼요. ‘저장’을 누르면 새 편집본이 생겨요. 뒤로 가도
          작업 중인 초안은 남아요.
        </p>
      </div>
    </section>
  );
}
