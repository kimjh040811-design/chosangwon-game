import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ImagePlus,
  Pencil,
  Share2,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { asset, uid, type Action } from "./engine";
import {
  imageLabel,
  photoById,
  episodePhotos,
  isRetiredPhoto,
  versionLabel,
  characters,
} from "./data";
import type { Edit, Game, Character } from "./model";
import Photo from "./Photo";
import Editor from "./Editor";

export default function Album({
  game,
  dispatch,
  onShare,
  memories = false,
}: {
  game: Game;
  dispatch: (a: Action) => void;
  onShare: (id: string) => void;
  memories?: boolean;
}) {
  const [focus, setFocus] = useState<string | null>(
    memories || game.editorDraft?.open === false
      ? null
      : (game.editorDraft?.source ?? null),
  );
  const [editing, setEditing] = useState(
    !memories && Boolean(game.editorDraft) && game.editorDraft?.open !== false,
  );
  const [saved, setSaved] = useState<string | null>(null);
  const [showTo, setShowTo] = useState<Character | "group">("group");
  const entries = [
    ...episodePhotos(game).map((p) => ({
      id: p.id,
      photo: p.id,
      edits: [],
      deleted: false,
    })),
    ...game.versions.filter(
      (v) => !isRetiredPhoto(v.photo) && (memories || !v.deleted),
    ),
  ];
  const current = focus ? asset(game, focus) : null;
  useEffect(() => {
    if (game.editorDraft?.open) {
      setFocus(game.editorDraft.source);
      setEditing(true);
    }
  }, [game.editorDraft?.source, game.editorDraft?.open]);
  const savedVersion = game.versions.find((v) => v.id === saved);
  const storeDraft = useCallback(
    (edits: Edit[]) => {
      if (focus)
        dispatch({
          type: "draft",
          source: focus,
          photo: asset(game, focus).photo,
          edits,
        });
    },
    [focus, dispatch, current?.photo],
  );
  function open(id: string, edit = false) {
    if (
      edit &&
      game.editorDraft &&
      game.editorDraft.source !== id &&
      game.editorDraft.edits.length &&
      !window.confirm(
        "편집 중인 다른 사진의 초안이 있어요. 새 사진을 편집하면 그 초안이 바뀌어요. 계속할까요?",
      )
    )
      return;
    setFocus(id);
    setEditing(edit);
    setSaved(null);
    if (edit) dispatch({ type: "draftVisibility", open: true });
    if (!memories)
      dispatch({ type: "viewPhoto", photo: asset(game, id).photo });
  }
  if (editing && current)
    return (
      <div className="modal-backdrop">
        <Editor
          photo={current.photo}
          initial={
            game.editorDraft?.source === focus
              ? game.editorDraft.edits
              : current.edits
          }
          onDraft={storeDraft}
          onClose={() => {
            dispatch({ type: "draftVisibility", open: false });
            setEditing(false);
          }}
          onSave={(edits) => {
            const id = uid();
            dispatch({ type: "saveVersion", id, photo: current.photo, edits });
            setEditing(false);
            setFocus(null);
            setSaved(id);
          }}
        />
      </div>
    );
  return (
    <>
      <div className="section-heading">
        <h2>{memories ? "추억 돌아보기" : "사진첩"}</h2>
        <span className="count">{entries.length}장</span>
      </div>
      {!savedVersion && (
        <div className="album-intro">
          <span>11월의 어느 멋진 날</span>
          <p>
            {memories
              ? "원본과 우리가 만든 모든 편집본이 모였어요."
              : "사진을 크게 보거나, 바로 편집해 보세요."}
          </p>
        </div>
      )}
      {savedVersion && (
        <section
          className="saved-result"
          role="status"
          aria-label="편집본 저장 완료"
        >
          <Photo photo={savedVersion.photo} edits={savedVersion.edits} />
          <div>
            <h3>
              <Check size={18} /> {versionLabel(game, savedVersion.id)}{" "}
              저장했어요
            </h3>
            <button
              className="icon-button"
              aria-label="저장 결과 닫기"
              onClick={() => setSaved(null)}
            >
              <X size={18} />
            </button>
            <div className="saved-actions">
              <label className="show-edited-to">
                보여 줄 친구
                <select
                  aria-label="편집본을 보여 줄 친구"
                  value={showTo}
                  onChange={(e) =>
                    setShowTo(e.target.value as Character | "group")
                  }
                >
                  <option value="group">우리 넷 단체방</option>
                  {characters
                    .filter((c) => c.id !== game.hero)
                    .map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                disabled={Boolean(game.pending.length)}
                onClick={() =>
                  dispatch({
                    type: "resendPhoto",
                    photo: savedVersion.id,
                    room: showTo,
                  })
                }
              >
                친구에게 편집본 보여 주기
              </button>
              <button
                className="primary"
                onClick={() => onShare(savedVersion.id)}
              >
                <Share2 size={17} /> 이 사진으로 게시물 만들기
              </button>
              <button
                onClick={() => {
                  if (game.story.firstContact)
                    dispatch({ type: "finishPhoto", keep: true });
                  setSaved(null);
                }}
              >
                편집본 간직하기
              </button>
            </div>
          </div>
        </section>
      )}
      {!memories &&
        game.editorDraft &&
        !isRetiredPhoto(game.editorDraft.photo) &&
        !editing &&
        !saved && (
          <div className="draft-notice">
            <p>편집하던 사진이 있어요.</p>
            <button onClick={() => open(game.editorDraft!.source, true)}>
              이어서 편집하기 <Pencil size={16} />
            </button>
          </div>
        )}
      <div className="photo-grid">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`photo-card ${entry.id === saved ? "just-saved" : ""}`}
          >
            <button
              className="photo-open"
              aria-label={`${entry.deleted ? "삭제된 편집본" : versionLabel(game, entry.id)} ${photoById(entry.photo).title}`}
              onClick={() => open(entry.id)}
            >
              <Photo photo={entry.photo} edits={entry.edits} />
              <div>
                <span
                  className={`version-badge ${entry.id === entry.photo ? "original" : "edited"}`}
                >
                  {entry.deleted
                    ? "삭제된 편집본"
                    : versionLabel(game, entry.id)}
                </span>
                <h3>{photoById(entry.photo).title}</h3>
                <p>{photoById(entry.photo).note}</p>
              </div>
            </button>
            {!memories && (
              <div className="card-actions">
                <button
                  disabled={Boolean(game.pending.length)}
                  onClick={() =>
                    dispatch({ type: "selectPhoto", photo: entry.id })
                  }
                >
                  이 사진 선택
                </button>
                <button onClick={() => open(entry.id, true)}>
                  <Pencil size={16} />
                  {entry.id === entry.photo ? "편집하기" : "다시 편집"}
                </button>
                <button
                  aria-label={`${imageLabel(game, entry.id)} 공유하기`}
                  onClick={() => onShare(entry.id)}
                >
                  <Share2 size={16} /> 공유하기
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!memories && (
        <div className="gentle-note">
          <ImagePlus size={20} />
          <p>
            모자이크와 스티커로 편집할 수 있어요.
            <br />
            저장하면 원본 옆에 새 편집본이 생겨요.
          </p>
        </div>
      )}
      {!memories &&
        game.story.firstContact &&
        game.story.opinionsSeen &&
        !game.posts.some((p) => !p.deleted) && (
          <button
            className="no-post-choice"
            onClick={() => dispatch({ type: "decideNoPost" })}
          >
            오늘은 사진을 게시하지 않을래
          </button>
        )}
      {memories && (
        <section className="memory-log">
          <h3>우리가 남긴 선택</h3>
          <ol>
            {game.history.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </section>
      )}
      {focus && current && (
        <div className="modal-backdrop">
          <section
            className="modal-sheet photo-detail"
            role="dialog"
            aria-modal="true"
            aria-label="사진 크게 보기"
          >
            <header className="app-header">
              <button
                className="icon-button"
                aria-label="사진 닫기"
                onClick={() => setFocus(null)}
              >
                <ArrowLeft />
              </button>
              <h2>{photoById(current.photo).title}</h2>
              <span className="version-badge">{versionLabel(game, focus)}</span>
            </header>
            <Photo photo={current.photo} edits={current.edits} />
            <p className="muted">{photoById(current.photo).note}</p>
            {!memories && (
              <footer className="detail-actions">
                <button className="primary" onClick={() => open(focus, true)}>
                  <Pencil size={18} /> 편집하기
                </button>
                <button
                  onClick={() => {
                    onShare(focus);
                    setFocus(null);
                  }}
                >
                  <Share2 size={18} /> 공유하기
                </button>
                {game.versions.some((v) => v.id === focus) && (
                  <button
                    className="danger"
                    onClick={() => {
                      dispatch({ type: "deleteVersion", id: focus });
                      setFocus(null);
                    }}
                  >
                    <Trash2 size={18} /> 편집본 삭제
                  </button>
                )}
              </footer>
            )}
          </section>
        </div>
      )}
    </>
  );
}
