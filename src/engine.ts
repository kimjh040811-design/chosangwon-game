import {
  characters,
  nameOf,
  photoById,
  imageInfo,
  specialScene,
  sharedPhotos,
  episodePhotos,
  introLines,
} from "./data";
import {
  replyOptions,
  consentAnswer,
  reactionLine,
  conversationIssue,
  topicReply,
  groupFollowup,
  issueExplanation,
  removalPromiseReply,
  postConversationPrompt,
} from "./dialogue";
import { migrateGame, storyGuide, storyPhase } from "./story";
import { protectsFriend } from "./protection";
import type {
  Audience,
  Character,
  Edit,
  Game,
  PhotoId,
  Screen,
  ReplyKind,
  PendingMessage,
  Consent,
} from "./model";
import { nextEpisode } from "./episodes";
import { stageMemory } from "./narrative";
import { createReview, enableReview, reduceReview, permittedVersion, opinionParticipants, type ReviewAction } from "./review";
import {
  currentPhotoRound,
  roundHasLivePost,
  roundIssues,
  roundPosts,
  canFinishPhoto,
  photoRoundSummary,
} from "./photo-flow";
export const uid = () => globalThis.crypto.randomUUID();
export const SAVE_KEY = "our-memories-episode-01-v1";
export function newGame(
  hero: Character,
  maruAllows = true,
  scenario?: { withdrawal: boolean; friend?: Character },
): Game {
  const messages: Game["messages"] = {
    chiikawa: [],
    hachiware: [],
    usagi: [],
    maru: [],
    group: [],
  };
  const friends = characters.filter((c) => c.id !== hero);
  return {
    schema: 1,
    revision: 8,
    review: createReview(),
    episode: "EP01",
    episodes: {},
    photoFlow: { current: null, rounds: [], result: false },
    story: {
      viewed: [],
      decision: "undecided",
      resultSeen: false,
      phase: "intro",
      introLine: 0,
      firstContact: false,
      topicStarted: false,
      photoPromptSeen: false,
      opinionsSeen: false,
      photoChoices: {},
    },
    editorDraft: null,
    hero,
    stage: "intro",
    screen: "home",
    room: null,
    maruAllows,
    versions: [],
    consents: [],
    messages,
    chatRequests: {
      group: [],
      chiikawa: [],
      hachiware: [],
      usagi: [],
      maru: [],
    },
    posts: [],
    issues: [],
    trust: { chiikawa: 0, hachiware: 0, usagi: 0, maru: 0 },
    history: [`${nameOf(hero)}의 하루가 시작되었어요.`],
    notices: [],
    pending: [],
    everProblem: false,
    apologized: [],
    skipped: false,
    specialChoice: null,
    ending: null,
    speed: 1200,
    withdrawalDone: false,
    withdrawalPlan: {
      enabled: scenario?.withdrawal ?? false,
      friend:
        scenario?.friend ??
        friends[0].id,
    },
    chatTarget: null,
    events: [],
    specialResult: null,
  };
}
export function asset(
  game: Game,
  id: string,
): { photo: PhotoId; edits: Edit[] } {
  return imageInfo(game, id);
}
export function permission(
  game: Game,
  friend: Character,
  id: string,
  audience: Audience,
) {
  if (game.review?.enabled) return permittedVersion(game, friend, id, audience);
  const image = asset(game, id);
  const consent = game.consents.find(
    (c) =>
      c.friend === friend && c.photo === image.photo && c.audience === audience,
  );
  if (!consent || consent.valid === false || consent.condition === "no")
    return false;
  if (consent.condition === "yes") return true;
  const face = photoById(image.photo).faces.find((f) => f.friend === friend);
  return (
    (!consent.asset || consent.asset === id) &&
    (!face || protectsFriend(image.photo, friend, image.edits))
  );
}
function queue(
  game: Game,
  room: Character | "group",
  from: Character,
  text: string,
  metadata: Partial<PendingMessage> = {},
) {
  game.pending.push({ room, from, text, ...metadata });
}
function record(
  game: Game,
  text: string,
  details: Partial<Game["events"][number]> = {},
) {
  game.history.push(text);
  game.events.push({ id: uid(), type: "legacy", text, photos: [], ...details });
}

