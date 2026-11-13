import { useState } from "react";
import { assetPath } from "./asset-path";
import {
  ArrowLeft,
  Bell,
  Heart,
  HelpCircle,
  Home,
  Images,
  MessageCircle,
  Settings2,
  X,
} from "lucide-react";
import type { Game, Notice, Screen } from "./model";
import type { Action } from "./engine";
import { nameOf, episodePhotos } from "./data";
import { storyGuide } from "./story";
import Album from "./Album";
import Chat from "./Chat";
import Social from "./Social";
import { episodeById } from "./episodes";
import JourneyMemories from "./JourneyMemories";
import { PhotoFocus, PhotoResult } from "./PhotoStage";
const apps = [
  { id: "album", label: "사진첩", Icon: Images },
  { id: "chat", label: "채팅", Icon: MessageCircle },
  { id: "sns", label: "SNS", Icon: Heart },
  { id: "notifications", label: "알림", Icon: Bell },
] as const;
export default function PhoneShell({
  game,
  dispatch,
  onReset,
  banner,
  saveError,
}: {
  game: Game;
  dispatch: (a: Action) => void;
  onReset: () => void;
  banner: Notice | null;
  saveError: boolean;
}) {
  const [help, setHelp] = useState(false),
    [settings, setSettings] = useState(false),
    [share, setShare] = useState<string | null>(null);
  const guide = storyGuide(game);
  const [records, setRecords] = useState(false);
  const showPhotoResult = game.photoFlow.result && !game.pending.length;
  function nav(screen: Screen) {
    dispatch({ type: "navigate", screen });
    if (screen === "notifications") dispatch({ type: "readNotices" });
  }
  return (
    <div className="phone-stage">
      <main className={`phone screen-${game.screen}`}>
        <div className="phone-status">
          <span>17:24</span>
          <span>●●● ▰</span>
        </div>
        <header className="phone-appbar">
          {game.screen !== "home" ? (
            <button
              className="icon-button"
              aria-label="홈으로 돌아가기"
              onClick={() => nav("home")}
            >
              <ArrowLeft />
            </button>
          ) : (
            <span className="phone-brand">우리의 추억</span>
          )}
          <span>{apps.find((a) => a.id === game.screen)?.label}</span>
          <button
            className="icon-button"
            aria-label="설정"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={20} />
          </button>
        </header>
        <PhotoFocus game={game} />
        <div className="phone-content">
          {showPhotoResult && <PhotoResult game={game} dispatch={dispatch} />}
          {!showPhotoResult && game.screen === "home" && (
            <div className="phone-home">
              <p className="episode-heading">
                {game.episode} · {episodeById(game.episode).title}
              </p>
              <div className="phone-wallpaper">
                <img
                  src={
                    game.episode === "EP01"
                      ? assetPath("/assets/title/title_main.png")
                      : episodePhotos(game).find((p) => p.width! > p.height!)!
                          .file
                  }
                  alt={episodeById(game.episode).title}
                />
                <div>
                  <strong>17:24</strong>
                  <p>안녕, {nameOf(game.hero)}</p>
                </div>
              </div>
              <div className="home-apps">
                {apps.map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => nav(id)}>
                    <span className={`app-tile tile-${id}`}>
                      <Icon />
                      {id === "chat" &&
                        Object.values(game.messages)
                          .flat()
                          .some((m) => !m.read) && <b className="badge">●</b>}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <button
                className="home-conversation"
                onClick={() =>
                  dispatch({ type: "navigate", screen: "chat", room: "group" })
                }
              >
                <MessageCircle />
                <span>
                  우리 넷, 함께
                  <small>
                    {game.messages.group.at(-1)?.text ??
                      "친구들에게 말을 걸어 보자."}
                  </small>
                </span>
              </button>
              <button
                className="primary full"
                onClick={() => dispatch({ type: "advance" })}
              >
                {guide.label}
              </button>
              <button
                className="text-button full"
                onClick={() => setRecords(true)}
              >
                스테이지 기록 · {Object.keys(game.episodes).length} / 4 완료
              </button>
              {game.story.opinionsSeen &&
                !game.posts.some((p) => !p.deleted) && (
                  <button
                    className="text-button full"
                    onClick={() => dispatch({ type: "decideNoPost" })}
                  >
                    오늘은 올리지 않을래
                  </button>
                )}
            </div>
          )}
          {!showPhotoResult && game.screen === "chat" && (
            <Chat
              game={game}
              dispatch={dispatch}
              onShare={(id) => {
                setShare(id);
                nav("sns");
              }}
            />
          )}
          {!showPhotoResult && game.screen === "album" && (
            <Album
              game={game}
              dispatch={dispatch}
              onShare={(id) => {
                setShare(id);
                nav("sns");
              }}
            />
          )}
          {!showPhotoResult && game.screen === "sns" && (
            <Social
              game={game}
              dispatch={dispatch}
              share={share}
              onShared={() => setShare(null)}
            />
          )}
          {!showPhotoResult && game.screen === "notifications" && (
            <div className="notifications">
              {[...game.notices].reverse().map((n) => (
                <button
                  key={n.id}
                  onClick={() =>
                    dispatch({
                      type: "navigate",
                      screen: "chat",
                      room: n.room ?? null,
                    })
                  }
                >
                  <MessageCircle />
                  <p>{n.text}</p>
                </button>
              ))}
              {!game.notices.length && <p>새로운 알림이 없어요.</p>}
            </div>
          )}
        </div>
        <footer className="phone-controls">
          <button aria-label="도움말" onClick={() => setHelp(true)}>
            <HelpCircle size={21} />
          </button>
          <button aria-label="홈" onClick={() => nav("home")}>
            <Home size={23} />
          </button>
          <span className="phone-save">
            {saveError ? "저장 확인 필요" : "자동 저장"}
          </span>
        </footer>
        {banner && game.screen !== "chat" && (
          <button
            className="phone-notice"
            onClick={() =>
              dispatch({ type: "navigate", screen: "chat", room: banner.room })
            }
          >
            {banner.text}
          </button>
        )}
        {(help || settings) && (
          <div className="modal-backdrop">
            <section
              className={`modal-sheet ${settings ? "settings" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label={help ? "도움말" : "설정"}
            >
              <button
                className="icon-button"
                aria-label="닫기"
                onClick={() => {
                  setHelp(false);
                  setSettings(false);
                }}
              >
                <X />
              </button>
              {help ? (
                <>
                  <h2>{guide.title}</h2>
                  <p>{guide.text}</p>
                  <button
                    className="primary full"
                    onClick={() => {
                      setHelp(false);
                      dispatch({ type: "advance" });
                    }}
                  >
                    {guide.label}
                  </button>
                </>
              ) : (
                <>
                  <h2>우리의 속도로</h2>
                  <label>
                    친구의 답장 속도
                    <select
                      value={game.speed}
                      onChange={(e) =>
                        dispatch({
                          type: "speed",
                          value: Number(e.target.value),
                        })
                      }
                    >
                      <option value={2400}>천천히</option>
                      <option value={1200}>보통</option>
                      <option value={400}>빠르게</option>
                    </select>
                  </label>
                  <button
                    className="primary full"
                    onClick={() => setSettings(false)}
                  >
                    완료
                  </button>
                  <button
                    className="text-button full"
                    onClick={() => {
                      setSettings(false);
                      onReset();
                    }}
                  >
                    처음부터 시작하기
                  </button>
                </>
              )}
            </section>
          </div>
        )}
        {records && (
          <div className="modal-backdrop">
            <section
              className="modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="스테이지 기록"
            >
              <button
                className="icon-button"
                aria-label="기록 닫기"
                onClick={() => setRecords(false)}
              >
                <X />
              </button>
              <JourneyMemories game={game} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
