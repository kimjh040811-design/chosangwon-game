import type { Action } from "./engine";
import type { Audience, Character, Consent, Edit, EpisodeReview, Game, PhotoReview } from "./model";
import { characters, episodePhotos, imageInfo, nameOf, photoById } from "./data";
import { groupFollowup, issueExplanation, reactionLine } from "./dialogue";
import { photoImpression } from "./photo-dialogue";
import { protection, protectsFriend } from "./protection";
import { stageMemory } from "./narrative";
import { activityOpinion, photoActivities } from "./photo-activities";

export function createReview(): EpisodeReview {
  return {
    enabled: false, policyVersion: 1, phase: "select", current: null, photos: {},
    audience: "close", audienceChosen: false, caption: "함께 고른 오늘의 추억", publication: {}, notice: "",
  };
}

export function enableReview(game: Game): Game {
  if (game.review.enabled) return game;
  game.review.enabled = true;
  if (game.hero !== "maru") {
    game.review.originalHero = game.hero;
    for (const post of game.posts) post.author ??= game.hero;
    for (const messages of Object.values(game.messages))
      for (const message of messages) if (message.from === "me") message.actor ??= game.hero;
  }
  game.hero = "maru";
  game.withdrawalPlan.enabled = false;
  for (const round of game.photoFlow.rounds) {
    const record = photoReview(game, round.photo);
    record.asset = round.asset;
    if (round.outcome === "kept") record.decision = "keep";
  }
  for (const photo of episodePhotos(game)) {
    const record = photoReview(game, photo.id);
    record.sent = game.messages.group.flatMap((m) => m.photos ?? [])
      .filter((id) => imageInfo(game, id).photo === photo.id);
    record.asked = [...new Set(game.messages.group
      .filter((m) => m.purpose === "consent" && m.photoId && imageInfo(game, m.photoId).photo === photo.id)
      .map((m) => m.photoId!))];
  }
  if (game.posts.length) {
    game.review.phase = "published";
    for (const post of game.posts) for (const id of post.originalPhotos ?? post.photos) {
      const record = photoReview(game, imageInfo(game, id).photo);
      record.asset = id;
      record.decision = "include";
    }
  } else if (game.photoFlow.current !== null) {
    const round = game.photoFlow.rounds[game.photoFlow.current];
    if (round && episodePhotos(game).some((p) => p.id === round.photo)) {
      game.review.current = round.photo;
      game.review.phase = "photo";
    }
  }
  for (const photo of episodePhotos(game))
    if (game.story.photoChoices[photo.id] === "keep" && !game.review.photos[photo.id].decision)
      game.review.photos[photo.id].decision = "keep";
  if (game.stage === "special") game.stage = "play";
  if (!game.posts.length && game.editorDraft?.open && episodePhotos(game).some((p) => p.id === game.editorDraft!.photo)) {
    game.review.current = game.editorDraft.photo;
    game.review.phase = "photo";
  }
  return game;
}

export function photoReview(game: Game, photo: string): PhotoReview {
  return game.review.photos[photo] ??= { asset: photo, sent: [], asked: [], why: [], decision: null };
}

export function currentReview(game: Game) {
  return game.review.current ? game.review.photos[game.review.current] : undefined;
}

export function reviewedCount(game: Game) {
  return episodePhotos(game).filter((p) => game.review.photos[p.id]?.decision).length;
}

export function reviewSelection(game: Game) {
  return episodePhotos(game).flatMap((p) => {
    const record = game.review.photos[p.id];
    return record?.decision === "include" ? [record.asset] : [];
  });
}

export function opinionParticipants(game: Game, id: string): Character[] {
  // A gift recipient can express a sharing preference without appearing in the image.
  // Face masking continues to use only photoById(...).faces in protection.ts.
  const image = imageInfo(game, id);
  return characters.filter((c) => c.id !== game.hero && (photoById(image.photo).faces.some((f) => f.friend === c.id) || photoActivities[image.photo]?.subject === c.id)).map((c) => c.id);
}

