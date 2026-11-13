import { useEffect, useState } from "react";
import {
  Globe2,
  Heart,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { asset, type Action } from "./engine";
import {
  nameOf,
  photoById,
  episodePhotos,
  isRetiredPhoto,
  profile,
  versionLabel,
  imageLabel,
} from "./data";
import type { Audience, Game } from "./model";
import Photo from "./Photo";
import { PhotoActions } from "./PhotoStage";
export default function Social({
  game,
  dispatch,
  share,
  onShared,
}: {
  game: Game;
  dispatch: (a: Action) => void;
  share: string | null;
  onShared: () => void;
}) {
  const [compose, setCompose] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [caption, setCaption] = useState("함께라서 더 좋았던 하루 🌷"),
    [audience, setAudience] = useState<Audience>("close");
  const [editingScope, setEditingScope] = useState<string | null>(null);
  const [multiple, setMultiple] = useState(false);
  useEffect(() => {
    if (share) {
      setSelected([share]);
      setMultiple(false);
      setCompose(true);
      onShared();
    }
  }, [share]);
  const entries = [
    ...game.versions.filter((v) => !v.deleted && !isRetiredPhoto(v.photo)),
    ...episodePhotos(game).map((p) => ({ id: p.id, photo: p.id, edits: [] })),
  ];
  const posts = game.posts.filter((p) => !p.deleted);
  if (game.episode === "EP01" && !game.story.firstContact)
    return (
      <section className="empty-state">
        <h2>사진을 올리고 싶은 마음</h2>
        <p>친구들에게 보낼 첫 메시지를 준비해 볼까요?</p>
        <button
          onClick={() =>
            dispatch({ type: "prepareChat", photo: "group", room: "group" })
          }
        >
          친구들에게 연락하기
        </button>
      </section>
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2 className="social-logo">
            moments<span>✳</span>
          </h2>
        </div>
        <button
          className="primary"
          onClick={() => {
            setSelected([]);
            setMultiple(false);
            setCompose(true);
          }}
        >
          <Plus size={19} /> 새 게시물
        </button>
      </div>
      <div className="social-subhead">
        <Heart size={15} /> 우리들의 작은 순간이 모이는 곳
      </div>
      {!posts.length && (
        <div className="empty-state">
          <div className="empty-icon">
            <ImageSymbol />
          </div>
          <h3>어떤 순간을 남길까요?</h3>
          <p>
            사진을 골라 이야기를 나눠 보세요.
            <br />
            우리끼리 추억으로 간직해도 좋아요.
          </p>
          <button onClick={() => setCompose(true)}>
            첫 게시물 만들기 <Plus size={17} />
          </button>
          {game.story.opinionsSeen && (
            <button
              className="text-button"
              onClick={() => dispatch({ type: "decideNoPost" })}
            >
              오늘은 사진을 게시하지 않을래
            </button>
          )}
        </div>
      )}
      <div className="feed">
        {posts.map((post) => (
          <article className="post" key={post.id}>
            <header>
              <img src={profile(game.hero)} className="avatar small" alt="" />
              <div>
                <strong>{nameOf(game.hero)}</strong>
                <span>
                  {post.audience === "public" ? (
                    <Globe2 size={12} />
                  ) : (
                    <Users size={12} />
                  )}{" "}
                  {post.audience === "public" ? "전체 공개" : "친한 친구"}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label="게시물 삭제"
                onClick={() => dispatch({ type: "deletePost", id: post.id })}
              >
                <Trash2 size={18} />
              </button>
            </header>
            <div className={`post-photos post-count-${post.photos.length}`}>
              {post.photos.map((id) => {
                const image = asset(game, id);
                return (
                  <div key={id}>
                    <Photo photo={image.photo} edits={image.edits} />
                    <span className="posted-version">
                      {versionLabel(game, id)}
                    </span>
                    <button
                      aria-label={`${photoById(image.photo).title} 게시 사진 삭제`}
                      onClick={() =>
                        dispatch({
                          type: "removePhoto",
                          post: post.id,
                          photo: id,
                        })
                      }
                    >
                      <X size={14} /> 사진 내리기
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="post-content">
              <div className="post-icons">
                <Heart size={22} />
                <MessageCircle size={22} />
                <Send size={21} />
              </div>
              <p>
                <strong>{nameOf(game.hero)}</strong> {post.caption}
              </p>
              <div className="comments">
                {post.comments.map((comment, i) => (
                  <p key={i}>
                    {post.photos.length > 1 && comment.photoId && (
                      <small className="comment-photo-name">
                        {imageLabel(game, comment.photoId)}
                      </small>
                    )}
                    <strong>{nameOf(comment.friend)}</strong> {comment.text}
                  </p>
                ))}
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setAudience(post.audience);
                  setEditingScope(post.id);
                }}
              >
                게시물 설정
              </button>
            </div>
          </article>
        ))}
      </div>
      {!compose && !editingScope && (
        <PhotoActions
          game={game}
          dispatch={dispatch}
          onShare={(id) => {
            setSelected([id]);
            setMultiple(false);
            setCompose(true);
          }}
        />
      )}
      {editingScope && (
        <div className="modal-backdrop">
          <section
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="게시물 설정"
          >
            <h2>공개 범위 수정</h2>
            <label>
              누구에게 보여 줄까요?
              <select
                aria-label="게시물 공개 범위 변경"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
              >
                <option value="close">친한 친구</option>
                <option value="public">전체 공개</option>
              </select>
            </label>
            <button
              className="primary full"
              onClick={() => {
                dispatch({ type: "audience", post: editingScope, audience });
                setEditingScope(null);
              }}
            >
              변경 저장
            </button>
            <button
              className="text-button full"
              onClick={() => setEditingScope(null)}
            >
              취소
            </button>
          </section>
        </div>
      )}
      {compose && (
        <div className="modal-backdrop">
          <section
            className="modal-sheet compose"
            role="dialog"
            aria-modal="true"
            aria-label="새 게시물 만들기"
          >
            <header className="app-header">
              <button
                className="icon-button"
                aria-label="작성 닫기"
                onClick={() => setCompose(false)}
              >
                <X />
              </button>
              <h2>새로운 순간</h2>
              <span>
                {selected.length} / {multiple ? 3 : 1}
              </span>
            </header>
            <div className="compose-body">
              <label className="field-label">
                사진을 골라 주세요{" "}
                <span>
                  {multiple ? "최대 3장" : "이야기할 사진 한 장"} · 편집본이
                  먼저 보여요
                </span>
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setMultiple(!multiple);
                  setSelected((ids) => ids.slice(0, 1));
                }}
              >
                {multiple ? "한 장씩 이야기하기" : "여러 사진 올리기"}
              </button>
              <div className="picker">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    className={selected.includes(entry.id) ? "picked" : ""}
                    aria-pressed={selected.includes(entry.id)}
                    aria-label={`${photoById(entry.photo).title} ${versionLabel(game, entry.id)}`}
                    disabled={
                      multiple &&
                      !selected.includes(entry.id) &&
                      selected.length >= 3
                    }
                    onClick={() =>
                      setSelected((items) =>
                        items.includes(entry.id)
                          ? items.filter((id) => id !== entry.id)
                          : multiple
                            ? [...items, entry.id]
                            : [entry.id],
                      )
                    }
                  >
                    <Photo photo={entry.photo} edits={entry.edits} />
                    <span
                      className={`version-badge ${entry.id === entry.photo ? "original" : "edited"}`}
                    >
                      {versionLabel(game, entry.id)}
                    </span>
                    {selected.includes(entry.id) && (
                      <b>{selected.indexOf(entry.id) + 1}</b>
                    )}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="caption">
                오늘의 한마디
              </label>
              <textarea
                id="caption"
                maxLength={200}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
              />
              <label className="field-label" htmlFor="audience">
                누구에게 보여 줄까요?
              </label>
              <select
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
              >
                <option value="close">친한 친구에게</option>
                <option value="public">모두에게 · 전체 공개</option>
              </select>
              <button
                className="primary full"
                disabled={!selected.length}
                onClick={() => {
                  dispatch({
                    type: "post",
                    photos: selected,
                    caption,
                    audience,
                  });
                  setCompose(false);
                }}
              >
                게시하기 <Send size={17} />
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function ImageSymbol() {
  return (
    <>
      <span>✿</span>
      <Heart size={30} />
    </>
  );
}
