import { useEffect, useRef, useState } from "react";

export function usePlayFocus() {
  const root = useRef<HTMLElement>(null);
  const ownsFullscreen = useRef(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === root.current) ownsFullscreen.current = true;
      else if (ownsFullscreen.current) {
        ownsFullscreen.current = false;
        setFocused(false);
        setNote("");
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setFocused(false);
        setNote("");
      }
    };
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (focused) document.body.classList.add("game-focus-open");
    else document.body.classList.remove("game-focus-open");
    return () => document.body.classList.remove("game-focus-open");
  }, [focused]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setNote("");
    if (focused) {
      setFocused(false);
      try {
        if (document.fullscreenElement === root.current) await document.exitFullscreen();
      } catch {
        if (document.fullscreenElement === root.current) {
          setFocused(true);
          setNote("Esc 키를 누르면 전체화면에서 나갈 수 있어요.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    setFocused(true);
    try {
      if (!root.current?.requestFullscreen) throw new Error("Fullscreen unavailable");
      await root.current.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setNote("게임 화면을 크게 펼쳤어요. 위의 작게 보기 버튼으로 돌아갈 수 있어요.");
    } finally {
      setBusy(false);
    }
  }

  return { root, focused, busy, note, toggle };
}
