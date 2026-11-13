import type { Game } from "./model";
import type { Action } from "./engine";
import { imageInfo, imageLabel, photoById } from "./data";
import {
  currentPhotoRound,
  conversationPhotoId,
  canFinishPhoto,
  photoRoundSummary,
  roundHasLivePost,
  roundIssues,
  roundPosts,
} from "./photo-flow";
import { protectsFriend } from "./protection";
import Photo from "./Photo";

type Dispatch = (action: Action) => void;

export function editCurrentPhoto(game: Game, id: string, dispatch: Dispatch) {
  if (
    game.editorDraft &&
    game.editorDraft.source !== id &&
    game.editorDraft.edits.length &&
    !window.confirm(
      "편집 중인 다른 사진의 초안이 있어요. 새 사진을 편집하면 그 초안이 바뀌어요. 계속할까요?",
    )
  )
    return;
  dispatch({ type: "editPhoto", photo: id });
}

export function PhotoFocus({ game }: { game: Game }) {
  const round = currentPhotoRound(game);
  const id = conversationPhotoId(game);
  if (!id) return null;
  const image = imageInfo(game, id);
  return (
    <aside className="photo-focus" aria-label="현재 사진">
      <Photo photo={image.photo} edits={image.edits} />
      <div>
        <small>
          {round?.photo === image.photo
            ? `${game.episode} · 사진 ${game.photoFlow.current! + 1}`
            : "친구가 이야기하는 사진"}
        </small>
        <strong>{imageLabel(game, id)}</strong>
      </div>
    </aside>
  );
}

export function PhotoResult({
  game,
  dispatch,
}: {
  game: Game;
  dispatch: Dispatch;
}) {
  return (
    <section className="photo-result" aria-label="사진 이야기 마무리">
      <h2>이 사진의 이야기를 남겼어요</h2>
      <p>{photoRoundSummary(game)}</p>
      <button
        className="primary full"
        onClick={() => dispatch({ type: "nextPhoto" })}
      >
        다른 사진 고르기
      </button>
      <button
        className="full"
        onClick={() => dispatch({ type: "finishMeeting" })}
      >
        {game.episode === "EP04"
          ? "전체 이야기 마무리"
          : game.episode === "EP01"
            ? "이번 만남 마무리"
            : "다음 만남으로"}
      </button>
    </section>
  );
}

export function PhotoActions({
  game,
  dispatch,
  onShare,
}: {
  game: Game;
  dispatch: Dispatch;
  onShare: (id: string) => void;
}) {
  const round = currentPhotoRound(game);
  if (!round || round.outcome !== "active" || game.pending.length) return null;
  const issues = roundIssues(game);
  if (issues.length)
    return (
      <div className="photo-actions" aria-label="이 사진의 다음 행동">
        <button
          onClick={() =>
            dispatch({
              type: "navigate",
              screen: "chat",
              room: issues[0].friend,
            })
          }
        >
          친구의 부탁 확인하기
        </button>
        {canFinishPhoto(game) && (
          <button onClick={() => dispatch({ type: "finishPhoto" })}>
            이 사진 마무리
          </button>
        )}
      </div>
    );
  if (roundPosts(game).length)
    return (
      <div className="photo-actions" aria-label="이 사진의 다음 행동">
        <button
          className="primary"
          disabled={!canFinishPhoto(game)}
          onClick={() => dispatch({ type: "finishPhoto" })}
        >
          이 사진 마무리
        </button>
        <button onClick={() => dispatch({ type: "navigate", screen: "sns" })}>
          SNS에서 사진 확인하기
        </button>
      </div>
    );
  if (
    !game.chatRequests.group.includes(round.asset) &&
    !Object.values(game.chatRequests).some((ids) => ids.includes(round.asset))
  )
    return null;
  const image = imageInfo(game, round.asset);
  const needsEdit = photoById(round.photo).faces.some(
    (face) =>
      face.friend !== game.hero &&
      game.consents.some(
        (c) =>
          c.friend === face.friend &&
          c.photo === round.photo &&
          c.valid !== false &&
          c.condition !== "yes",
      ) &&
      !protectsFriend(round.photo, face.friend, image.edits),
  );
  return (
    <div className="photo-actions" aria-label="이 사진의 다음 행동">
      {needsEdit && (
        <button onClick={() => editCurrentPhoto(game, round.asset, dispatch)}>
          이 사진 편집하기
        </button>
      )}
      <button className="primary" onClick={() => onShare(round.asset)}>
        이 사진 SNS에 올리기
      </button>
      {!needsEdit && (
        <button onClick={() => dispatch({ type: "nextPhoto" })}>
          다른 사진 선택
        </button>
      )}
      {!roundHasLivePost(game) && (
        <button onClick={() => dispatch({ type: "finishPhoto", keep: true })}>
          이 사진 간직하기
        </button>
      )}
    </div>
  );
}