export function reviewOpinion(game: Game, friend: Character, id: string, audience: Audience) {
  const image = imageInfo(game, id);
  if (game.issues.some((i) => i.withdrawal && !i.resolved && i.friend === friend && imageInfo(game, i.photo).photo === image.photo))
    return { condition: "no" as const, text: reactionLine(game, friend, id, "withdrawal", audience) };
  if (image.photo === "group") {
    if (friend === "chiikawa") return { condition: "cover" as const, text: "내 얼굴만 가려 주면 괜찮아…" };
    return { condition: "yes" as const, text: friend === "hachiware" ? "난 좋아! 다 같이 잘 나왔어!" : "야하! 난 좋아!" };
  }
  return activityOpinion(image.photo, friend, audience);
}

export function needsScopeConfirmation(game: Game, id: string) {
  const image = imageInfo(game, id);
  return opinionParticipants(game, id).some((friend) => !game.consents.some((c) =>
    c.friend === friend && c.photo === image.photo && c.asset === id && c.audience === game.review.audience &&
    c.valid !== false && c.condition === reviewOpinion(game, friend, id, game.review.audience).condition));
}

export function changeReviewAudience(game: Game, audience: Audience) {
  const previous = game.review.audience;
  game.review.audienceChosen = true;
  game.review.audience = audience;
  if (previous === audience) return;
  const changed = episodePhotos(game).filter((p) => opinionParticipants(game, p.id).some((friend) =>
    reviewOpinion(game, friend, p.id, previous).condition !== reviewOpinion(game, friend, p.id, audience).condition));
  game.review.changedScopePhotos = changed.map((p) => p.id);
  for (const photo of changed) {
    const record = game.review.photos[photo.id];
    if (record) record.why = [];
  }
  const included = changed.filter((p) => game.review.photos[p.id]?.decision === "include");
  game.review.notice = included.length ? `공개 범위가 바뀌었어요. ${included.map((p) => p.title).join(" · ")}의 조건을 다시 확인해 주세요.` : "공개 범위를 바꿨어요.";
}

export function currentRequests(game: Game, id: string) {
  return opinionParticipants(game, id).map((friend) => ({
    friend, ...reviewOpinion(game, friend, id, game.review.audience),
    hidden: protectsFriend(imageInfo(game, id).photo, friend, imageInfo(game, id).edits),
    confirmed: game.consents.some((c) => c.friend === friend && c.photo === imageInfo(game, id).photo && c.asset === id && c.audience === game.review.audience && c.valid !== false && c.condition === reviewOpinion(game, friend, id, game.review.audience).condition),
  }));
}

export function missingCoverText(game: Game, friend: Character, id: string) {
  const image = imageInfo(game, id);
  const appearances = photoById(image.photo).faces.filter((f) => f.friend === friend);
  if (appearances.length > 1) {
    const first = appearances.findIndex((face) => !protection(face, image.edits).safe);
    const positions = ["맨 위 사진", "위에서 두 번째 사진", "위에서 세 번째 사진", "맨 아래 사진"];
    return `고마워… 그런데 ${positions[Math.max(0, first)] ?? "다른 컷"}에도 내 얼굴이 보여. 그쪽도 가려 줄래?`;
  }
  return "고마워… 그런데 내 얼굴이 아직 보여.";
}

function say(game: Game, from: Character | "me", text: string, photoId: string, purpose: "reply" | "decision" = "reply", issueId?: string) {
  game.messages.group.push({ id: crypto.randomUUID(), from, text, photoId, purpose, issueId, read: true });
}

function queueReply(game: Game, from: Character, text: string, photoId: string, consents?: Consent[]) {
  game.pending.push({ room: "group", from, text, photoId, purpose: consents ? "consent" : "reply", consents });
}

function sendReviewPhoto(game: Game, id: string, edited: boolean) {
  const image = imageInfo(game, id);
  const record = photoReview(game, image.photo);
  record.asset = id;
  record.sent = [...new Set([...record.sent, id])];
  if (!game.messages.group.length) {
    const memory = stageMemory(game);
    if (memory) game.messages.group.push({ id: crypto.randomUUID(), from: memory.friend, text: memory.text, purpose: "memory", read: true });
  }
  game.messages.group.push({ id: crypto.randomUUID(), from: "me", text: "사진을 보냈어요.", photos: [id], photoId: id, read: true });
  game.events.push({ id: crypto.randomUUID(), type: "contact", text: "친구들에게 사진을 보냈어요.", photos: [id] });
  game.screen = "chat";
  game.room = "group";
  game.story.firstContact = true;
  game.story.topicStarted = true;
  game.story.photoPromptSeen = true;
  if (!game.story.viewed.includes(image.photo)) game.story.viewed.push(image.photo);
  if (edited) askReviewPhoto(game, id, true);
  else if (photoActivities[image.photo]?.type === "memory" || photoActivities[image.photo]?.type === "audience" && game.review.audience === "close") {
    askReviewPhoto(game, id);
  }
  else {
    const friends = opinionParticipants(game, id);
    if (image.photo === "EP03-P03") queueReply(game, "hachiware", "케이크랑 선물을 같이 찍었네! 준비하던 생각이 나서 이 사진도 나누고 싶어.", id);
    for (const friend of friends.length ? friends : ["hachiware" as const])
      queueReply(game, friend, photoImpression(image.photo, friend), id);
    if (image.photo === "EP04-P01")
      queueReply(game, "hachiware", "사진을 올린 뒤에도 마음이 바뀔 수 있잖아. 그때는 내려 달라고 이야기하자.", id);
    if (!friends.length) record.asked = [...new Set([...record.asked, id])];
  }
}