function readRoom(game: Game, room: Character | "group") {
  game.messages[room].forEach((message) => {
    message.read = true;
    if (message.purpose) game.story.resultSeen = true;
    if (message.purpose === "consent") game.story.opinionsSeen = true;
    if (
      game.episode !== "EP01" &&
      ["reaction", "request", "followup"].includes(message.purpose ?? "")
    )
      game.story.opinionsSeen = true;
    if (message.purpose === "photo_question") game.story.photoPromptSeen = true;
  });
  game.notices.filter((n) => n.room === room).forEach((n) => (n.read = true));
  game.issues
    .filter((i) => i.friend === room && i.notified)
    .forEach((i) => (i.read = true));
}

function requestSharedPhotos(
  game: Game,
  room: Character | "group",
  ids: string[],
) {
  for (const id of ids) {
    const image = asset(game, id),
      definition = photoById(image.photo);
    const candidates =
      room === "group"
        ? characters
            .filter(
              (c) =>
                c.id !== game.hero &&
                definition.faces.some((f) => f.friend === c.id),
            )
            .map((c) => c.id)
        : [room];
    const friends = candidates.length
      ? candidates
      : [
          game.hero === "hachiware"
            ? ("chiikawa" as const)
            : ("hachiware" as const),
        ];
    for (const friend of friends) {
      const face = definition.faces.find((f) => f.friend === friend);
      const policies: Consent[] = face
        ? (["close", "public"] as Audience[]).map((audience) => ({
            friend,
            photo: image.photo,
            audience,
            condition: consentAnswer(game, friend, id, audience).condition,
            asset: id,
            valid: true,
            reasked: game.consents.some(
              (c) =>
                c.friend === friend &&
                c.photo === image.photo &&
                c.audience === audience,
            ),
          }))
        : [];
      const text = consentAnswer(game, friend, id, "close").text;
      queue(game, room, friend, text, {
        purpose: "consent",
        consents: policies,
        photoId: id,
      });
    }
  }
  game.chatRequests[room] = [...ids];
  game.story.firstContact = true;
  game.story.decision = "share";
  ids.forEach(
    (id) => (game.story.photoChoices[asset(game, id).photo] = "share"),
  );
}

