import { ArrowLeft, ArrowRight } from "lucide-react";
import { introLines, nameOf, profile } from "./data";
import { episodeById } from "./episodes";
import type { Game } from "./model";
import type { Action } from "./engine";
export default function Intro({
  game,
  dispatch,
}: {
  game: Game;
  dispatch: (action: Action) => void;
}) {
  const lines = introLines(game),
    index = Math.min(game.story.introLine, lines.length - 1);
  return (
    <main className="intro-page" aria-label="주인공의 혼잣말">
      <img
        className="intro-portrait"
        src={profile(game.hero)}
        alt={nameOf(game.hero)}
      />
      <h1>{nameOf(game.hero)}의 생각</h1>
      {game.episode !== "EP01" && (
        <p>
          {game.episode} · {episodeById(game.episode).title}
        </p>
      )}
      <p className="intro-line" aria-live="polite">
        {lines[index]}
      </p>
      <span className="intro-progress">
        {index + 1} / {lines.length}
      </span>
      <div className="intro-actions">
        <button
          aria-label="이전 독백"
          disabled={index === 0}
          onClick={() => dispatch({ type: "introBack" })}
        >
          <ArrowLeft size={18} /> 이전
        </button>
        <button
          className="primary"
          onClick={() => dispatch({ type: "introNext" })}
        >
          {index === lines.length - 1
            ? "친구들에게 물어보러 가기"
            : "다음 생각"}{" "}
          <ArrowRight size={18} />
        </button>
      </div>
    </main>
  );
}