function askReviewPhoto(game: Game, id: string, edited = false) {
  const image = imageInfo(game, id);
  const record = photoReview(game, image.photo);
  const question = game.review.audience === "close"
    ? "친한 친구들만 볼 수 있게 이 사진을 올려도 괜찮아?"
    : "누구나 볼 수 있게 이 사진을 전체 공개로 올려도 괜찮아?";
  say(game, "me", `${edited ? "이렇게 바꿨어. " : ""}${question}`, id);
  record.asked = [...new Set([...record.asked, id])];
  const friends = opinionParticipants(game, id);
  const chiikawaSafe = protectsFriend(image.photo, "chiikawa", image.edits);
  if (!friends.length) queueReply(game, "hachiware", edited ? `${photoImpression(image.photo, "hachiware")} 이 사진도 잘 받았어!` : photoActivities[image.photo]?.memory ?? photoImpression(image.photo, "hachiware"), id);
  for (const friend of friends) {
    const answer = reviewOpinion(game, friend, id, game.review.audience);
    const alreadyReacted = game.messages.group.some((message) => message.from === friend && message.photoId === id);
    let text = image.photo === "group" || edited || photoActivities[image.photo]?.memory || alreadyReacted
      ? answer.text : `${photoImpression(image.photo, friend)} ${answer.text}`;
    if (edited && image.edits.length) {
      if (answer.condition === "cover") text = protectsFriend(image.photo, friend, image.edits)
        ? friend === "chiikawa" ? "응! 이제 괜찮아. 고마워!" : friend === "usagi" ? "야하! 얼굴 가렸다! 이제 좋아!" : "얼굴 가려 줬네. 고마워!"
        : missingCoverText(game, friend, id);
      if (image.photo === "group" && friend === "hachiware") text = chiikawaSafe ? "좋다! 이제 다 같이 볼 수 있겠다!" : "아! 조금 더 가려야겠다!";
      if (image.photo === "group" && friend === "usagi") text = "야하!";
    }
    const scopes: Audience[] = photoActivities[image.photo]?.scopeFriend === friend ? [game.review.audience] : ["close", "public"];
    const consents = scopes.map((audience) => ({
      friend, photo: image.photo, asset: id, audience,
      condition: reviewOpinion(game, friend, id, audience).condition,
      valid: true, reasked: edited,
    }));
    queueReply(game, friend, text, id, consents);
  }
  game.chatRequests.group = [id];
  game.story.opinionsSeen = !friends.length;
}

export type ReviewAction =
  | { type: "reviewStart" }
  | { type: "reviewCaption"; caption: string }
  | { type: "reviewAudience"; audience: Audience }
  | { type: "reviewSelect"; photo: string }
  | { type: "reviewSend" }
  | { type: "reviewAsk" }
  | { type: "reviewWhy"; friend: Character }
  | { type: "reviewPromise"; friend: Character }
  | { type: "reviewEdit" }
  | { type: "reviewEditPosted"; photo: string }
  | { type: "reviewSave"; edits: Edit[] }
  | { type: "reviewCloseEditor" }
  | { type: "reviewDecide"; decision: "include" | "keep" }
  | { type: "reviewContinue" }
  | { type: "reviewReopen" }
  | { type: "reviewPreview" }
  | { type: "reviewPublish"; audience: Audience; caption: string }
  | { type: "reviewReplies" }
  | { type: "reviewOpenIssue"; id: string }
  | { type: "reviewFinish" }
  | { type: "reviewNext" };