function maybeWithdraw(game: Game) {
  if (game.withdrawalDone || !game.withdrawalPlan.enabled) return;
  const friend = game.withdrawalPlan.friend;
  const post = game.posts.find(
    (p) =>
      !p.deleted &&
      p.audience === "public" &&
      game.messages[friend].some(
        (m) => m.postId === p.id && m.purpose === "reaction" && m.read,
      ),
  );
  if (!post) return;
  const id = post.photos.find(
    (id) =>
      photoById(asset(game, id).photo).faces.some((f) => f.friend === friend) &&
      permission(game, friend, id, post.audience),
  );
  if (!id) return;
  game.withdrawalDone = true;
  const issueId = uid();
  game.issues.push({
    id: issueId,
    post: post.id,
    photo: id,
    friend,
    resolved: false,
    withdrawal: true,
    notified: false,
  });
  game.consents
    .filter(
      (c) =>
        c.friend === friend &&
        c.photo === asset(game, id).photo &&
        c.audience === post.audience,
    )
    .forEach((c) => (c.valid = false));
  for (const pending of game.pending) {
    for (const consent of [
      ...(pending.consents ?? []),
      ...(pending.consent ? [pending.consent] : []),
    ]) {
      if (
        consent.friend === friend &&
        consent.photo === asset(game, id).photo &&
        consent.audience === post.audience
      ) {
        consent.condition = "no";
        consent.valid = false;
        pending.text =
          "아까 답하려던 사진이네. 지금은 마음이 바뀌었어. 올라간 사진은 내려 줬으면 해.";
      }
    }
  }
  queue(
    game,
    friend,
    friend,
    "전체 공개라 다른 사람에게도 보일 수 있구나… " +
      reactionLine(game, friend, id, "withdrawal", post.audience),
    { issueId, purpose: "request", photoId: id },
  );
  record(
    game,
    `${nameOf(friend)}이 공개된 사진을 다시 보고 삭제를 부탁했어요.`,
  );
}
function resolveIssues(game: Game) {
  game.pending = game.pending.filter(
    (item) =>
      item.purpose !== "reaction" ||
      game.posts.some(
        (post) =>
          post.id === item.postId &&
          !post.deleted &&
          (!item.photoId || post.photos.includes(item.photoId)),
      ),
  );
  for (const issue of game.issues) {
    const post = game.posts.find((p) => p.id === issue.post);
    const resolved =
      !post ||
      post.deleted ||
      !post.photos.includes(issue.photo) ||
      (!issue.withdrawal &&
        permission(game, issue.friend, issue.photo, post.audience));
    issue.resolved = resolved;
    if (!resolved || issue.followedUp) continue;
    issue.followedUp = true;
    game.pending = game.pending.filter(
      (p) => !(p.issueId === issue.id && p.purpose === "request"),
    );
    const removed = !post || post.deleted || !post.photos.includes(issue.photo);
    queue(
      game,
      issue.friend,
      issue.friend,
      removed
        ? reactionLine(
            game,
            issue.friend,
            issue.photo,
            game.trust[issue.friend] < -2 ? "removedCautious" : "removed",
            post?.audience,
          )
        : reactionLine(
            game,
            issue.friend,
            issue.photo,
            "settled",
            post?.audience,
          ),
      { issueId: issue.id, purpose: "followup", photoId: issue.photo },
    );
    if (!issue.withdrawal) game.trust[issue.friend]++;
    record(
      game,
      nameOf(issue.friend) + "에게 사진을 다시 살폈다는 답장이 왔어요.",
    );
  }
}
function reactToPost(game: Game, post: Game["posts"][number], fresh = false) {
  post.comments = [];
  for (const friend of characters.filter((c) => c.id !== game.hero)) {
    const present = post.photos.filter((id) => game.review.enabled ? opinionParticipants(game, id).includes(friend.id) :
      photoById(asset(game, id).photo).faces.some(
        (f) => f.friend === friend.id,
      ),
    );
    if (!present.length) continue;
    const problems = present.filter(
      (id) => !permission(game, friend.id, id, post.audience),
    );
    if (problems.length) {
      post.comments.push({
        friend: friend.id,
        text: postConversationPrompt(friend.id),
      });
      for (const id of problems) {
        const existing = game.issues.find(
          (i) => i.post === post.id && i.photo === id && i.friend === friend.id,
        );
        if (existing && !existing.resolved) continue;
        const issueId = existing?.id ?? uid();
        const issue = {
          id: issueId,
          post: post.id,
          photo: id,
          friend: friend.id,
          resolved: false,
          withdrawal: false,
          notified: false,
          read: false,
          decision: undefined,
          followedUp: false,
        };
        if (existing) Object.assign(existing, issue);
        else game.issues.push(issue);
        game.trust[friend.id] -= 2;
        const requestText = reactionLine(
          game,
          friend.id,
          id,
          "request",
          post.audience,
        );
        queue(game, friend.id, friend.id, requestText, {
          issueId,
          purpose: "request",
          photoId: id,
        });
      }
      game.everProblem = true;
    } else {
      for (const id of present) {
        const text = reactionLine(
          game,
          friend.id,
          id,
          "positive",
          post.audience,
        );
        post.comments.push({ friend: friend.id, text, photoId: id });
        if (fresh)
          queue(game, friend.id, friend.id, text, {
            purpose: "reaction",
            postId: post.id,
            photoId: id,
          });
      }
    }
  }
  if (!post.comments.length) {
    const friend = characters.find((c) => c.id !== game.hero)!.id;
    for (const id of post.photos)
      post.comments.push({
        friend,
        text: reactionLine(game, friend, id, "positive", post.audience),
        photoId: id,
      });
  }
}
function beginPhotoRound(game: Game, id: string) {
  const image = asset(game, id);
  const current = currentPhotoRound(game);
  if (current?.photo === image.photo && current.outcome === "active") {
    current.asset = id;
    return;
  }
  if (current?.outcome === "active") completePhotoRound(game, "changed");
  game.photoFlow.rounds.push({
    photo: image.photo,
    asset: id,
    outcome: "active",
  });
  game.photoFlow.current = game.photoFlow.rounds.length - 1;
  game.photoFlow.result = false;
}

