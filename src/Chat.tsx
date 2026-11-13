import { episodeById } from "./episodes";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Plus, Send, Users, X, MessageCircle } from "lucide-react";
import {
  characters,
  nameOf,
  episodePhotos,
  isRetiredPhoto,
  profile,
  imageLabel,
  sharedPhotos,
} from "./data";
import { replyOptions, conversationIssue } from "./dialogue";
import { asset, type Action } from "./engine";
import type { Character, Game, ReplyKind } from "./model";
import Photo from "./Photo";
import { PhotoActions } from "./PhotoStage";
import { currentPhotoRound, conversationPhotoId } from "./photo-flow";

export function ChatHistory({ game, room, current }: { game: Game; room: Character | "group"; current?: string | null }) {
  const log = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousRoom = useRef(room);
  const [newReplies, setNewReplies] = useState(false);
  const messages = game.messages[room];
  useEffect(() => {
    if (!log.current) return;
    if (previousRoom.current !== room || nearBottom.current) {
      log.current.scrollTop = log.current.scrollHeight;
      setNewReplies(false);
    } else setNewReplies(true);
    previousRoom.current = room;
  }, [room, messages.length]);
  useEffect(() => {
    if (!log.current) return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
    });
    observer.observe(log.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="review-conversation" aria-label={room === "group" ? "우리 넷 단체 대화" : `${nameOf(room)}와의 대화`}>
      <h2><MessageCircle size={21} aria-hidden="true" />{room === "group" ? "친구들과 대화" : `${nameOf(room)}와 대화`}</h2>
      <div ref={log} className="review-messages" role="log" aria-live="polite" tabIndex={0} onScroll={() => {
        const el = log.current!;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        if (nearBottom.current) setNewReplies(false);
      }}>
        {messages.map((message, index) => {
          const id = message.photoId ?? message.photos?.[0];
          const prior = messages[index - 1];
          const changedPhoto = id && id !== (prior?.photoId ?? prior?.photos?.[0]);
          const photo = id ? asset(game, id).photo : undefined;
          return (
            <div className={`review-message ${message.from === "me" ? "mine" : ""}`} key={message.id}
              data-photo-id={photo} data-issue-id={message.issueId}>
              {message.from !== "me" && <img className="avatar small" src={profile(message.from)} alt={nameOf(message.from)} />}
              <div>
                <strong>{message.from === "me" ? nameOf(message.actor ?? game.hero) : nameOf(message.from)}</strong>
                {changedPhoto && <small className="message-photo-label">{photo !== current && current ? "앞서 본 사진 · " : ""}{imageLabel(game, id)}</small>}
                {message.photos?.length ? message.photos.map((image) => <Photo key={image} photo={asset(game, image).photo} edits={asset(game, image).edits} label={imageLabel(game, image)} />) : <p>{message.text}</p>}
              </div>
            </div>
          );
        })}
        {!messages.length && <p className="review-empty-chat">사진을 보내고 함께 이야기해 볼까요?</p>}
      </div>
      {newReplies && <button className="new-replies" onClick={() => {
        if (log.current) log.current.scrollTop = log.current.scrollHeight;
        nearBottom.current = true;
        setNewReplies(false);
      }}>새 답장 보기 ↓</button>}
    </section>
  );
}

