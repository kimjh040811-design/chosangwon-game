import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { specialScene, profile, nameOf } from "./data";
import type { Game } from "./model";
import type { Action } from "./engine";
export default function SpecialEvent({
  game,
  dispatch,
}: {
  game: Game;
  dispatch: (a: Action) => void;
}) {
  const [choice, setChoice] = useState<"respect" | "rush" | null>(null);
  const scene = specialScene(game);
  return (
    <div className="modal-backdrop">
      <section
        className="modal-sheet special-event"
        role="dialog"
        aria-modal="true"
        aria-label="우리의 마지막 대화"
      >
        <p className="eyebrow">집으로 돌아가는 길</p>
        <h2>사진을 고르며 나눈 이야기</h2>
        {!game.specialResult ? (
          <>
            <img
              className="avatar special-portrait"
              src={profile(scene.friend)}
              alt={nameOf(scene.friend)}
            />
            <p>{scene.text}</p>
            {(["respect", "rush"] as const).map((key) => (
              <button
                key={key}
                className={choice === key ? "selected" : ""}
                aria-pressed={choice === key}
                onClick={() => setChoice(key)}
              >
                {scene[key]}
              </button>
            ))}
            <button
              className="primary"
              disabled={!choice}
              onClick={() => {
                if (choice) dispatch({ type: "special", choice });
              }}
            >
              이 말 전하기
            </button>
            <button
              className="text-button"
              onClick={() => dispatch({ type: "returnToPhone" })}
            >
              <ArrowLeft size={16} /> 휴대폰을 더 살펴볼래
            </button>
          </>
        ) : (
          <>
            <div className="special-sent">
              {game.specialChoice === "rush" ? scene.rush : scene.respect}
            </div>
            <div className="special-response" role="status">
              <img
                className="avatar"
                src={profile(game.specialResult.friend)}
                alt={nameOf(game.specialResult.friend)}
              />
              <p>{game.specialResult.reply}</p>
            </div>
            <button
              className="primary"
              onClick={() => dispatch({ type: "completeSpecial" })}
            >
              이야기를 나누고 하루 마무리
            </button>
          </>
        )}
      </section>
    </div>
  );
}