function completePhotoRound(game: Game, choice?: "kept" | "changed") {
  const round = currentPhotoRound(game);
  if (!round || round.outcome !== "active") return;
  round.outcome = roundIssues(game).length
    ? "unresolved"
    : roundHasLivePost(game)
      ? "posted"
      : roundPosts(game).length
        ? "removed"
        : (choice ?? "changed");
  game.photoFlow.result = true;
  record(game, photoRoundSummary(game), {
    type: "decision",
    photos: [round.asset],
  });
}

export type Action = ReviewAction
  | { type: "selectPhoto"; photo: string }
  | { type: "editPhoto"; photo: string }
  | { type: "resendPhoto"; photo: string; room: Character | "group" }
  | { type: "finishPhoto"; keep?: boolean }
  | { type: "nextPhoto" }
  | { type: "finishMeeting" }
  | { type: "introNext" }
  | { type: "introBack" }
  | { type: "returnToPhone" }
  | { type: "decideNoPost" }
  | {
      type: "prepareChat";
      photo: string;
      room: Character | "group";
      audience?: Audience;
    }
  | { type: "navigate"; screen: Screen; room?: Character | "group" | null }
  | {
      type: "reply";
      room: Character | "group";
      kind: ReplyKind;
      photo?: string;
      audience?: Audience;
    }
  | { type: "deliver"; room?: Character | "group" }
  | { type: "viewPhoto"; photo: PhotoId }
  | { type: "draft"; source: string; photo: PhotoId; edits: Edit[] }
  | { type: "draftVisibility"; open: boolean }
  | { type: "saveVersion"; photo: PhotoId; edits: Edit[]; id?: string }
  | { type: "deleteVersion"; id: string }
  | { type: "post"; photos: string[]; caption: string; audience: Audience }
  | { type: "deletePost"; id: string }
  | { type: "removePhoto"; post: string; photo: string }
  | { type: "audience"; post: string; audience: Audience }
  | { type: "advance" }
  | { type: "special"; choice: "respect" | "rush" }
  | { type: "completeSpecial" }
  | { type: "speed"; value: number }
  | { type: "readNotices" }
  | { type: "nextEpisode" }
  | { type: "sendPhotos"; room: Character | "group"; photos: string[] };