type Reducer = (game: Game, action: Action) => Game;

export function reduceReview(game: Game, action: ReviewAction, reduce: Reducer): Game {
  if (action.type === "reviewCaption") {
    if (game.review.phase === "preview") game.review.caption = action.caption;
    return game;
  }
  game.review.notice = "";
  if (action.type === "reviewStart") return enableReview(game);
  if (action.type === "reviewReplies") {
    while (game.pending.length) game = reduce(game, { type: "deliver" });
    if (game.review.phase === "published" && !game.review.activeIssue) {
      const unread = game.issues.find((i) => !i.resolved && !i.read && i.notified);
      if (unread) {
        game.review.activeIssue = unread.id;
        return reduce(game, { type: "navigate", screen: "chat", room: unread.friend });
      }
    }
    return game;
  }
  if (action.type === "reviewOpenIssue") {
    const issue = game.issues.find((i) => i.id === action.id);
    if (issue) {
      game.review.activeIssue = issue.id;
      return reduce(game, { type: "navigate", screen: "chat", room: issue.friend });
    }
    return game;
  }
  if (game.pending.length) {
    game.review.notice = "친구의 답장을 먼저 읽어 주세요.";
    return game;
  }
  const record = currentReview(game);
  switch (action.type) {
    case "reviewAudience":
      if (game.review.phase !== "published") changeReviewAudience(game, action.audience);
      break;
    case "reviewSelect": {
      if (game.review.phase === "published" || !episodePhotos(game).some((p) => p.id === action.photo)) break;
      game.review.current = action.photo;
      if (game.editorDraft && game.editorDraft.photo !== action.photo) game.editorDraft.open = false;
      game.review.phase = "photo";
      photoReview(game, action.photo);
      game.screen = "chat";
      game.room = "group";
      break;
    }
    case "reviewSend":
      if (record) sendReviewPhoto(game, record.asset, record.asset !== game.review.current);
      break;
    case "reviewAsk":
      if (record?.sent.includes(record.asset) && (!record.asked.includes(record.asset) || needsScopeConfirmation(game, record.asset))) askReviewPhoto(game, record.asset);
      break;
    case "reviewWhy": {
      if (!record || !record.asked.length || record.why.includes(action.friend)) break;
      record.why.push(action.friend);
      const image = imageInfo(game, record.asset);
      const condition = reviewOpinion(game, action.friend, record.asset, game.review.audience).condition;
      const question = condition === "yes" ? "이 사진은 어떤 점이 마음에 들어?"
        : condition === "no" ? "이 사진은 왜 올리고 싶지 않아?" : "어떤 점이 마음에 걸려?";
      say(game, "me", `${nameOf(action.friend)}, ${question}`, record.asset);
      const text = condition === "yes"
        ? `${photoImpression(image.photo, action.friend)} 이 사진은 같이 나누고 싶어!`
        : action.friend === "chiikawa"
        ? "내 얼굴이 잘 보여서 조금 부끄러워… 얼굴이 안 보이면 마음이 편해."
        : action.friend === "usagi"
          ? condition === "no"
            ? image.photo === "funny" ? "그 표정은 내가 올리고 싶은 모습이 아니야!" : "이 사진은 같이 만났을 때 우리끼리 보고 싶어!"
            : "이 사진 마음에 들어! 같이 나누고 싶어!"
          : issueExplanation(game, action.friend, record.asset, game.review.audience);
      queueReply(game, action.friend, image.photo === "group" ? text : activityOpinion(image.photo, action.friend, game.review.audience).reason, record.asset);
      break;
    }
    case "reviewPromise":
      if (record) {
        say(game, "me", "응, 얼굴을 가려 줄게.", record.asset);
        queueReply(game, action.friend, groupFollowup("cover", action.friend), record.asset);
      }
      break;
    case "reviewEdit":
      if (record) return reduce(game, { type: "editPhoto", photo: game.editorDraft?.photo === game.review.current ? game.editorDraft.source : record.asset });
      break;
    case "reviewEditPosted": {
      if (game.review.phase !== "published" || !game.posts.some((p) => !p.deleted && p.photos.includes(action.photo))) break;
      const photo = imageInfo(game, action.photo).photo;
      game.review.current = photo;
      return reduce(game, { type: "editPhoto", photo: photoReview(game, photo).asset });
    }
    case "reviewSave":
      if (record && game.editorDraft) {
        const published = game.review.phase === "published";
        game = reduce(game, { type: "saveVersion", photo: game.editorDraft.photo, edits: action.edits });
        const version = game.versions.at(-1)!;
        game.review.photos[version.photo].asset = version.id;
        if (!published) game.review.photos[version.photo].decision = null;
        game.screen = "chat";
        game.room = "group";
      }
      break;
    case "reviewCloseEditor":
      if (game.editorDraft) game.editorDraft.open = false;
      game.screen = "chat";
      game.room = "group";
      break;
    case "reviewDecide": {
      if (!record || !record.asked.length || record.decision === action.decision) break;
      const friends = currentRequests(game, record.asset);
      const requester = friends.find((f) => f.condition === "no") ?? friends.find((f) => f.condition === "cover");
      record.decision = action.decision;
      const decisionText = action.decision === "keep" ? "사진을 게시하지 않고 보관하기로 했어요." : "사진을 SNS 게시 목록에 담았어요.";
      game.history.push(`${photoById(game.review.current!).title} — ${decisionText}`);
      game.events.push({ id: crypto.randomUUID(), type: "decision", text: decisionText, photos: [record.asset] });
      game.story.photoChoices[game.review.current!] = action.decision === "keep" ? "keep" : "share";
      say(game, "me", action.decision === "keep" ? "이 사진은 올리지 않고 간직할게." : "이 사진은 올릴 사진으로 골라 둘게.", record.asset, "decision");
      if (action.decision === "keep") {
        const friend = requester?.friend ?? "hachiware";
        queueReply(game, friend, groupFollowup("keepPhoto", friend), record.asset);
      }
      break;
    }
    case "reviewContinue":
      if (!record?.decision) break;
      game.review.current = null;
      game.review.phase = reviewedCount(game) === episodePhotos(game).length ? "preview" : "select";
      break;
    case "reviewReopen":
      if (record && game.review.phase !== "published") record.decision = null;
      break;
    case "reviewPreview":
      if (game.review.phase === "published") break;
      game.review.phase = reviewedCount(game) === episodePhotos(game).length ? "preview" : "select";
      break;
    case "reviewPublish": {
      if (game.review.phase !== "preview" || reviewedCount(game) !== episodePhotos(game).length || game.posts.length) break;
      const ids = reviewSelection(game);
      if (!ids.length) break;
      changeReviewAudience(game, action.audience);
      game.review.caption = action.caption;
      for (const id of ids) game.review.publication[imageInfo(game, id).photo] = {
        asset: id, permitted: opinionParticipants(game, id).every((friend) => permittedVersion(game, friend, id, action.audience)),
      };
      game = reduce(game, { type: "post", photos: ids, caption: action.caption, audience: action.audience });
      game.review.phase = "published";
      game.review.current = null;
      game.screen = "sns";
      game.room = null;
      if (game.episode === "EP04") addSportsRequest(game);
      break;
    }
    case "reviewFinish": {
      if (game.review.phase !== "published" && !(game.review.phase === "preview" && !reviewSelection(game).length)) break;
      const unread = game.issues.find((i) => !i.resolved && !i.read);
      if (unread) {
        game.review.notice = "남아 있는 친구의 부탁을 읽어 주세요.";
        game.review.activeIssue = unread.id;
        return reduce(game, { type: "navigate", screen: "chat", room: unread.friend });
      }
      for (const issue of game.issues.filter((i) => !i.resolved)) issue.decision = "keep";
      game.skipped = !game.posts.some((p) => !p.deleted);
      game.story.decision = game.skipped ? "keep" : "share";
      game.stage = "stageComplete";
      break;
    }
    case "reviewNext": {
      if (game.stage !== "stageComplete") break;
      if (game.episode === "EP04") {
        const states = [game, ...Object.values(game.episodes).map((p) => p!.state)];
        game.ending = states.some((s) => s.issues.some((i) => !i.resolved)) ? "unresolved" : states.some((s) => s.everProblem) ? "recovery" : "good";
        game.stage = "ending";
      } else game = enableReview(reduce(game, { type: "nextEpisode" }));
      break;
    }
  }
  return game;
}

