import type { Game } from "./model";
import { imageInfo, photoById } from "./data";
import { conversationIssue } from "./dialogue";

export function conversationPhotoId(game: Game) {
  if (game.screen === "chat" && game.room && game.room !== "group") {
    const issue =
      conversationIssue(game, game.room) ??
      game.issues.find(
        (i) => i.friend === game.room && i.resolved && !i.conversationClosed,
      );
    if (issue) return issue.photo;
  }
  return currentPhotoRound(game)?.asset ?? null;
}

export function currentPhotoRound(game: Game) {
  const index = game.photoFlow.current;
  return index === null ? null : (game.photoFlow.rounds[index] ?? null);
}

export function roundPosts(game: Game) {
  const round = currentPhotoRound(game);
  return round
    ? game.posts.filter((post) =>
        (post.originalPhotos ?? post.photos).some(
          (id) => imageInfo(game, id).photo === round.photo,
        ),
      )
    : [];
}

export function roundIssues(game: Game) {
  const round = currentPhotoRound(game);
  return round
    ? game.issues.filter(
        (issue) =>
          !issue.resolved && imageInfo(game, issue.photo).photo === round.photo,
      )
    : [];
}

export function roundHasLivePost(game: Game) {
  const round = currentPhotoRound(game);
  return Boolean(
    round &&
    roundPosts(game).some(
      (post) =>
        !post.deleted &&
        post.photos.some((id) => imageInfo(game, id).photo === round.photo),
    ),
  );
}

export function canFinishPhoto(game: Game) {
  const round = currentPhotoRound(game);
  if (!round || round.outcome !== "active") return false;
  if (game.pending.some((p) => p.purpose !== "reaction")) return false;
  return (
    roundPosts(game).length > 0 &&
    roundIssues(game).every((issue) => issue.read && issue.decision === "keep")
  );
}

export function photoRoundSummary(game: Game) {
  const round = currentPhotoRound(game);
  if (!round) return "";
  const title = photoById(round.photo).title;
  if (roundIssues(game).length)
    return `「${title}」에 대한 친구의 부탁이 남아 있어요.`;
  if (roundPosts(game).length)
    return roundHasLivePost(game)
      ? `「${title}」을 SNS에 남겼어요.`
      : `「${title}」을 SNS에서 내렸어요.`;
  switch (round.outcome) {
    case "posted":
      return `「${title}」을 SNS에 남겼어요.`;
    case "removed":
      return `「${title}」을 SNS에서 내렸어요.`;
    case "kept":
      return `「${title}」은 게시하지 않고 간직하기로 했어요.`;
    case "changed":
      return `「${title}」을 살펴보고 다른 사진을 골라 보기로 했어요.`;
    default:
      return `「${title}」에 대해 함께 이야기했어요.`;
  }
}
