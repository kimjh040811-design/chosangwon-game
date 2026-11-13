import type { Game, Screen, Character, StoryPhase } from "./model";
import { imageInfo, nameOf, sharedPhotos, isRetiredPhoto } from "./data";
import { nextEpisode } from "./episodes";
import { createReview } from "./review";

export function storyPhase(game: Game): StoryPhase {
  if (game.stage === "intro") return "intro";
  if (game.stage === "ending") return "ending";
  if (game.stage === "special") return "special_event";
  if (!game.story.firstContact) return "first_contact";
  if (
    !game.story.opinionsSeen ||
    game.pending.some((p) => p.purpose === "consent")
  )
    return "consent_discussion";
  if (game.issues.some((i) => !i.resolved))
    return game.issues.some((i) => i.read) ? "resolution" : "consequence";
  if (game.pending.length) return "consequence";
  if (
    game.story.decision === "undecided" ||
    (game.story.decision === "share" && !game.posts.length)
  )
    return "decision";
  return game.story.resultSeen ? "resolution" : "decision";
}

export function migrateGame(saved: Game): Game {
  const game = structuredClone(saved);
  const legacy = game.revision !== 8;
  game.revision = 8;
  game.review ??= createReview();
  // Existing progress keeps its previously selected audience.
  game.review.audienceChosen ??= true;
  game.review.policyVersion = 1;
  game.episode ??= "EP01";
  game.episodes ??= {};
  game.photoFlow ??= { current: null, rounds: [], result: false };
  if (game.episode === "EP01" && game.stage === "ending")
    game.stage = "stageComplete";
  game.editorDraft ??= null;
  if (game.editorDraft && isRetiredPhoto(game.editorDraft.photo))
    game.editorDraft.open = false;
  const firstContact =
    game.consents.length > 0 ||
    game.posts.length > 0 ||
    Object.values(game.messages).some((messages) =>
      messages.some((m) => m.from === "me"),
    );
  const defaults = {
    viewed: [
      ...new Set([
        ...game.versions.map((v) => v.photo),
        ...game.posts.flatMap((p) =>
          p.photos.map((id) => imageInfo(game, id).photo),
        ),
      ]),
    ],
    decision: game.skipped
      ? ("keep" as const)
      : game.posts.length
        ? ("share" as const)
        : ("undecided" as const),
    resultSeen: game.posts.length > 0 || game.skipped,
    phase: "first_contact" as StoryPhase,
    introLine: 4,
    firstContact,
    topicStarted: firstContact,
    photoPromptSeen: firstContact,
    opinionsSeen: firstContact && game.consents.length > 0,
    photoChoices: {},
  };
  game.story = { ...defaults, ...game.story };
  game.chatRequests ??= {
    group: [],
    chiikawa: [],
    hachiware: [],
    usagi: [],
    maru: [],
  };
  game.chatTarget ??= null;
  if (
    game.chatTarget &&
    isRetiredPhoto(imageInfo(game, game.chatTarget.photo).photo)
  )
    game.chatTarget = null;
  game.specialResult ??= null;
  game.withdrawalPlan ??= {
    enabled: false,
    friend: game.hero === "hachiware" ? "chiikawa" : "hachiware",
  };
  game.events ??= game.history.map((text, index) => ({
    id: `legacy-${index}`,
    type: "legacy",
    text,
    photos: [],
  }));
  for (const post of game.posts) post.originalPhotos ??= [...post.photos];
  for (const issue of game.issues) {
    issue.notified ??= game.messages[issue.friend].some(
      (m) => m.from === issue.friend,
    );
    issue.read ??= Boolean(
      issue.notified &&
      game.messages[issue.friend].some(
        (m) => m.from === issue.friend && m.read,
      ),
    );
    issue.followedUp ??= issue.resolved;
  }
  if (legacy) {
    for (const pending of game.pending) {
      if (pending.issueId || pending.purpose) continue;
      const issue = game.issues.find(
        (i) =>
          i.friend === pending.from &&
          !i.resolved &&
          /내려|올라가|신경/.test(pending.text),
      );
      if (issue) {
        pending.issueId = issue.id;
        pending.purpose = "request";
        issue.notified = false;
      }
    }
  }
  for (const room of ["group", "chiikawa", "hachiware", "usagi", "maru"] as const) {
    let previousPhoto: string | undefined;
    let previousIssue: string | undefined;
    for (const message of game.messages[room]) {
      if (message.issueId) {
        previousIssue = message.issueId;
        previousPhoto = game.issues.find((i) => i.id === message.issueId)?.photo;
      }
      if (message.photoId) {
        if (message.photoId !== previousPhoto && !message.issueId) previousIssue = undefined;
        previousPhoto = message.photoId;
      }
      if (message.photos?.length === 1) previousPhoto = message.photos[0];
      if (!message.photoId && !message.photos?.length && (message.purpose === "reply" || message.from === "me")) {
        if (previousPhoto) message.photoId = previousPhoto;
        if (room !== "group" && previousIssue) message.issueId ??= previousIssue;
      }
    }
  }
  for (const pending of game.pending) {
    if (pending.purpose !== "reply" || pending.photoId || pending.room === "group") continue;
    const issue = game.issues.find((i) => i.id === game.review.activeIssue && i.friend === pending.room)
      ?? game.issues.find((i) => i.friend === pending.room && !i.resolved && i.notified);
    if (issue) {
      pending.photoId = issue.photo;
      pending.issueId = issue.id;
    }
  }
  game.story.phase = storyPhase(game);
  return game;
}