export function permittedVersion(game: Game, friend: Character, id: string, audience: Audience) {
  const image = imageInfo(game, id);
  const consent = game.consents.find((c) => c.friend === friend && c.photo === image.photo && c.audience === audience && c.valid !== false);
  return Boolean(consent && consent.asset === id && consent.condition === reviewOpinion(game, friend, id, audience).condition && consent.condition !== "no" && (consent.condition === "yes" ||
    (consent.asset === id && protectsFriend(image.photo, friend, image.edits))));
}

function addSportsRequest(game: Game) {
  const post = game.posts[0];
  for (const id of post.photos) {
    const friend = opinionParticipants(game, id).find((f) => permittedVersion(game, f, id, post.audience));
    if (!friend) continue;
    const issueId = crypto.randomUUID();
    game.issues.push({ id: issueId, post: post.id, photo: id, friend, resolved: false, withdrawal: true, notified: false, read: false });
    game.consents.filter((c) => c.friend === friend && c.photo === imageInfo(game, id).photo && c.audience === post.audience).forEach((c) => { c.valid = false; });
    game.pending.push({ room: friend, from: friend, text: reactionLine(game, friend, id, "withdrawal", post.audience), issueId, photoId: id, purpose: "request" });
    game.everProblem = true;
    return;
  }
}