export function reduceGame(state: Game, action: Action): Game {
  const g = migrateGame(state);
  if (action.type.startsWith("review"))
    return reduceReview(g, action as ReviewAction, reduceGame);
  if (
    g.stage === "intro" &&
    !["introNext", "introBack", "speed"].includes(action.type)
  )
    return g;
  switch (action.type) {
    case "selectPhoto": {
      const image = asset(g, action.photo);
      if (
        !episodePhotos(g).some((p) => p.id === image.photo) ||
        g.pending.length
      )
        break;
      beginPhotoRound(g, action.photo);
      g.chatTarget = { photo: action.photo, audience: "close" };
      g.screen = "chat";
      g.room = "group";
      readRoom(g, "group");
      break;
    }
    case "editPhoto": {
      const image = asset(g, action.photo);
      if (!episodePhotos(g).some((p) => p.id === image.photo)) break;
      g.editorDraft = {
        source: action.photo,
        photo: image.photo,
        edits:
          g.editorDraft?.source === action.photo
            ? g.editorDraft.edits
            : image.edits,
        open: true,
      };
      g.screen = "album";
      g.room = null;
      break;
    }
    case "resendPhoto": {
      const version = g.versions.find(
        (v) => v.id === action.photo && !v.deleted,
      );
      if (
        !version ||
        !g.story.firstContact ||
        action.room === g.hero ||
        g.pending.length
      )
        break;
      const ready = reduceGame(g, {
        type: "navigate",
        screen: "chat",
        room: action.room,
      });
      const sent = reduceGame(ready, {
        type: "sendPhotos",
        room: action.room,
        photos: [action.photo],
      });
      return reduceGame(sent, {
        type: "reply",
        room: action.room,
        kind: "ask",
        photo: action.photo,
      });
    }
    case "finishPhoto": {
      const round = currentPhotoRound(g);
      if (!round || round.outcome !== "active") break;
      if (action.keep) {
        if (roundHasLivePost(g) || g.pending.length || !g.story.firstContact)
          break;
        g.story.photoChoices[round.photo] = "keep";
        g.messages.group.push({
          id: uid(),
          from: "me",
          text: "이 사진은 우리끼리 간직할게.",
          read: true,
          photoId: round.asset,
        });
        const friend = characters.find((c) => c.id !== g.hero)!.id;
        queue(g, "group", friend, groupFollowup("keepPhoto", friend), {
          purpose: "decision",
          photoId: round.asset,
        });
        g.screen = "chat";
        g.room = "group";
        readRoom(g, "group");
        completePhotoRound(g, "kept");
      } else if (canFinishPhoto(g)) completePhotoRound(g);
      break;
    }
    case "nextPhoto":
      if (g.pending.length) break;
      completePhotoRound(g, "changed");
      g.photoFlow.current = null;
      g.photoFlow.result = false;
      g.chatTarget = null;
      g.screen = "album";
      g.room = null;
      break;
    case "introNext":
      if (g.stage !== "intro") break;
      g.story.introLine++;
      if (g.story.introLine >= introLines(g).length) {
        g.stage = "play";
        g.screen = "chat";
        g.room = "group";
      }
      break;
    case "introBack":
      if (g.stage === "intro")
        g.story.introLine = Math.max(0, g.story.introLine - 1);
      break;
    case "returnToPhone":
      if (g.stage === "special" && !g.specialResult) g.stage = "play";
      break;
    case "prepareChat":
      g.chatTarget = {
        photo: action.photo,
        audience: action.audience ?? "close",
      };
      g.screen = "chat";
      g.room = action.room;
      readRoom(g, action.room);
      break;
    case "decideNoPost":
      if (
        !g.story.firstContact ||
        !g.story.opinionsSeen ||
        g.posts.some((p) => !p.deleted)
      )
        break;
      g.story.decision = "keep";
      g.skipped = true;
      g.story.resultSeen = true;
      record(g, "사진을 게시하지 않고 간직하기로 결정했어요.", {
        type: "decision",
      });
      break;
    case "navigate":
      if (!g.pending.length) g.photoFlow.result = false;
      g.screen = action.screen;
      g.room = action.room ?? null;
      if (g.room) {
        readRoom(g, g.room);
      }
      break;
    case "sendPhotos": {
      if (
        !g.story.photoPromptSeen ||
        action.room === g.hero ||
        (!g.story.firstContact && action.room !== "group")
      )
        break;
      const ids = [...new Set(action.photos)]
        .filter(
          (id) =>
            episodePhotos(g).some((p) => p.id === id) ||
            g.versions.some(
              (v) =>
                v.id === id &&
                !v.deleted &&
                episodePhotos(g).some((p) => p.id === v.photo),
            ),
        )
        .slice(0, 3);
      if (!ids.length) break;
      if (ids.length === 1) beginPhotoRound(g, ids[0]);
      else {
        completePhotoRound(g, "changed");
        g.photoFlow.current = null;
        g.photoFlow.result = false;
      }
      g.messages[action.room].push({
        id: uid(),
        from: "me",
        text: `사진 ${ids.length}장`,
        photos: ids,
        read: true,
      });
      g.chatRequests[action.room] = [];
      g.chatTarget = null;
      ids.forEach((id) => {
        const photo = asset(g, id).photo;
        if (!g.story.viewed.includes(photo)) g.story.viewed.push(photo);
      });
      record(
        g,
        `${action.room === "group" ? "단체방" : nameOf(action.room)}에 사진 ${ids.length}장을 보냈어요.`,
        { type: "contact", photos: ids },
      );
      break;
    }
    case "reply": {
      const { room, kind } = action;
      const photo = action.photo ?? sharedPhotos(g, room)[0] ?? "";
      const audience = action.audience ?? "close";
      if (room === g.hero) break;
      const option = replyOptions(g, room, photo, audience).find(
        (o) => o.kind === kind,
      );
      if (!option) break;
      const respondingIssue = conversationIssue(g, room);
      g.messages[room].push({
        id: uid(),
        from: "me",
        text: option.text,
        read: true,
        photoId: kind === "topic" ? undefined : respondingIssue?.photo ??
          (sharedPhotos(g, room).length === 1 ? photo : undefined),
        issueId: respondingIssue?.id,
      });
      record(
        g,
        (room === "group" ? "단체방" : nameOf(room)) +
          "에 “" +
          option.text +
          "”라고 말했어요.",
      );
      if (kind === "topic") {
        const sender: Character =
          g.hero === "hachiware" ? "chiikawa" : "hachiware";
        g.story.topicStarted = true;
        const memory = stageMemory(g);
        if (memory)
          queue(g, room, memory.friend, memory.text, { purpose: "memory" });
        queue(g, room, sender, topicReply(sender), {
          purpose: "photo_question",
        });
        break;
      }
      if (kind === "ask") {
        requestSharedPhotos(g, room, sharedPhotos(g, room));
        break;
      }
      if (room === "group") {
        if (kind === "keepPhoto")
          sharedPhotos(g, room).forEach(
            (id) => (g.story.photoChoices[asset(g, id).photo] = "keep"),
          );
        const sender = characters.find((c) => c.id !== g.hero)!.id;
        queue(g, room, sender, groupFollowup(kind, sender), {
          purpose: "reply",
          photoId: sharedPhotos(g, room).length === 1 ? photo : undefined,
        });
        if (kind === "keepPhoto" && sharedPhotos(g, room).length === 1)
          completePhotoRound(g, "kept");
        break;
      }
      const issue = conversationIssue(g, room);
      if (kind === "show") {
        queue(
          g,
          room,
          room,
          room === "usagi"
            ? "야하! 그때 사진! 어디에 올릴 거야?"
            : "기억나! 이 사진을 올리고 싶은 거야? 누구한테 보여 주려고?",
          { purpose: "reply", photoId: issue?.photo ?? photo, issueId: issue?.id },
        );
      } else if (kind === "why" && issue) {
        queue(
          g,
          room,
          room,
          issueExplanation(
            g,
            room,
            issue.photo,
            g.posts.find((p) => p.id === issue.post)?.audience ?? "close",
          ),
          { purpose: "reply", photoId: issue?.photo ?? photo, issueId: issue?.id },
        );
      } else if (kind === "apology") {
        if (!g.apologized.includes(room)) {
          g.apologized.push(room);
          g.trust[room]++;
        }
        if (issue) issue.decision = "remove";
        queue(
          g,
          room,
          room,
          issue ? removalPromiseReply(room) : groupFollowup("respect", room),
          { purpose: "reply", photoId: issue?.photo ?? photo, issueId: issue?.id },
        );
      } else if (kind === "insist" && issue) {
        if (issue.decision !== "keep") g.trust[room]--;
        issue.decision = "keep";
        queue(
          g,
          room,
          room,
          reactionLine(
            g,
            room,
            issue.photo,
            "keep",
            g.posts.find((p) => p.id === issue.post)?.audience,
          ),
          { purpose: "reply", photoId: issue?.photo ?? photo, issueId: issue?.id },
        );
      } else {
        if (issue && kind === "respect") issue.decision = "remove";
        if (kind === "keepPhoto")
          g.story.photoChoices[asset(g, photo).photo] = "keep";
        const answer = issue
          ? removalPromiseReply(room)
          : groupFollowup(kind, room);
        queue(g, room, room, answer, { purpose: "reply", photoId: issue?.photo ?? photo, issueId: issue?.id });
      }
      if (kind === "respect" || kind === "apology")
        g.issues
          .filter((i) => i.friend === room && i.resolved)
          .forEach((i) => (i.conversationClosed = true));
      resolveIssues(g);
      break;
    }
    case "deliver": {
      const index = action.room
        ? g.pending.findIndex((p) => p.room === action.room)
        : 0;
      if (index < 0) break;
      const [item] = g.pending.splice(index, 1);
      if (!item) break;
      const read = g.screen === "chat" && g.room === item.room;
      for (const consent of [
        ...(item.consents ?? []),
        ...(item.consent ? [item.consent] : []),
      ]) {
        g.consents = g.consents.filter(
          (c) =>
            !(
              c.friend === consent.friend &&
              c.photo === consent.photo &&
              c.audience === consent.audience
            ),
        );
        g.consents.push(consent);
      }
      if (item.issueId && item.purpose === "request") {
        const issue = g.issues.find((i) => i.id === item.issueId);
        if (issue) {
          issue.notified = true;
          issue.read = read;
        }
      }
      if (read && item.purpose) g.story.resultSeen = true;
      if (read && item.purpose === "consent") g.story.opinionsSeen = true;
      if (
        read &&
        g.episode !== "EP01" &&
        ["reaction", "request", "followup"].includes(item.purpose ?? "")
      )
        g.story.opinionsSeen = true;
      if (read && item.purpose === "photo_question")
        g.story.photoPromptSeen = true;
      g.messages[item.room].push({
        id: uid(),
        from: item.from,
        text: item.text,
        read,
        issueId: item.issueId,
        purpose: item.purpose,
        postId: item.postId,
        photoId: item.photoId,
      });
      g.notices.push({
        id: uid(),
        text: nameOf(item.from) + " · " + item.text,
        read,
        room: item.room,
      });
      resolveIssues(g);
      break;
    }
    case "viewPhoto":
      if (!g.story.viewed.includes(action.photo))
        g.story.viewed.push(action.photo);
      break;
    case "draft":
      g.editorDraft = {
        source: action.source,
        photo: action.photo,
        edits: structuredClone(action.edits),
        open:
          g.editorDraft?.source === action.source
            ? (g.editorDraft.open ?? true)
            : true,
      };
      break;
    case "draftVisibility":
      if (g.editorDraft) g.editorDraft.open = action.open;
      break;
    case "saveVersion":
      g.editorDraft = null;
      g.versions.push({
        id: action.id ?? uid(),
        photo: action.photo,
        edits: structuredClone(action.edits),
        deleted: false,
        created: new Date().toISOString(),
      });
      beginPhotoRound(g, g.versions.at(-1)!.id);
      record(
        g,
        `${photoById(action.photo).title}의 편집본을 새 버전으로 저장했어요.`,
      );
      break;
    case "deleteVersion": {
      const version = g.versions.find((v) => v.id === action.id);
      if (version) version.deleted = true;
      if (currentPhotoRound(g)?.asset === action.id)
        currentPhotoRound(g)!.asset = currentPhotoRound(g)!.photo;
      record(
        g,
        "사진첩에서 편집 버전을 삭제했어요. 추억 기록에는 남아 있어요.",
      );
      break;
    }
    case "post": {
      const valid = action.photos
        .filter(
          (id) =>
            episodePhotos(g).some((photo) => photo.id === id) ||
            g.versions.some(
              (v) =>
                v.id === id &&
                !v.deleted &&
                episodePhotos(g).some((p) => p.id === v.photo),
            ),
        )
        .slice(0, g.review.enabled ? episodePhotos(g).length : 3);
      if ((g.episode === "EP01" && !g.story.firstContact) || !valid.length)
        break;
      if (valid.length === 1) beginPhotoRound(g, valid[0]);
      if (g.episode !== "EP01") g.story.firstContact = true;
      const post = {
        id: uid(),
        caption: action.caption,
        photos: valid,
        originalPhotos: [...valid],
        audience: action.audience,
        deleted: false,
        comments: [],
      };
      g.posts.unshift(post);
      g.skipped = false;
      g.story.decision = "share";
      g.story.resultSeen = true;
      reactToPost(g, post, true);
      if (valid.length > 1) {
        completePhotoRound(g);
        g.photoFlow.current = null;
        g.photoFlow.result = false;
      }
      record(
        g,
        `사진 ${valid.length}장을 ${action.audience === "public" ? "전체" : "친한 친구"} 공개로 게시했어요.`,
        {
          type: "post",
          photos: [...valid],
          audience: action.audience,
          post: post.id,
        },
      );
      break;
    }
    case "deletePost": {
      const p = g.posts.find((p) => p.id === action.id);
      if (p) p.deleted = true;
      record(g, "SNS 게시물을 삭제했어요.", {
        type: "delete-post",
        photos: [...(p?.photos ?? [])],
        post: action.id,
      });
      resolveIssues(g);
      break;
    }
    case "removePhoto": {
      const p = g.posts.find((p) => p.id === action.post);
      if (p) {
        p.photos = p.photos.filter((id) => id !== action.photo);
        if (!p.photos.length) p.deleted = true;
      }
      record(g, "SNS 게시물에서 사진 한 장을 내렸어요.", {
        type: "remove-photo",
        photos: [action.photo],
        post: action.post,
      });
      resolveIssues(g);
      break;
    }
    case "audience": {
      const p = g.posts.find((p) => p.id === action.post);
      if (p && !p.deleted) {
        p.audience = action.audience;
        reactToPost(g, p);
      }
      record(
        g,
        `게시물을 ${action.audience === "public" ? "전체" : "친한 친구"} 공개로 바꿨어요.`,
        {
          type: "scope",
          photos: [...(p?.photos ?? [])],
          post: action.post,
          audience: action.audience,
        },
      );
      resolveIssues(g);
      break;
    }
    case "finishMeeting":
    case "advance": {
      if (action.type === "finishMeeting") {
        if (
          !g.photoFlow.rounds.length ||
          g.pending.length ||
          currentPhotoRound(g)?.outcome === "active"
        )
          break;
        g.photoFlow.result = false;
        const live = g.posts.some((post) => !post.deleted);
        g.story.decision = live ? "share" : "keep";
        g.skipped = !live;
        g.story.resultSeen = true;
      }
      const guide = storyGuide(g);
      if (guide.ready) {
        if (currentPhotoRound(g)?.outcome === "active")
          completePhotoRound(g, g.skipped ? "kept" : undefined);
        g.photoFlow.result = false;
        if (g.episode === "EP01") {
          g.stage = "special";
          g.specialResult = null;
        } else if (nextEpisode(g.episode)) g.stage = "stageComplete";
        else {
          const states = [g, ...Object.values(g.episodes).map((p) => p!.state)];
          g.ending = states.some((s) => s.issues.some((i) => !i.resolved))
            ? "unresolved"
            : states.some((s) => s.everProblem)
              ? "recovery"
              : "good";
          g.stage = "ending";
        }
      } else {
        g.screen = guide.screen!;
        g.room = guide.room ?? null;
        if (g.room) readRoom(g, g.room);
      }
      if (action.type === "finishMeeting" && g.stage === "stageComplete")
        return reduceGame(g, { type: "nextEpisode" });
      break;
    }
    case "special": {
      if (g.stage !== "special" || g.specialResult) break;
      g.specialChoice = action.choice;
      const scene = specialScene(g);
      g.specialResult = {
        reply: scene.response,
        friend: scene.friend,
        reconsidered: action.choice === "rush" && g.hero === "hachiware",
      };
      g.trust[scene.friend] += g.specialResult.reconsidered ? -1 : 1;
      record(g, action.choice === "respect" ? scene.respect : scene.rush, {
        type: "special",
      });
      break;
    }
    case "completeSpecial":
      if (g.stage !== "special" || !g.specialResult) break;
      resolveIssues(g);
      g.ending = g.issues.some((i) => !i.resolved)
        ? "unresolved"
        : g.everProblem || g.issues.some((i) => i.withdrawal)
          ? "recovery"
          : "good";
      g.stage = "stageComplete";
      record(g, g.specialResult.reply, { type: "special" });
      break;
    case "speed":
      g.speed = action.value;
      break;
    case "nextEpisode": {
      const next = nextEpisode(g.episode);
      if (!next || !["ending", "stageComplete"].includes(g.stage)) break;
      const { episode, episodes, ...state } = g;
      const fresh = newGame(g.hero, g.maruAllows, {
        withdrawal: false,
        friend: g.withdrawalPlan.friend,
      });
      fresh.episode = next.id;
      fresh.episodes = { ...episodes, [episode]: { completed: true, state } };
      fresh.speed = g.speed;
      fresh.history = [`${next.id} ${next.title} 이야기를 시작했어요.`];
      return fresh;
    }
    case "readNotices":
      g.notices.forEach((n) => (n.read = true));
      break;
  }
  if (action.type === "navigate" || action.type === "deliver") maybeWithdraw(g);
  g.story.phase = storyPhase(g);
  return g;
}
export function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (
      g.schema !== 1 ||
      !characters.some((c) => c.id === g.hero) ||
      !Array.isArray(g.versions) ||
      !Array.isArray(g.pending) ||
      !Array.isArray(g.posts) ||
      !Array.isArray(g.issues) ||
      !Array.isArray(g.notices) ||
      !g.messages ||
      !["group", ...characters.map((c) => c.id)].every((room) =>
        Array.isArray(g.messages[room]),
      ) ||
      !g.trust ||
      !Array.isArray(g.history)
    )
      return null;
    return enableReview(migrateGame(g as Game));
  } catch {
    return null;
  }
}
