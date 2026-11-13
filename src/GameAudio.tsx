import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Music2, Volume2, VolumeX } from "lucide-react";
import { assetPath } from "./asset-path";
import type { Game } from "./model";
import type { Action } from "./engine";

export const AUDIO_KEY = "our-memories-audio-v1";
type Preferences = { music: boolean; effects: boolean };
type Sound = "tap" | "send" | "receive" | "save" | "publish" | "remove";
const notes: Record<Sound, number[]> = {
  tap: [660], send: [523, 784], receive: [659, 523],
  save: [523, 659, 784], publish: [523, 659, 784, 1047], remove: [523, 392],
};
const AudioContextValue = createContext<{
  preferences: Preferences; playing: boolean; message: string;
  activate: () => void; toggle: (key: keyof Preferences) => void;
  transition: (before: Game, after: Game, action: Action) => void;
} | null>(null);

export function GameAudioProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? "null");
      return { music: saved?.music !== false, effects: saved?.effects !== false };
    } catch { return { music: true, effects: true }; }
  });
  const settings = useRef(preferences);
  const audio = useRef<HTMLAudioElement>(null);
  const context = useRef<AudioContext | null>(null);
  const voices = useRef(new Set<OscillatorNode>());
  const activated = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const playMusic = useCallback(() => {
    const element = audio.current;
    if (!element || !settings.current.music || document.hidden) return;
    element.volume = 0.18;
    void element.play().then(() => {
      if (!settings.current.music || document.hidden) element.pause();
      else setMessage("");
    }).catch(() => setMessage("음악을 켜려면 배경음악 버튼을 눌러 주세요."));
  }, []);
  const activate = useCallback(() => {
    activated.current = true;
    if (settings.current.effects) {
      try {
        context.current ??= new AudioContext();
        void context.current.resume().catch(() => {});
      } catch { /* Sound support must never interrupt the game. */ }
    }
    playMusic();
  }, [playMusic]);
  const sound = useCallback((kind: Sound) => {
    const ctx = context.current;
    if (!settings.current.effects || document.hidden || !ctx || ctx.state !== "running") return;
    try {
      notes[kind].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        const start = ctx.currentTime + index * 0.085;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        oscillator.connect(gain).connect(ctx.destination);
        voices.current.add(oscillator);
        oscillator.onended = () => { voices.current.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start); oscillator.stop(start + 0.16);
      });
    } catch { /* Audio is optional on restricted devices. */ }
  }, []);
  const toggle = useCallback((key: keyof Preferences) => {
    const next = { ...settings.current, [key]: !settings.current[key] };
    // A blocked playback attempt can be retried without first muting it.
    if (key === "music" && settings.current.music && audio.current?.paused) next.music = true;
    settings.current = next;
    setPreferences(next);
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(next)); } catch { /* Keep session preferences. */ }
    if (!next.music) { audio.current?.pause(); setMessage(""); }
    if (!next.effects) voices.current.forEach((voice) => { try { voice.stop(); } catch { /* already ended */ } });
    activate();
  }, [activate]);
  const transition = useCallback((before: Game, after: Game, action: Action) => {
    if (before === after) return;
    if (after.versions.length > before.versions.length) return sound("save");
    if (after.posts.length > before.posts.length || (after.stage === "stageComplete" && before.stage !== after.stage)) return sound("publish");
    if (action.type === "removePhoto" || action.type === "deletePost") {
      if (JSON.stringify(before.posts) !== JSON.stringify(after.posts)) sound("remove");
      return;
    }
    const count = (game: Game, mine: boolean) => Object.values(game.messages).flat().filter((m) => (m.from === "me") === mine).length;
    if (count(after, true) > count(before, true)) return sound("send");
    if (count(after, false) > count(before, false)) return sound("receive");
    if (["introNext", "introBack", "reviewSelect", "reviewDecide", "reviewContinue", "reviewAudience"].includes(action.type)) sound("tap");
  }, [sound]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        audio.current?.pause();
        voices.current.forEach((voice) => { try { voice.stop(); } catch { /* already ended */ } });
      } else if (activated.current) playMusic();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [playMusic]);
  useEffect(() => () => {
    voices.current.forEach((voice) => { try { voice.stop(); } catch { /* already ended */ } });
    void context.current?.close().catch(() => {});
    context.current = null;
  }, []);
  return <AudioContextValue.Provider value={{ preferences, playing, message, activate, toggle, transition }}>
    <audio ref={audio} data-game-bgm src={assetPath("assets/audio/after-school-minigame.mp3")} loop preload="none"
      onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setMessage("음악을 불러오지 못했어요. 게임은 계속할 수 있어요.")} />
    {children}
  </AudioContextValue.Provider>;
}

export function useGameAudio() {
  const value = useContext(AudioContextValue);
  if (!value) throw new Error("GameAudioProvider is required");
  return value;
}

export function GameAudioControls() {
  const { preferences, playing, message, toggle } = useGameAudio();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div className="game-audio-controls" ref={root} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.stopPropagation(); setOpen(false); root.current?.querySelector("button")?.focus(); }
  }}>
    <button className="audio-settings-button" aria-label="소리 설정" aria-expanded={open} onClick={() => setOpen(!open)}>
      {preferences.music || preferences.effects ? <Volume2 size={20} /> : <VolumeX size={20} />}<span>소리</span>
    </button>
    {open && <div className="audio-settings-panel" aria-label="소리 설정 메뉴">
      <strong>소리 설정</strong>
      <button aria-label={playing ? "배경음악 끄기" : "배경음악 켜기"} aria-pressed={playing} onClick={() => toggle("music")}>
        <Music2 size={18} /><span>배경음악<small>After School Minigame</small></span><b>{playing ? "켜짐" : "꺼짐"}</b>
      </button>
      <button aria-label={preferences.effects ? "효과음 끄기" : "효과음 켜기"} aria-pressed={preferences.effects} onClick={() => toggle("effects")}>
        <Volume2 size={18} /><span>효과음</span><b>{preferences.effects ? "켜짐" : "꺼짐"}</b>
      </button>
      <p>음악과 효과음을 따로 켜고 끌 수 있어요.</p>
      {message && <p role="status">{message}</p>}
    </div>}
  </div>;
}
