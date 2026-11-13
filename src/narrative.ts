import type { Game, EpisodeId, EpisodeSnapshot, Character } from "./model";
import { episodes, episodeById } from "./episodes";
import { photoById, isRetiredPhoto } from "./data";

export function stageMemory(
  game: Game,
): { friend: Character; text: string } | null {
  const previous =
    episodes[episodes.findIndex((e) => e.id === game.episode) - 1];
  const state = previous && game.episodes[previous.id]?.state;
  if (!state) return null;
  const removed = state.issues.find((issue) => {
    const post = state.posts.find((p) => p.id === issue.post);
    return (
      issue.friend !== game.hero &&
      issue.notified &&
      issue.read &&
      state.messages[issue.friend].some(
        (message) =>
          message.issueId === issue.id &&
          message.purpose === "request" &&
          message.read,
      ) &&
      issue.resolved &&
      post &&
      (post.deleted || !post.photos.includes(issue.photo))
    );
  });
  if (removed) {
    const lines: Record<Character, string> = {
      chiikawa: "지난번에 내 말 듣고 사진 내려 줬잖아… 고마웠어.",
      hachiware:
        "지난번 내 부탁 듣고 사진 내려 줘서 고마웠어. 이번 사진도 같이 보고 싶어!",
      usagi: "지난번에 내 사진 내려 줬지! 내 말 들어 줬어!",
      maru: "지난번에 내 부탁을 듣고 사진 내려 줘서 고마웠어. 마음이 편해졌어.",
    };
    return { friend: removed.friend, text: lines[removed.friend] };
  }
  if (
    state.skipped &&
    state.story.decision === "keep" &&
    !state.posts.some((p) => !p.deleted)
  ) {
    const friend = game.hero === "hachiware" ? "chiikawa" : "hachiware";
    return {
      friend,
      text:
        friend === "chiikawa"
          ? "지난번 사진은 우리끼리 간직하기로 했지… 이번 사진도 같이 보고 싶어."
          : "지난번 사진은 우리끼리 간직하기로 했잖아. 이번에도 마음에 드는 걸 같이 골라 보자!",
    };
  }
  return null;
}

export function episodeSummary(
  episode: EpisodeId,
  state: EpisodeSnapshot,
): string {
  const title = episodeById(episode).title;
  const live = state.posts.filter((p) => !p.deleted && p.photos.length);
  const removed = state.posts.some(
    (p) =>
      p.deleted ||
      (p.originalPhotos ?? p.photos).some((id) => !p.photos.includes(id)),
  );
  let text: string;
  if (live.length) {
    const edited = live.some((p) =>
      p.photos.some((id) =>
        state.versions.some((v) => v.id === id && v.edits.length > 0),
      ),
    );
    text = `${title}에서 ${edited ? "편집한 사진을 포함해 사진을" : "사진을"} 게시했어요.`;
  } else if (removed) text = `${title}에서 게시했던 사진을 모두 내렸어요.`;
  else if (state.skipped && state.story.decision === "keep")
    text = `${title} 사진은 게시하지 않고 간직하기로 했어요.`;
  else text = `${title}에서 사진에 대해 나눈 이야기가 남아 있어요.`;
  const unresolved = state.issues.find((i) => !i.resolved);
  if (unresolved) {
    const photo =
      state.versions.find((v) => v.id === unresolved.photo)?.photo ??
      unresolved.photo;
    text += ` ${isRetiredPhoto(photo) ? "이전 사진" : photoById(photo).title}에 대한 친구의 부탁이 남아 있어요.`;
  }
  return text;
}
export function journeySummary(game: Game) {
  return episodes.flatMap((episode) => {
    const state =
      episode.id === game.episode ? game : game.episodes[episode.id]?.state;
    return state
      ? [{ episode: episode.id, text: episodeSummary(episode.id, state) }]
      : [];
  });
}