export interface StoryGuide {
  title: string;
  text: string;
  label: string;
  screen?: Screen;
  room?: Character | "group";
  ready?: boolean;
}
export function storyGuide(input: Game): StoryGuide {
  const game = input.story?.phase ? input : migrateGame(input);
  if (game.story.topicStarted && !game.story.firstContact) {
    const pending = game.pending[0];
    if (pending)
      return {
        title: `${nameOf(pending.from)}이 답하고 있어요`,
        text: "어떤 사진인지 궁금한가 봐요. 답장을 읽어 볼까요?",
        label: "친구 답장 보기",
        screen: "chat",
        room: pending.room,
      };
    return {
      title: sharedPhotos(game, "group").length
        ? "사진을 보냈어요"
        : "어떤 사진일까?",
      text: sharedPhotos(game, "group").length
        ? "보낸 사진을 SNS에 올려도 되는지 물어보세요."
        : "채팅 입력창의 +를 눌러 사진을 골라 보내 보세요.",
      label: "채팅 이어가기",
      screen: "chat",
      room: "group",
    };
  }
  if (!game.story.firstContact)
    return {
      title: "이 사진들, SNS에 올리고 싶어",
      text: "단체방에서 오늘 사진을 보여 주고 친구들의 생각을 물어볼까요?",
      label: "친구들에게 먼저 물어보기",
      screen: "chat",
      room: "group",
    };
  const pending = game.pending[0];
  if (pending)
    return {
      title: `${nameOf(pending.from)}의 답장이 와요`,
      text: "친구가 어떤 사진을 좋아하는지 들어 볼까요? 점 세 개를 누르면 바로 읽을 수 있어요.",
      label: "친구 답장 읽기",
      screen: "chat",
      room: pending.room,
    };
  if (!game.story.opinionsSeen)
    return {
      title: "친구들은 어떻게 생각할까?",
      text: "질문에 온 답장을 읽어 보세요. 사진마다 마음이 다를 수 있어요.",
      label: "답장 확인하기",
      screen: "chat",
      room: "group",
    };
  if (!game.story.viewed.length)
    return {
      title: "사진을 함께 골라 볼까?",
      text: "친구가 이야기한 사진을 크게 열어 보세요. 얼굴을 가리거나 다른 사진을 고를 수도 있어요.",
      label: "사진첩 열기",
      screen: "album",
    };
  const unread = game.issues.find((i) => !i.resolved && !i.read);
  if (unread)
    return {
      title: `${nameOf(unread.friend)}이 말을 걸었어요`,
      text: "올린 사진에 대해 이야기하고 싶대요. 무슨 마음인지 들어 볼까요?",
      label: "친구 메시지 읽기",
      screen: "chat",
      room: unread.friend,
    };
  const issue = game.issues.find((i) => !i.resolved && i.decision !== "keep");
  if (issue)
    return issue.decision === "remove"
      ? {
          title: "사진을 내리기로 했어요",
          text: `${nameOf(issue.friend)}에게 한 말을 SNS에서도 이어 가 볼까요? 해당 사진만 내려도 돼요.`,
          label: "SNS에서 사진 확인하기",
          screen: "sns",
        }
      : {
          title: "친구가 답을 기다려요",
          text: "왜 불편했는지 더 묻거나, 사진을 어떻게 할지 답할 수 있어요.",
          label: "친구에게 답장하기",
          screen: "chat",
          room: issue.friend,
        };
  if (
    game.story.decision === "undecided" ||
    (game.story.decision === "share" && !game.posts.length)
  )
    return {
      title: "어떤 추억으로 남길까?",
      text: "편집본을 다시 보여 주거나 다른 사진을 골라 보세요. 오늘은 게시하지 않기로 정해도 좋아요.",
      label: "공유할 사진 살펴보기",
      screen: "album",
    };
  if (!game.story.resultSeen)
    return {
      title: "우리의 선택, 그다음 이야기",
      text: "친구들의 답장이나 게시물의 반응을 확인해 볼까요?",
      label: "이야기 확인하기",
      screen: "chat",
      room: "group",
    };
  return {
    title: "함께한 하루를 돌아보며",
    text:
      game.episode === "EP01"
        ? "사진과 친구들의 마음을 살펴봤어요. 집에 가는 길에 이야기를 조금 더 나눠요."
        : "사진과 답장을 기록했어요. 준비되면 이 스테이지를 마무리해요.",
    label:
      game.episode === "EP01"
        ? "마지막 이야기로"
        : nextEpisode(game.episode)
          ? "이 스테이지 마무리하기"
          : "네 스테이지 마무리하기",
    ready: true,
  };
}
