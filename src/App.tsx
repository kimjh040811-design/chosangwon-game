import EpisodePlay from "./EpisodePlay";
import { assetPath } from "./asset-path";
import { evaluateTrust } from "./review";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Flower2,
  Heart,
  Images,
  ShieldCheck,
} from "lucide-react";
import { characters, nameOf, profile, specialScene } from "./data";
import Intro from "./Intro";
import JourneyMemories from "./JourneyMemories";
import { nextEpisode, episodeById } from "./episodes";
import { episodeSummary, journeySummary } from "./narrative";
import { loadGame, newGame, reduceGame, SAVE_KEY, type Action } from "./engine";
import type { Character, Game } from "./model";
function Avatar({ id }: { id: Character }) {
  return <img src={profile(id)} className="avatar" alt={nameOf(id)} />;
}
export default function App() {
  const [game, setGame] = useState<Game | null>(loadGame),
    [started, setStarted] = useState(false);
  const [memories, setMemories] = useState(false),
    [error, setError] = useState("");
  const [unreadableSave, setUnreadableSave] = useState<string | null>(() => {
    try {
      return game ? null : localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  });
  const dispatch = useCallback(
    (action: Action) => setGame((g) => (g ? reduceGame(g, action) : g)),
    [],
  );
  useEffect(() => {
    if (!game) return;
    try {
      const previous = localStorage.getItem(SAVE_KEY);
      if (previous && JSON.parse(previous).review?.policyVersion !== 1 && !localStorage.getItem(SAVE_KEY + "-before-photo16"))
        localStorage.setItem(SAVE_KEY + "-before-photo16", previous);
      if (previous && JSON.parse(previous).revision !== 8 && !localStorage.getItem(SAVE_KEY + "-before-integrated"))
        localStorage.setItem(SAVE_KEY + "-before-integrated", previous);
      localStorage.setItem(SAVE_KEY, JSON.stringify(game));
      setError("");
    } catch {
      setError(
        "브라우저에 저장할 공간이 부족해요. 지금 진행은 유지되지만 새로고침하면 사라질 수 있어요.",
      );
    }
  }, [game]);
  useEffect(() => {
    if (!started || !game?.pending.length) return;
    const timer = setTimeout(() => dispatch({ type: "deliver" }), game.speed);
    return () => clearTimeout(timer);
  }, [started, game?.pending, game?.speed, dispatch]);
  function reset() {
    if (
      (game || unreadableSave !== null) &&
      !window.confirm(
        "주인공, 대화, 편집 사진, 게시물, 추억 기록을 모두 지우고 새로 시작할까요?",
      )
    )
      return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      setError("이 브라우저에서는 저장 공간에 접근할 수 없어요.");
    }
    setGame(reduceGame(newGame("maru"), { type: "reviewStart" }));
    setStarted(true);
    setMemories(false);
    setUnreadableSave(null);
  }
  function begin() {
    setGame(reduceGame(newGame("maru"), { type: "reviewStart" }));
    setStarted(true);
  }
  if (!started)
    return (
      <div className="landing">
        <header className="landing-header">
          <a className="brand" href="./">
            <span className="brand-icon">
              <ShieldCheck size={22} />
            </span>
            <span>초상권을 지켜라!</span>
          </a>
          <span className="episode-label">
            EP.01 <i /> 우리의 추억
          </span>
        </header>
          <main className="title-layout">
            <div className="title-copy">
              <div className="eyebrow">
                <span className="tiny-flower">✳</span> 친구와 함께 만드는 이야기
              </div>
              <h1>
                함께한 순간,
                <br />
                소중한 <span>우리의 추억.</span>
              </h1>
              <p>
                즐거웠던 하루가 사진 속에 담겼어요.
                <br />
                친구들의 마음을 듣고,
                <br />
                우리만의 이야기를 이어 가 볼까요?
              </p>
              <div className="title-buttons">
                {unreadableSave !== null && (
                  <section className="save-recovery" role="alert">
                    <p>
                      지금 버전에서 저장 기록을 읽을 수 없어요. 원본 기록을
                      내려받아 보관할 수 있어요.
                    </p>
                    <button
                      onClick={() => {
                        const url = URL.createObjectURL(
                          new Blob([unreadableSave], {
                            type: "application/json",
                          }),
                        );
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "our-memories-save-backup.json";
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}
                    >
                      저장 원본 내려받기
                    </button>
                  </section>
                )}
                {game ? (
                  <>
                    <button
                      className="primary"
                      onClick={() => setStarted(true)}
                    >
                      이야기 이어하기 <ArrowRight size={19} />
                    </button>
                    <button className="text-button" onClick={reset}>
                      처음부터 시작하기
                    </button>
                  </>
                ) : (
                  <button
                    className="primary"
                    onClick={() =>
                      unreadableSave !== null ? reset() : begin()
                    }
                  >
                    이야기 시작하기 <ArrowRight size={19} />
                  </button>
                )}
              </div>
              <div className="title-friends">
                {characters.map((c) => (
                  <Avatar key={c.id} id={c.id} />
                ))}
                <span>우리 넷의 특별한 하루</span>
              </div>
            </div>
            <div className="title-art">
              <img
                src={assetPath("/assets/title/title_main.png")}
                alt="롯데월드에서 함께 웃는 치이카와, 하치와레, 우사기, 마루"
              />
              <div className="photo-caption">
                <Flower2 size={19} />
                <span>오래 기억하고 싶은, 오늘</span>
                <Heart size={17} />
              </div>
            </div>
            <div className="landing-foot">
              <span>서로의 마음을 알아 가는 SNS 스토리 게임</span>
              <span>사진 · 대화 · 그리고 우리</span>
            </div>
          </main>
      </div>
    );
  if (!game) return null;
  const trustResult = evaluateTrust(game);
  if (game.stage === "intro")
    return (
      <>
        <Intro game={game} dispatch={dispatch} />
        {error && (
          <p role="alert" className="save-error">
            {error}
          </p>
        )}
      </>
    );
  if (game.stage === "stageComplete")
    return (
      <main className="stage-complete">
        <p>{game.episode}</p>
        <h1>{episodeById(game.episode).title}</h1>
        <p>{episodeSummary(game.episode, game)}</p>
        <section className="trust-result" aria-label="이번 만남의 신뢰도">
          <p>이번 만남의 신뢰도</p><strong>{trustResult.percent}%</strong>
          <progress max={100} value={trustResult.percent} aria-label="신뢰도" />
          <ul>{trustResult.feedback.map((text) => <li key={text}>{text}</li>)}</ul>
          <div className="review-activities" aria-label="이번에 해 본 활동"><p>이번에 해 본 활동</p><ul>{trustResult.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul></div>
          {trustResult.remaining > 0 && <p>아직 남은 사진 부탁이 {trustResult.remaining}개 있어요.</p>}
        </section>
        <button
          className="primary"
          onClick={() => {
            setMemories(false);
            dispatch({ type: "reviewNext" });
          }}
        >
          {nextEpisode(game.episode) ? "다음으로" : "최종 이야기 보기"}
        </button>
        <button onClick={() => setMemories(!memories)}>추억 돌아보기</button>
        <button onClick={reset}>다시 플레이하기</button>
        {memories && (
          <>
            <button className="text-button" onClick={() => setMemories(false)}>
              이야기로 돌아가기
            </button>
            <JourneyMemories game={game} />
          </>
        )}
        {error && (
          <p className="save-error" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  if (game.stage === "ending")
    return (
      <main className="ending-page">
        {memories ? (
          <div className="memories-wrap">
            <button className="text-button" onClick={() => setMemories(false)}>
              <ArrowLeft size={18} /> 이야기로 돌아가기
            </button>
            <JourneyMemories game={game} />
          </div>
        ) : (
          <>
            <img
              className="ending-image"
              src={assetPath(`/assets/endings/ending_${game.ending}.png`)}
              alt="하루를 마무리하는 네 친구"
            />
            <div className="ending-copy">
              <p className="eyebrow">우리의 추억, 그리고 내일</p>
              <p>
                {game.episode === "EP04"
                  ? game.ending === "unresolved"
                    ? "네 번의 만남에서 아직 해결하지 못한 사진 부탁이 남아 있어요. 추억 기록에서 함께 돌아볼까요?"
                    : game.ending === "recovery"
                      ? "사진을 나누며 서로의 부탁을 듣고, 게시한 사진을 다시 살폈어요. 네 번의 이야기가 추억으로 남았어요."
                      : "사진을 나누거나 간직하면서 친구들의 마음을 알아봤어요. 네 번의 만남을 추억으로 남겼어요."
                  : game.ending === "unresolved"
                    ? "아직 다 듣지 못한 마음이 남아 있어요. 다음에는 사진 속 친구에게 먼저 말을 걸어 볼까요?"
                    : game.ending === "recovery"
                      ? `${game.apologized.length ? "미안하다는 말과 함께," : "친구의 부탁을 듣고,"} ${game.history.some((h) => h.includes("내렸") || h.includes("게시물을 삭제")) ? "사진을 내렸어요." : "공개하는 방법을 다시 정했어요."} 서로의 마음을 다시 알아 가는 시간이 되었어요.`
                      : game.skipped
                        ? "오늘의 사진은 우리끼리 간직하기로 했어요. 올리지 않아도, 함께한 추억은 사라지지 않아요."
                        : game.consents.length
                          ? "사진 속 친구의 마음을 먼저 물었어요. 서로를 존중한 오늘이 다정한 추억으로 남았어요."
                          : "사진 속에 누가 보이는지 살피고 추억을 나눴어요. 친구의 마음을 듣는 이야기는 앞으로도 이어져요."}
              </p>
              <p className="ending-detail">
                {game.episode === "EP01"
                  ? (game.specialResult?.reply ?? specialScene(game).response)
                  : "네 번의 만남에서 고른 사진과 나눈 이야기가 추억으로 남았어요."}
              </p>
              <ul
                className="journey-choice-summary"
                aria-label="우리가 남긴 선택"
              >
                {journeySummary(game).map((item) => (
                  <li key={item.episode}>{item.text}</li>
                ))}
              </ul>
              <div className="ending-actions">
                {nextEpisode(game.episode) && (
                  <button
                    className="primary"
                    onClick={() => {
                      setMemories(false);
                      dispatch({ type: "nextEpisode" });
                    }}
                  >
                    {nextEpisode(game.episode)!.id} 시작하기{" "}
                    <ArrowRight size={18} />
                  </button>
                )}
                <button className="primary" onClick={() => setMemories(true)}>
                  <Images size={18} /> 추억 돌아보기
                </button>
                <button onClick={reset}>
                  다시 플레이하기 <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="save-error">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <>
      <EpisodePlay key={game.episode} game={game} dispatch={dispatch} saveError={error} />
    </>
  );
}