export function evaluateTrust(game: Game) {
  const checks: { label: string; passed: boolean }[] = [];
  for (const photo of episodePhotos(game)) {
    const record = game.review.photos[photo.id];
    const kept = record?.decision === "keep";
    const opinions = record?.asked.some((id) => opinionParticipants(game, id).every((friend) =>
      game.consents.some((c) => c.friend === friend && c.photo === photo.id && c.asset === id && (kept || c.audience === game.review.audience)))) ?? false;
    checks.push({ label: "친구의 의견을 확인했어요.", passed: opinions });
    const issues = game.issues.filter((i) => imageInfo(game, i.photo).photo === photo.id);
    const published = game.review.publication[photo.id];
    const safe = published?.permitted ?? (record?.decision === "include" && opinionParticipants(game, record.asset).every((friend) => permittedVersion(game, friend, record.asset, game.review.audience)));
    checks.push({ label: kept ? "사진을 게시하지 않고 간직했어요." : issues.length ? "친구의 부탁을 듣고 게시 상태를 다시 살폈어요." : "친구의 게시 조건을 지켰어요.", passed: Boolean(record?.decision && (kept || safe || (issues.length && issues.every((i) => i.resolved)))) });
    const image = record && imageInfo(game, record.asset);
    if (!kept && image?.edits.length && opinionParticipants(game, record!.asset).length && currentRequests(game, record!.asset).some((r) => r.condition === "cover")) {
      const coverRequests = currentRequests(game, record!.asset).filter((r) => r.condition === "cover");
      if (coverRequests.length)
        checks.push({ label: "부탁받은 얼굴을 가렸어요.", passed: coverRequests.every((r) => r.hidden) });
      checks.push({ label: "편집한 사진을 다시 보여 줬어요.", passed: opinionParticipants(game, record!.asset).every((friend) => game.messages.group.some((m) => m.from === friend && m.photoId === record!.asset && m.purpose === "consent")) });
    }
    if (issues.length) checks.push({ label: "요청받은 사진을 실제로 내렸어요.", passed: issues.every((i) => {
      const post = game.posts.find((p) => p.id === i.post);
      return !post || post.deleted || !post.photos.includes(i.photo);
    }) });
  }
  const passed = checks.filter((c) => c.passed);
  const activities: string[] = [];
  if (passed.some((c) => c.label === "친구의 의견을 확인했어요.")) activities.push("친구 의견 듣기");
  if (game.review.audienceChosen) activities.push("공개 범위 선택하기");
  if (game.versions.some((v) => v.edits.length)) activities.push("사진 편집하기");
  if (game.messages.group.some((m) => m.purpose === "consent" && game.versions.some((v) => v.id === m.photoId && v.edits.length))) activities.push("편집본 다시 보여 주기");
  if (Object.values(game.review.photos).some((p) => p.decision === "keep")) activities.push("보관 선택하기");
  if (game.events.some((e) => e.type === "remove-photo" || e.type === "delete-post")) activities.push("게시 사진 내리기");
  return { percent: Math.round(passed.length / Math.max(1, checks.length) * 100), checks,
    activities,
    feedback: [...new Set(passed.map((c) => c.label))].slice(-4),
    remaining: game.issues.filter((i) => !i.resolved).length };
}