export default function Chat({
  game,
  dispatch,
  onShare,
}: {
  game: Game;
  dispatch: (a: Action) => void;
  onShare: (id: string) => void;
}) {
  const [reply, setReply] = useState<ReplyKind | null>(null);
  const [picker, setPicker] = useState(false);
  const [multiple, setMultiple] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const room = game.room;
  const count = room ? game.messages[room].length : 0;
  useEffect(() => {
    setReply(null);
    setPicker(false);
  }, [room]);
  useEffect(() => {
    setReply(null);
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [room, count]);
  useEffect(() => {
    if (game.chatTarget && game.story.firstContact && !game.pending.length) {
      setSelected([game.chatTarget.photo]);
      setMultiple(false);
      setPicker(true);
    }
  }, [game.chatTarget?.photo, game.story.firstContact, game.pending.length]);
  function picture(id: string) {
    const a = asset(game, id);
    return (
      <Photo photo={a.photo} edits={a.edits} label={imageLabel(game, id)} />
    );
  }
  if (!room)
    return (
      <>
        <div className="section-heading">
          <h2>채팅</h2>
        </div>
        <div className="chat-list">
          {[
            "group" as const,
            ...characters.filter((c) => c.id !== game.hero).map((c) => c.id),
          ].map((id) => (
            <button
              className="chat-row"
              key={id}
              onClick={() =>
                dispatch({ type: "navigate", screen: "chat", room: id })
              }
            >
              {id === "group" ? (
                <span className="group-avatar">
                  <Users />
                </span>
              ) : (
                <img className="avatar" src={profile(id)} alt="" />
              )}
              <div>
                <h3>{id === "group" ? "우리 넷, 함께" : nameOf(id)}</h3>
                <p>{game.messages[id].at(-1)?.text ?? "함께 이야기하기"}</p>
              </div>
              {game.messages[id].some((m) => !m.read) ? (
                <span className="badge">새 메시지</span>
              ) : (
                <ChevronRight />
              )}
            </button>
          ))}
        </div>
      </>
    );
  const ids = sharedPhotos(game, room);
  const round = currentPhotoRound(game);
  const conversationPhoto = conversationPhotoId(game);
  const focusPhoto = conversationPhoto
    ? asset(game, conversationPhoto).photo
    : round?.photo;
  const active = round?.asset ?? ids[0] ?? "";
  const choices = replyOptions(game, room, active);
  const chosen = choices.find((c) => c.kind === reply);
  const pending = game.pending.some((p) => p.room === room);
  const issue = conversationIssue(game, room);
  const focusedActions =
    room === "group" &&
    round?.outcome === "active" &&
    game.chatRequests.group.includes(round.asset) &&
    !pending;
  const gallery = [
    ...episodePhotos(game).map((p) => p.id),
    ...game.versions
      .filter((v) => !v.deleted && !isRetiredPhoto(v.photo))
      .map((v) => v.id),
  ];
  return (
    <section className="conversation">
      <header className="app-header">
        <button
          className="icon-button"
          aria-label="대화 목록"
          onClick={() => dispatch({ type: "navigate", screen: "chat" })}
        >
          <ArrowLeft />
        </button>
        <div>
          <h2>{room === "group" ? "우리 넷, 함께" : nameOf(room)}</h2>
          {room === "group" && !focusedActions && (
            <small>{characters.map((c) => c.name).join(" · ")}</small>
          )}
        </div>
        {focusedActions && (
          <button
            className="icon-button"
            aria-label="사진 첨부"
            onClick={() => {
              setSelected([]);
              setMultiple(false);
              setPicker(true);
            }}
          >
            <Plus />
          </button>
        )}
      </header>
      <div className="message-scroll">
        <p className="chat-date">{episodeById(game.episode).date}</p>
        {round && (
          <button
            className="text-button history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "현재 사진 대화만 보기" : "이전 대화 함께 보기"}
          </button>
        )}
        {game.messages[room]
          .filter((m) => {
            if (!focusPhoto || showHistory) return true;
            if (m.photoId) return asset(game, m.photoId).photo === focusPhoto;
            if (m.photos?.length)
              return m.photos.some(
                (id) => asset(game, id).photo === focusPhoto,
              );
            if (m.issueId)
              return game.issues.some(
                (i) =>
                  i.id === m.issueId &&
                  asset(game, i.photo).photo === focusPhoto,
              );
            return (
              !m.purpose || ["photo_question", "memory"].includes(m.purpose)
            );
          })
          .map((m) => (
            <div
              key={m.id}
              className={`message ${m.from === "me" ? "mine" : ""}`}
            >
              {m.from !== "me" && (
                <img
                  className="avatar small"
                  src={profile(m.from)}
                  alt={nameOf(m.from)}
                />
              )}
              <div>
                {m.from !== "me" && room === "group" && (
                  <span className="message-name">{nameOf(m.from)}</span>
                )}
                {m.photoId && (
                  <small className="message-name">
                    {imageLabel(game, m.photoId)}
                  </small>
                )}
                {m.photos?.length ? (
                  <div className="message-photos">
                    {m.photos.map((id) => (
                      <button
                        key={id}
                        aria-label={`${imageLabel(game, id)} 크게 보기`}
                        onClick={() => setEnlarged(id)}
                      >
                        {picture(id)}
                        <small>{imageLabel(game, id)}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>{m.text}</p>
                )}
              </div>
            </div>
          ))}
        {pending && (
          <button
            className="typing"
            aria-label="기다림 건너뛰기"
            onClick={() => dispatch({ type: "deliver", room })}
          >
            <span />
            <span />
            <span />
            <small>눌러서 바로 읽기</small>
          </button>
        )}
        <div ref={bottom} />
      </div>
      <div
        className={`reply-panel ${focusedActions ? "photo-decision-panel" : ""}`}
      >
        {issue && (
          <p className="attachment-hint">
            「{imageLabel(game, issue.photo)}」에 대한 이야기예요.
          </p>
        )}
        {game.chatTarget && (
          <p className="attachment-hint">
            +를 눌러 「{imageLabel(game, game.chatTarget.photo)}」을 보내
            주세요.
          </p>
        )}
        {!pending && !choices.length && game.story.photoPromptSeen && (
          <p className="attachment-hint">
            +로 사진을 보낸 뒤 마음을 물어보세요.
          </p>
        )}
        <div className="reply-choices">
          {(focusedActions ? [] : choices).map((c) => (
            <button
              key={c.kind}
              className={`${reply === c.kind ? "selected" : ""} reply-${c.kind}`}
              aria-pressed={reply === c.kind}
              onClick={() => setReply(c.kind)}
            >
              {c.text}
            </button>
          ))}
        </div>
        {focusedActions && (
          <PhotoActions game={game} dispatch={dispatch} onShare={onShare} />
        )}
        {!focusedActions && (
          <div className="composer-row">
            <button
              className="icon-button attach-button"
              aria-label="사진 첨부"
              disabled={
                !game.story.photoPromptSeen ||
                pending ||
                (!game.story.firstContact && room !== "group")
              }
              onClick={() => {
                setSelected(game.chatTarget ? [game.chatTarget.photo] : []);
                setMultiple(false);
                setPicker(true);
              }}
            >
              <Plus />
            </button>
            <span className="prepared-text">
              {chosen?.text ?? "보낼 말을 골라 주세요"}
            </span>
            <button
              className="primary send-button"
              aria-label="선택한 답장 보내기"
              disabled={!chosen}
              onClick={() => {
                if (chosen)
                  dispatch({
                    type: "reply",
                    room,
                    kind: chosen.kind,
                    photo: active,
                  });
                setReply(null);
              }}
            >
              <Send size={18} />
            </button>
          </div>
        )}
        {!focusedActions && !pending && game.story.firstContact && (
          <button
            className="text-button"
            onClick={() =>
              dispatch({ type: "navigate", screen: issue ? "sns" : "album" })
            }
          >
            {issue ? "SNS에서 사진 확인하기" : "사진첩에서 편집하기"}
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      {picker && (
        <div className="modal-backdrop">
          <section
            className="modal-sheet attachment-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="사진 첨부"
          >
            <header className="section-heading">
              <h2>사진 고르기</h2>
              <button
                className="icon-button"
                aria-label="사진 첨부 닫기"
                onClick={() => setPicker(false)}
              >
                <X />
              </button>
            </header>
            <p>
              {multiple
                ? "최대 3장을 함께 보낼 수 있어요."
                : "이번에 이야기할 사진 한 장을 골라요."}
            </p>
            <button
              className="text-button"
              onClick={() => {
                setMultiple(!multiple);
                setSelected((ids) => ids.slice(0, 1));
              }}
            >
              {multiple ? "한 장씩 이야기하기" : "여러 사진 보내기"}
            </button>
            <div className="attachment-grid">
              {gallery.map((id) => (
                <button
                  key={id}
                  aria-label={imageLabel(game, id)}
                  aria-pressed={selected.includes(id)}
                  className={selected.includes(id) ? "selected" : ""}
                  onClick={() =>
                    setSelected((s) =>
                      s.includes(id)
                        ? s.filter((v) => v !== id)
                        : !multiple
                          ? [id]
                          : s.length < 3
                            ? [...s, id]
                            : s,
                    )
                  }
                >
                  {picture(id)}
                  <span>{imageLabel(game, id)}</span>
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <div
                className="attachment-preview"
                aria-label="공유할 사진 미리보기"
              >
                {selected.map((id) => (
                  <div key={id}>
                    {picture(id)}
                    <small>{imageLabel(game, id)}</small>
                  </div>
                ))}
              </div>
            )}
            <button
              className="primary full"
              disabled={!selected.length}
              onClick={() => {
                dispatch({ type: "sendPhotos", room, photos: selected });
                setPicker(false);
                setReply(null);
              }}
            >
              공유하기{selected.length ? ` · ${selected.length}장` : ""}
            </button>
          </section>
        </div>
      )}
      {enlarged && (
        <div className="modal-backdrop" onClick={() => setEnlarged(null)}>
          <section
            className="modal-sheet photo-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="사진 크게 보기"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button"
              aria-label="사진 닫기"
              onClick={() => setEnlarged(null)}
            >
              <X />
            </button>
            {picture(enlarged)}
            <p>{imageLabel(game, enlarged)}</p>
          </section>
        </div>
      )}
    </section>
  );
}
