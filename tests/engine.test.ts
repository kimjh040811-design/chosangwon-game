import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, permission, reduceGame } from "../src/engine";
import { characters, photos, photoById, introductions } from "../src/data";
import {
  replyOptions,
  conversationState,
  reactionLine,
  topicText,
} from "../src/dialogue";
import { stageMemory, journeySummary } from "../src/narrative";
import { migrateGame, storyGuide } from "../src/story";
import { covered, protection } from "../src/protection";
import type { Character, Game, Edit } from "../src/model";
import { episodePhotos, introLines } from "../src/data";
import { protectsFriend } from "../src/protection";
import { evaluateTrust, reviewedCount, reviewSelection, missingCoverText, reviewOpinion } from "../src/review";
import {
  currentPhotoRound,
  canFinishPhoto,
  conversationPhotoId,
} from "../src/photo-flow";
import { photoActivities } from "../src/photo-activities";
import { currentRequests, needsScopeConfirmation } from "../src/review";

test("photo activities match the exact 5/4/4/3 allocation without phantom face requests", () => {
  const expected = [[2, 1, 1, 2], [1, 1, 1, 0], [1, 1, 1, 0], [1, 1, 1, 1]];
  const types = ["edit", "opinions", "audience", "memory"];
  assert.equal(Object.keys(photoActivities).length, 16);
  for (let ep = 1; ep <= 4; ep++) {
    const entries = Object.entries(photoActivities).filter(([id]) => ep === 1 ? ["group", "snack", "funny"].includes(id) || id.startsWith("EP01") : id.startsWith(`EP0${ep}`));
    assert.deepEqual(types.map((t) => entries.filter(([, a]) => a.type === t).length), expected[ep - 1]);
    for (const [id, activity] of entries) for (const [friend, opinion] of Object.entries(activity.opinions ?? {}))
      if (opinion.condition === "cover") assert.ok(photoById(id).faces.some((f) => f.friend === friend), `${id}: ${friend}`);
  }
});

for (const [photo, friend] of [["EP02-P02", "hachiware"], ["EP03-P02", "usagi"]] as const)
  test(`${photo} never silently transfers close consent into public permission`, () => {
    let g = integratedAsk(integratedStart(), "group");
    // The target belongs to a later meeting; advance with real reviewed choices.
    g = integratedStart();
    const ep = photo.slice(0, 4);
    while (g.episode !== ep) {
      g = integratedAll(g, "keep");
      g = reduceGame(reduceGame(g, { type: "reviewFinish" }), { type: "reviewNext" });
      for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
    }
    g = integratedAsk(g, photo);
    assert.equal(permission(g, friend, photo, "close"), true);
    assert.equal(permission(g, friend, photo, "public"), false);
    g = reduceGame(g, { type: "reviewAudience", audience: "public" });
    assert.deepEqual(g.review.changedScopePhotos, [photo]);
    assert.equal(needsScopeConfirmation(g, photo), true);
    assert.equal(currentRequests(g, photo).find((r) => r.friend === friend)!.condition, "cover");
    g = integratedRead(reduceGame(g, { type: "reviewAsk" }));
    assert.equal(permission(g, friend, photo, "public"), false);
    assert.equal(needsScopeConfirmation(g, photo), false);
    g = reduceGame(g, { type: "reviewEdit" });
    const edits: Edit[] = photoById(photo).faces.filter((f) => f.friend === friend).map((f) => ({ kind: "sticker", x: f.center.x, y: f.center.y, size: .4, symbol: "●" }));
    g = reduceGame(g, { type: "reviewSave", edits });
    assert.equal(permission(g, friend, g.versions.at(-1)!.id, "public"), false);
    g = integratedRead(reduceGame(g, { type: "reviewSend" }));
    assert.equal(permission(g, friend, g.versions.at(-1)!.id, "public"), true);
    assert.ok(g.messages.group.some((m) => m.photoId === photo && m.text.includes("전체 공개")));
  });

test("two real faces need both edits, then an exact resend, while memories use one send", () => {
  let g = integratedAsk(integratedStart(), "EP01-P04");
  const faces = photoById("EP01-P04").faces.filter((f) => f.friend === "chiikawa" || f.friend === "hachiware");
  const edits: Edit[] = faces.map((f) => ({ kind: "sticker", x: f.center.x, y: f.center.y, size: .4, symbol: "●" }));
  g = reduceGame(g, { type: "reviewEdit" });
  g = reduceGame(g, { type: "reviewSave", edits: edits.slice(0, 1) });
  g = integratedRead(reduceGame(g, { type: "reviewSend" }));
  assert.equal(currentRequests(g, g.review.photos["EP01-P04"].asset).filter((r) => r.hidden).length, 1);
  g = reduceGame(g, { type: "reviewEdit" });
  g = reduceGame(g, { type: "reviewSave", edits });
  const id = g.versions.at(-1)!.id;
  assert.equal(permission(g, "chiikawa", id, "close"), false);
  g = integratedRead(reduceGame(g, { type: "reviewSend" }));
  assert.ok(["chiikawa", "hachiware"].every((f) => permission(g, f as Character, id, "close")));
  for (const photo of ["snack", "EP01-P06"]) {
    g = reduceGame(g, { type: "reviewSelect", photo });
    g = integratedRead(reduceGame(g, { type: "reviewSend" }));
    assert.ok(g.review.photos[photo].asked.includes(photo));
    assert.equal(needsScopeConfirmation(g, photo), false);
  }
});

function integratedStart() {
  let game = reduceGame(newGame("maru"), { type: "reviewStart" });
  for (let i = 0; i < 4; i++) game = reduceGame(game, { type: "introNext" });
  return game;
}

function integratedRead(game: Game) {
  return reduceGame(game, { type: "reviewReplies" });
}

function integratedAsk(game: Game, photo: string) {
  game = reduceGame(game, { type: "reviewSelect", photo });
  game = integratedRead(reduceGame(game, { type: "reviewSend" }));
  return integratedRead(reduceGame(game, { type: "reviewAsk" }));
}

function integratedDecide(game: Game, decision: "include" | "keep") {
  game = integratedRead(reduceGame(game, { type: "reviewDecide", decision }));
  return reduceGame(game, { type: "reviewContinue" });
}

function integratedAll(game: Game, decision: "include" | "keep" = "include") {
  for (const photo of episodePhotos(game)) game = integratedDecide(integratedAsk(game, photo.id), decision);
  return game;
}

test("keeping an edited photograph does not require covering or resending it for trust", () => {
  for (const size of [.02, .3]) {
    let game = integratedAsk(integratedStart(), "group");
    game = reduceGame(game, { type: "reviewEdit" });
    const face = photoById("group").faces.find((f) => f.friend === "chiikawa")!;
    game = reduceGame(game, { type: "reviewSave", edits: [{ kind: "sticker", x: face.center.x, y: face.center.y, size, symbol: "●" }] });
    game = integratedDecide(game, "keep");
    for (const photo of episodePhotos(game).filter((p) => p.id !== "group")) game = integratedDecide(integratedAsk(game, photo.id), "keep");
    const result = evaluateTrust(game);
    assert.equal(result.percent, 100);
    assert.ok(!result.feedback.some((text) => text.includes("다시 보여") || text.includes("얼굴을 가렸")));
    assert.ok(result.activities.includes("사진 편집하기"));
    assert.ok(!result.activities.includes("편집본 다시 보여 주기"));
  }
});

test("scope changes do not require another opinion for photographs kept out of the post", () => {
  let game = integratedAll(integratedStart(), "keep");
  game = reduceGame(game, { type: "reviewAudience", audience: "public" });
  assert.equal(evaluateTrust(game).percent, 100);
  assert.ok(!game.review.notice.includes(photoById("EP01-P05").title));
});

test("a caption draft survives serialization and dialog questions respect the answer", () => {
  let game = integratedAll(integratedStart());
  game = reduceGame(game, { type: "reviewCaption", caption: "함께 웃었던 날" });
  const restored = migrateGame(JSON.parse(JSON.stringify(game)));
  assert.equal(restored.review.caption, "함께 웃었던 날");
  game = integratedAsk(integratedStart(), "group");
  game = integratedRead(reduceGame(game, { type: "reviewWhy", friend: "hachiware" }));
  assert.ok(game.messages.group.some((m) => m.from === "me" && m.text.includes("어떤 점이 마음에 들어?")));
  game = integratedRead(reduceGame(game, { type: "reviewWhy", friend: "chiikawa" }));
  assert.ok(game.messages.group.some((m) => m.from === "me" && m.text.includes("어떤 점이 마음에 걸려?")));
});

test("a photo impression is not repeated when asking permission and Usagi keeps his short voice", () => {
  let game = integratedAsk(integratedStart(), "EP01-P04");
  assert.equal(game.messages.group.filter((m) => m.from === "hachiware" && m.text.includes("회전목마 불빛이랑 우리 표정")).length, 1);
  assert.ok(!game.messages.group.some((m) => m.text.includes("공개 범위가 바뀌어도")));
  game = integratedAsk(game, "funny");
  assert.ok(game.messages.group.some((m) => m.from === "usagi" && m.text === "우! 이 표정은 올리지 말아 줘! 우리끼리만 보자!"));
  assert.equal(reviewOpinion(game, "usagi", "funny", "public").condition, "no");
});

test("integrated review separates the shared impression from fixed permission and publication", () => {
  let g = reduceGame(integratedStart(), { type: "reviewSelect", photo: "group" });
  g = integratedRead(reduceGame(g, { type: "reviewSend" }));
  assert.equal(g.consents.length, 0);
  assert.match(g.messages.group.find((m) => m.from === "hachiware")!.text, /성 앞/);
  g = integratedRead(reduceGame(g, { type: "reviewAsk" }));
  assert.ok(g.messages.group.some((m) => m.text === "난 좋아! 다 같이 잘 나왔어!"));
  assert.ok(g.messages.group.some((m) => m.text === "내 얼굴만 가려 주면 괜찮아…"));
  g = integratedDecide(g, "include");
  assert.equal(g.posts.length, 0);
  assert.equal(g.issues.length, 0);
  assert.deepEqual(reviewSelection(g), ["group"]);
});

test("all six photos must be reviewed and become one idempotent batch post", () => {
  let g = integratedAsk(integratedStart(), "group");
  g = integratedDecide(g, "include");
  g = reduceGame(g, { type: "reviewPublish", audience: "close", caption: "추억" });
  assert.equal(g.posts.length, 0);
  g = integratedAll(g);
  assert.equal(reviewedCount(g), 6);
  assert.equal(g.review.phase, "preview");
  g = reduceGame(g, { type: "reviewPublish", audience: "close", caption: "추억" });
  assert.equal(g.posts.length, 1);
  assert.equal(g.posts[0].photos.length, 6);
  assert.ok(g.issues.some((i) => i.photo === "group" && i.friend === "chiikawa"));
  assert.ok(g.issues.some((i) => i.photo === "funny" && i.friend === "usagi"));
  const again = reduceGame(g, { type: "reviewPublish", audience: "close", caption: "추억" });
  assert.equal(again.posts.length, 1);
});

test("editing first works, saving does not approve it, and real resend confirms the exact version", () => {
  let g = reduceGame(integratedStart(), { type: "reviewSelect", photo: "group" });
  g = reduceGame(g, { type: "reviewEdit" });
  const edits: Edit[] = photoById("group").faces.filter((f) => f.friend === "chiikawa").map((f) => ({ kind: "sticker", x: f.center.x, y: f.center.y, size: .3, symbol: "●" }));
  g = reduceGame(g, { type: "reviewSave", edits });
  const version = g.versions.at(-1)!;
  assert.equal(g.consents.length, 0);
  assert.equal(g.screen, "chat");
  g = integratedRead(reduceGame(g, { type: "reviewSend" }));
  assert.equal(permission(g, "chiikawa", version.id, "close"), true);
  assert.ok(g.messages.group.some((m) => m.text === "응! 이제 괜찮아. 고마워!" && m.photoId === version.id));
  assert.ok(g.messages.group.some((m) => m.text === "좋다! 이제 다 같이 볼 수 있겠다!"));
});

test("partial covering gets a different response and reports the actual remaining photostrip appearance", () => {
  let g = integratedAsk(integratedStart(), "group");
  g = reduceGame(g, { type: "reviewEdit" });
  g = reduceGame(g, { type: "reviewSave", edits: [{ kind: "brush", size: .02, points: [{ x: .1, y: .7 }] }] });
  g = integratedRead(reduceGame(g, { type: "reviewSend" }));
  assert.ok(g.messages.group.some((m) => m.text === "고마워… 그런데 내 얼굴이 아직 보여."));
  assert.equal(permission(g, "chiikawa", g.versions.at(-1)!.id, "close"), false);
  g = reduceGame(g, { type: "nextEpisode" });
  const strip = photoById("EP02-P01");
  const appearances = strip.faces.filter((f) => f.friend === "chiikawa");
  g.versions.push({ id: "partial-strip", photo: strip.id, edits: appearances.slice(0, 3).map((f) => ({ kind: "sticker", x: f.center.x, y: f.center.y, size: .2, symbol: "●" })), deleted: false, created: "" });
  assert.match(missingCoverText(g, "chiikawa", "partial-strip"), /맨 아래/);
});

test("each photograph has its own pre-publication reason question and real replies", () => {
  let g = integratedAsk(integratedStart(), "group");
  g = integratedRead(reduceGame(g, { type: "reviewWhy", friend: "chiikawa" }));
  assert.ok(g.messages.group.some((m) => m.photoId === "group" && m.text.includes("조금 부끄러워")));
  const length = g.messages.group.length;
  g = reduceGame(g, { type: "reviewWhy", friend: "chiikawa" });
  assert.equal(g.messages.group.length, length);
  g = integratedAsk(g, "EP01-P06");
  g = integratedRead(reduceGame(g, { type: "reviewWhy", friend: "chiikawa" }));
  assert.ok(g.messages.group.some((m) => m.photoId === "EP01-P06" && m.text.includes("같이 찍어서")));
});

test("promise alone changes no edit or permission and the requesting friend answers keeping", () => {
  let g = integratedAsk(integratedStart(), "group");
  g = integratedRead(reduceGame(g, { type: "reviewPromise", friend: "chiikawa" }));
  assert.equal(g.versions.length, 0);
  assert.equal(permission(g, "chiikawa", "group", "close"), false);
  g = integratedAsk(g, "funny");
  g = integratedRead(reduceGame(g, { type: "reviewDecide", decision: "keep" }));
  assert.equal(g.messages.group.at(-1)!.from, "usagi");
  g = reduceGame(g, { type: "reviewPreview" });
  assert.equal(g.review.photos.funny.decision, "keep");
});

test("apology is tied to its issue and only actual deletion solves independent photo requests", () => {
  let g = integratedAll(integratedStart());
  g = integratedRead(reduceGame(g, { type: "reviewPublish", audience: "close", caption: "" }));
  const chi = g.issues.find((i) => i.friend === "chiikawa" && i.photo === "group")!;
  const usagi = g.issues.find((i) => i.friend === "usagi" && i.photo === "funny")!;
  g = reduceGame(g, { type: "reviewOpenIssue", id: chi.id });
  g = integratedRead(reduceGame(g, { type: "reply", room: "chiikawa", kind: "apology", photo: chi.photo }));
  assert.equal(g.issues.find((i) => i.id === chi.id)!.resolved, false);
  assert.equal(g.messages.chiikawa.at(-1)!.issueId, chi.id);
  assert.equal(g.messages.chiikawa.at(-1)!.photoId, "group");
  g = integratedRead(reduceGame(g, { type: "removePhoto", post: chi.post, photo: chi.photo }));
  assert.equal(g.issues.find((i) => i.id === chi.id)!.resolved, true);
  assert.equal(g.issues.find((i) => i.id === usagi.id)!.resolved, false);
  assert.equal(g.posts[0].photos.length, 5);
  g = integratedRead(reduceGame(g, { type: "deletePost", id: g.posts[0].id }));
  assert.ok(g.issues.every((i) => i.resolved));
});

test("new edits never remove an exposed original post or resolve its request", () => {
  let g = integratedAll(integratedStart());
  g = integratedRead(reduceGame(g, { type: "reviewPublish", audience: "close", caption: "" }));
  g = reduceGame(g, { type: "saveVersion", photo: "group", edits: photoById("group").faces.map((f) => ({ kind: "sticker", x: f.center.x, y: f.center.y, size: .3, symbol: "●" })) });
  assert.ok(g.posts[0].photos.includes("group"));
  assert.equal(g.issues.find((i) => i.photo === "group")!.resolved, false);
});

test("all keeping crosses four episodes, scores actual reviewed actions and never praises unperformed editing", () => {
  let g = integratedStart();
  for (let ep = 1; ep <= 4; ep++) {
    g = integratedAll(g, "keep");
    g = reduceGame(g, { type: "reviewFinish" });
    assert.equal(g.stage, "stageComplete");
    assert.equal(evaluateTrust(g).percent, 100);
    assert.ok(!evaluateTrust(g).feedback.some((t) => /편집|가렸|내렸/.test(t)));
    const score = evaluateTrust(g).percent;
    g = reduceGame(g, { type: "reviewFinish" });
    assert.equal(evaluateTrust(g).percent, score);
    g = reduceGame(g, { type: "reviewNext" });
    if (ep < 4) for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
  }
  assert.equal(g.ending, "good");
  assert.equal(g.stage, "ending");
  assert.equal(Object.keys(g.episodes).length, 3);
});

test("birthday refusal and sports post-publication request are fixed by real state", () => {
  let g = integratedStart();
  for (let ep = 1; ep <= 3; ep++) {
    if (ep === 3) assert.equal(reviewOpinion(g, "usagi", "EP03-P03", "close").condition, "no");
    g = integratedAll(g, "keep");
    g = reduceGame(reduceGame(g, { type: "reviewFinish" }), { type: "reviewNext" });
    for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
  }
  g = integratedAll(g);
  g = integratedRead(reduceGame(g, { type: "reviewPublish", audience: "close", caption: "" }));
  assert.ok(g.issues.some((i) => i.withdrawal));
  assert.equal(g.withdrawalPlan.enabled, false);
});

test("unrequested face covering is never praised and repeated decisions do not inflate trust", () => {
  let g = integratedStart();
  g = reduceGame(reduceGame(g, { type: "reviewSelect", photo: "snack" }), { type: "reviewEdit" });
  g = reduceGame(g, { type: "reviewSave", edits: [{ kind: "sticker", x: .5, y: .5, size: .2, symbol: "●" }] });
  g = integratedRead(reduceGame(g, { type: "reviewSend" }));
  g = integratedRead(reduceGame(g, { type: "reviewDecide", decision: "keep" }));
  const before = evaluateTrust(g);
  g = integratedRead(reduceGame(g, { type: "reviewDecide", decision: "keep" }));
  assert.equal(evaluateTrust(g).percent, before.percent);
  assert.ok(!before.feedback.some((text) => text.includes("얼굴을 가렸")));
  assert.ok(g.messages.group.some((m) => m.text.includes("이 사진도 잘 받았어") && m.photoId === g.versions.at(-1)!.id));
});

test("closing an edited photo and reviewing another preserves both the draft and completed decisions", () => {
  let g = integratedAsk(integratedStart(), "group");
  g = reduceGame(g, { type: "reviewEdit" });
  g = reduceGame(g, { type: "draft", source: "group", photo: "group", edits: [{ kind: "brush", size: .1, points: [{ x: .2, y: .7 }] }] });
  g = reduceGame(g, { type: "reviewCloseEditor" });
  const draft = structuredClone(g.editorDraft);
  g = integratedDecide(integratedAsk(g, "snack"), "keep");
  assert.deepEqual(g.editorDraft?.edits, draft!.edits);
  assert.equal(g.review.photos.snack.decision, "keep");
  g = reduceGame(g, { type: "reviewSelect", photo: "group" });
  g = reduceGame(g, { type: "reviewEdit" });
  assert.deepEqual(g.editorDraft?.edits, draft!.edits);
});

test("an older photo request keeps its own context while another round is selected", () => {
  let g = ask(start(), "group");
  g = readAll(
    reduceGame(g, {
      type: "post",
      photos: ["group"],
      audience: "close",
      caption: "",
    }),
  );
  g = reduceGame(g, { type: "nextPhoto" });
  g = ask(g, "group", "snack");
  g = reduceGame(g, { type: "navigate", screen: "chat", room: "chiikawa" });
  assert.equal(conversationPhotoId(g), "group");
  assert.equal(currentPhotoRound(g)?.photo, "snack");
  assert.ok(g.issues.some((i) => !i.resolved && i.friend === "chiikawa"));
});

test("photo rounds follow the chosen order and keeping one allows the next meeting", () => {
  let g = ask(start(), "group", "snack");
  assert.equal(currentPhotoRound(g)?.photo, "snack");
  g = readAll(reduceGame(g, { type: "finishPhoto", keep: true }));
  assert.equal(currentPhotoRound(g)?.outcome, "kept");
  assert.equal(g.photoFlow.result, true);
  g = reduceGame(g, { type: "nextPhoto" });
  g = reduceGame(g, { type: "selectPhoto", photo: "funny" });
  assert.equal(g.photoFlow.current, 1);
  assert.deepEqual(
    g.photoFlow.rounds.map((r) => r.photo),
    ["snack", "funny"],
  );
  g = reduceGame(g, { type: "nextPhoto" });
  assert.equal(g.photoFlow.rounds[1].outcome, "changed");
  g = reduceGame(g, { type: "finishMeeting" });
  assert.equal(g.stage, "special");
  assert.equal(g.posts.length, 0);
});

test("saved-version resend sends the actual image and requests a fresh opinion once", () => {
  let g = ask(start(), "group");
  g = reduceGame(g, {
    type: "saveVersion",
    photo: "group",
    edits: photoById("group").faces.map((face) => ({
      kind: "sticker",
      x: face.center.x,
      y: face.center.y,
      size: 0.5,
      symbol: "●",
    })),
  });
  const id = g.versions[0].id;
  assert.equal(permission(g, "chiikawa", id, "close"), false);
  const before = g.messages.group.filter((m) => m.photos).length;
  g = reduceGame(g, { type: "resendPhoto", photo: id, room: "group" });
  assert.equal(g.messages.group.filter((m) => m.photos).length, before + 1);
  assert.deepEqual(g.messages.group.findLast((m) => m.photos)?.photos, [id]);
  assert.equal(permission(g, "chiikawa", id, "close"), false);
  g = readAll(g);
  assert.equal(permission(g, "chiikawa", id, "close"), true);
  assert.ok(!replyOptions(g, "group", id).some((o) => o.kind === "cover"));
  assert.equal(currentPhotoRound(g)?.asset, id);
});

test("a problematic posted round remains active until removal or an explicit keep decision", () => {
  let g = ask(start(), "group");
  g = readAll(
    reduceGame(g, {
      type: "post",
      photos: ["group"],
      audience: "close",
      caption: "",
    }),
  );
  assert.equal(canFinishPhoto(g), false);
  const initial = reduceGame(g, { type: "finishPhoto" });
  assert.equal(currentPhotoRound(initial)?.outcome, "active");
  const issue = g.issues[0];
  g = reduceGame(g, { type: "reply", room: issue.friend, kind: "apology" });
  g = readAll(g);
  assert.equal(g.issues[0].resolved, false);
  g = readAll(reduceGame(g, { type: "deletePost", id: issue.post }));
  g = reduceGame(g, { type: "finishPhoto" });
  assert.equal(currentPhotoRound(g)?.outcome, "removed");
  assert.ok(g.issues.every((i) => i.resolved));
});

test("legacy multi-photo saves retain all records and use plural keeping text", () => {
  let g = start();
  g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "topic" }));
  g = reduceGame(g, {
    type: "sendPhotos",
    room: "group",
    photos: ["snack", "funny"],
  });
  g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "ask" }));
  assert.match(
    replyOptions(g, "group", "snack").find((o) => o.kind === "keepPhoto")!.text,
    /이 사진들은/,
  );
  g = reduceGame(g, {
    type: "post",
    photos: ["snack", "funny"],
    audience: "close",
    caption: "",
  });
  const old = JSON.parse(JSON.stringify(g));
  delete old.photoFlow;
  old.revision = 6;
  const restored = migrateGame(old);
  assert.deepEqual(restored.posts, g.posts);
  assert.deepEqual(restored.messages, JSON.parse(JSON.stringify(g.messages)));
  assert.deepEqual(restored.consents, g.consents);
  assert.equal(restored.photoFlow.current, null);
});

test("photo completion never grants consent or removes an unresolved issue", () => {
  let g = ask(start(), "group");
  g = readAll(
    reduceGame(g, {
      type: "post",
      photos: ["group"],
      audience: "close",
      caption: "",
    }),
  );
  const consents = structuredClone(g.consents);
  for (const issue of g.issues)
    g = readAll(
      reduceGame(g, { type: "reply", room: issue.friend, kind: "insist" }),
    );
  g = reduceGame(g, { type: "finishPhoto" });
  assert.equal(currentPhotoRound(g)?.outcome, "unresolved");
  assert.equal(g.issues[0].resolved, false);
  assert.deepEqual(g.consents, consents);
  g = reduceGame(g, { type: "nextPhoto" });
  assert.equal(g.issues[0].resolved, false);
});

function start(
  hero: Character = "maru",
  allows = true,
  scenario = { withdrawal: false, friend: "usagi" as Character },
) {
  let g = newGame(hero, allows, scenario);
  for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
  return g;
}
function episodeTwo(hero: Character = "maru") {
  let g = reduceGame(finish(ask(start(hero), "group")), {
    type: "nextEpisode",
  });
  for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
  return g;
}

test("selfie original reactions reflect its expressions without invented edits or outings", () => {
  let g = ask(episodeTwo(), "group", "EP02-P03");
  g = reduceGame(g, {
    type: "post",
    photos: ["EP02-P03"],
    audience: "public",
    caption: "",
  });
  assert.match(
    g.posts[0].comments.find((c) => c.friend === "chiikawa")!.text,
    /장난치다가 찍혔네/,
  );
  assert.match(
    g.posts[0].comments.find((c) => c.friend === "usagi")!.text,
    /다른 표정/,
  );
  assert.ok(
    g.posts[0].comments.every(
      (c) => !/가려|놀이기구|생일|체육대회/.test(c.text),
    ),
  );
});

test("all sixteen photos preserve contextual reactions across heroes, scopes and editing states", () => {
  for (const photo of photos)
    for (const hero of characters)
      for (const audience of ["close", "public"] as const)
        for (const edited of [false, true]) {
          let g = newGame(hero.id, true, {
            withdrawal: false,
            friend: "usagi",
          });
          g.episode = photo.episode!;
          for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
          let id = photo.id;
          if (edited) {
            g = reduceGame(g, {
              type: "saveVersion",
              photo: id,
              edits: photo.faces.map((f) => ({
                kind: "sticker",
                x: f.center.x,
                y: f.center.y,
                size: 0.5,
                symbol: "●",
              })),
            });
            id = g.versions[0].id;
          }
          g = ask(g, "group", id, audience);
          if (photo.id === "group" && edited && audience === "close") {
            const reply = g.messages.group.find(
              (m) => m.from === "hachiware" && m.purpose === "consent",
            );
            if (hero.id !== "hachiware") {
              assert.match(reply!.text!, /친한 친구들끼리/);
              assert.doesNotMatch(reply!.text!, /전체 공개로.*좋아/);
            }
          }
          assert.ok(
            g.consents.every(
              (c) =>
                c.friend !== hero.id &&
                photo.faces.some((f) => f.friend === c.friend),
            ),
          );
          g = reduceGame(g, {
            type: "post",
            photos: [id],
            audience,
            caption: "",
          });
          assert.ok(
            g.issues.every(
              (i) =>
                i.friend !== hero.id &&
                photo.faces.some((f) => f.friend === i.friend),
            ),
          );
          const text = [
            ...g.posts[0].comments.map((c) => c.text),
            ...g.pending.map((p) => p.text),
          ].join(" ");
          if (!edited)
            assert.doesNotMatch(
              text,
              /가려 줬네|얼굴 가린 사진으로 올렸네|얼굴이 안 보이네/,
            );
          assert.doesNotMatch(text, /내려 줘서 고마워|사진 내려갔네|내렸네/);
          assert.doesNotMatch(text, /· 원본|· 편집본/);
          if (photo.episode === "EP02")
            assert.doesNotMatch(text, /놀이기구|롯데월드|생일|체육대회/);
          if (!photo.faces.length) assert.equal(g.issues.length, 0);
        }
});

test("each later episode has four protagonist voices and Usagi speaks about his own birthday", () => {
  for (const episode of ["EP02", "EP03", "EP04"] as const)
    assert.equal(
      new Set(characters.map((c) => topicText(c.id, episode))).size,
      4,
    );
  const g = newGame("usagi");
  g.episode = "EP03";
  assert.equal(introLines(g)[0], "오늘은 내 생일이었어!");
  assert.match(topicText("usagi", "EP03"), /내 생일/);
});

test("questions keep photo labels in UI metadata instead of spoken dialogue", () => {
  let g = episodeTwo();
  g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "topic" }));
  g = reduceGame(g, {
    type: "sendPhotos",
    room: "group",
    photos: ["EP02-P01", "EP02-P03"],
  });
  const question = replyOptions(g, "group", "EP02-P01")[0].text;
  assert.doesNotMatch(question, /·|EP02|편집본|원본/);
  g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "ask" }));
  assert.ok(
    g.messages.group
      .filter((m) => m.purpose === "consent")
      .every((m) => m.photoId),
  );
});

test("removal acknowledgements and scope repair follow the actual post state", () => {
  let g = readAll(unauthorized());
  const issue = g.issues[0];
  assert.doesNotMatch(
    reactionLine(g, issue.friend, issue.photo, "removed"),
    /내려 줘서 고마워|내려갔네|내렸네/,
  );
  g = reduceGame(g, { type: "deletePost", id: issue.post });
  assert.ok(
    g.pending.some((p) => p.purpose === "followup" && /내려|내렸/.test(p.text)),
  );
  let scope = ask(start(), "hachiware", "group");
  scope = reduceGame(scope, {
    type: "post",
    photos: ["group"],
    audience: "public",
    caption: "",
  });
  scope = readAll(scope);
  scope = reduceGame(scope, {
    type: "audience",
    post: scope.posts[0].id,
    audience: "close",
  });
  assert.ok(
    scope.pending
      .filter((p) => p.from === "hachiware" && p.purpose === "followup")
      .every((p) => !/내려|내렸/.test(p.text)),
  );
});

test("later memories cite only actual earlier keeping or requested removal", () => {
  let kept = finish(ask(start(), "group"));
  kept = reduceGame(kept, { type: "nextEpisode" });
  assert.match(stageMemory(kept)!.text, /간직/);
  assert.doesNotMatch(stageMemory(kept)!.text, /게시|올렸|내려/);
  let repaired = readAll(unauthorized());
  const friend = repaired.issues[0].friend;
  repaired = reduceGame(repaired, {
    type: "deletePost",
    id: repaired.posts[0].id,
  });
  repaired = finish(readAll(repaired));
  repaired = reduceGame(repaired, { type: "nextEpisode" });
  assert.equal(stageMemory(repaired)!.friend, friend);
  assert.match(stageMemory(repaired)!.text, /사진 내려/);
  const noHistory = newGame("maru");
  noHistory.episode = "EP02";
  assert.equal(stageMemory(noHistory), null);
});

test("mid-episode completion retains outcomes and final summaries describe real choices", () => {
  let g = finish(ask(start(), "group"));
  assert.equal(g.stage, "stageComplete");
  assert.equal(g.ending, "good");
  g = reduceGame(g, { type: "nextEpisode" });
  assert.match(journeySummary(g)[0].text, /게시하지 않고 간직/);
  const old = {
    ...g,
    episode: "EP01" as const,
    stage: "ending" as const,
    ending: "recovery" as const,
    revision: 5,
  };
  const migrated = migrateGame(old as unknown as Game);
  assert.equal(migrated.stage, "stageComplete");
  assert.equal(migrated.ending, "recovery");
});

test("all four heroes complete four episodes with isolated saved histories", () => {
  for (const hero of characters) {
    let g = finish(ask(start(hero.id), "group"));
    const original = JSON.parse(JSON.stringify(g.messages));
    for (const id of ["EP02", "EP03", "EP04"]) {
      g = reduceGame(g, { type: "nextEpisode" });
      assert.equal(g.episode, id);
      assert.deepEqual(
        JSON.parse(JSON.stringify(g.episodes.EP01!.state.messages)),
        original,
      );
      assert.equal(Object.values(g.messages).flat().length, 0);
      assert.equal(g.posts.length, 0);
      for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
      g = ask(g, "group", episodePhotos(g)[0].id);
      assert.ok(g.pending.every((p) => p.from !== hero.id));
      g = reduceGame(g, { type: "decideNoPost" });
      assert.equal(storyGuide(g).ready, true);
      g = reduceGame(g, { type: "advance" });
      assert.equal(g.stage, id === "EP04" ? "ending" : "stageComplete");
      g = migrateGame(JSON.parse(JSON.stringify(g)));
    }
    assert.equal(Object.keys(g.episodes).length, 3);
    assert.equal(g.ending, "good");
  }
});

test("episode registries include only three originals and thirteen new assets", () => {
  assert.equal(new Set(photos.map((p) => p.id)).size, photos.length);
  assert.equal(photos.filter((p) => /^EP0[1-4]-P/.test(p.id)).length, 13);
  assert.deepEqual(
    ["EP01", "EP02", "EP03", "EP04"].map(
      (episode) =>
        episodePhotos({ episode: episode as Game["episode"] }).length,
    ),
    [6, 3, 3, 4],
  );
  assert.equal(photos.length, 16);
  assert.equal(new Set(photos.map((p) => p.file)).size, 16);
  assert.ok(!photos.some((p) => p.id.startsWith("castle-")));
});

test("retired photos retain save references while being blocked from new sharing", () => {
  let g = ask(start(), "group");
  g.versions.push({
    id: "old-edit",
    photo: "castle-group",
    edits: [],
    deleted: false,
    created: "",
  });
  g.editorDraft = {
    source: "old-edit",
    photo: "castle-group",
    edits: [],
    open: true,
  };
  g.chatTarget = { photo: "old-edit", audience: "close" };
  g = migrateGame(g);
  assert.equal(g.versions[0].photo, "castle-group");
  assert.equal(g.editorDraft?.open, false);
  assert.equal(g.chatTarget, null);
  assert.equal(photoById("castle-group").file, "");
  g = reduceGame(g, {
    type: "sendPhotos",
    room: "group",
    photos: ["castle-group", "old-edit"],
  });
  assert.ok(!g.messages.group.some((m) => m.photos?.includes("old-edit")));
  g = reduceGame(g, {
    type: "post",
    photos: ["old-edit"],
    audience: "public",
    caption: "",
  });
  assert.equal(g.posts.length, 0);
});

test("cross-episode originals cannot be attached or posted", () => {
  let g = episodeTwo();
  g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "topic" }));
  g = reduceGame(g, {
    type: "sendPhotos",
    room: "group",
    photos: ["group", "EP03-P01", "EP02-P03"],
  });
  assert.deepEqual(g.messages.group.at(-1)?.photos, ["EP02-P03"]);
  g = reduceGame(g, {
    type: "post",
    photos: ["group", "EP03-P01"],
    audience: "public",
    caption: "",
  });
  assert.equal(g.posts.length, 0);
});

test("portrait-strip protection checks every appearance of a friend", () => {
  const strip = photoById("EP02-P01");
  assert.equal(strip.faces.length, 16);
  const faces = strip.faces.filter((f) => f.friend === "chiikawa");
  const masks: Edit[] = faces.map((f) => ({
    kind: "sticker",
    x: f.center.x,
    y: f.center.y,
    size: 0.23,
    symbol: "●",
  }));
  assert.equal(protectsFriend(strip.id, "chiikawa", masks.slice(0, 1)), false);
  assert.equal(protectsFriend(strip.id, "chiikawa", masks), true);
  assert.equal(
    covered(
      { x: 0.5, y: 0.58 },
      [{ kind: "sticker", x: 0.5, y: 0.5, size: 0.2, symbol: "●" }],
      2336 / 1024,
    ),
    false,
  );
});

test("a playful selfie can be approved by all photographed friends without editing", () => {
  let g = ask(episodeTwo(), "group", "EP02-P03");
  assert.ok(g.consents.every((c) => c.condition === "yes"));
  g = reduceGame(g, {
    type: "post",
    photos: ["EP02-P03"],
    audience: "public",
    caption: "",
  });
  assert.equal(g.issues.length, 0);
  assert.equal(g.posts.length, 1);
});

test("new episodes permit direct posting of an unsent edited version and generate consequences", () => {
  let g = episodeTwo();
  g = reduceGame(g, {
    type: "saveVersion",
    photo: "EP02-P01",
    edits: [{ kind: "sticker", x: 0.1, y: 0.1, size: 0.1, symbol: "●" }],
  });
  const version = g.versions[0].id;
  g = reduceGame(g, {
    type: "post",
    photos: [version],
    caption: "",
    audience: "public",
  });
  assert.equal(g.posts.length, 1);
  assert.ok(g.issues.length > 0);
  assert.equal(g.messages.group.length, 0);
  g = readAll(g);
  assert.equal(g.story.opinionsSeen, true);
});
function readAll(g: Game): Game {
  while (g.pending.length) {
    const room = g.pending[0].room;
    g = reduceGame(g, { type: "navigate", screen: "chat", room });
    g = reduceGame(g, { type: "deliver", room });
  }
  return g;
}
function ask(
  g: Game,
  room: Character | "group",
  photo = "group",
  audience: "close" | "public" = "close",
) {
  if (!g.story.topicStarted)
    g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "topic" }));
  if (!g.story.firstContact && room !== "group") {
    g = reduceGame(g, { type: "navigate", screen: "chat", room: "group" });
    g = reduceGame(g, { type: "sendPhotos", room: "group", photos: ["snack"] });
    g = readAll(reduceGame(g, { type: "reply", room: "group", kind: "ask" }));
  }
  g = reduceGame(g, { type: "navigate", screen: "chat", room });
  g = reduceGame(g, { type: "sendPhotos", room, photos: [photo] });
  return readAll(
    reduceGame(g, { type: "reply", room, photo, audience, kind: "ask" }),
  );
}
const masks: Edit[] = photos[0].faces.map((f) => ({
  kind: "sticker",
  x: f.center.x,
  y: f.center.y,
  size: 0.3,
  symbol: "■",
}));

test("editing and preparing a message cannot approve an unsent version", () => {
  let g = ask(start(), "group");
  g = edited(g);
  const id = g.versions[0].id;
  const originalMessages = structuredClone(g.messages);
  g = reduceGame(g, { type: "prepareChat", room: "chiikawa", photo: id });
  assert.deepEqual(g.messages, originalMessages);
  g = reduceGame(g, {
    type: "reply",
    room: "chiikawa",
    kind: "ask",
    photo: id,
  });
  assert.equal(g.pending.length, 0);
  assert.equal(permission(g, "chiikawa", id, "close"), false);
  g = reduceGame(g, {
    type: "sendPhotos",
    room: "chiikawa",
    photos: [id, id, "missing-photo"],
  });
  assert.deepEqual(g.messages.chiikawa.at(-1)?.photos, [id]);
  assert.equal(g.posts.length, 0);
  assert.equal(permission(g, "chiikawa", id, "close"), false);
  g = readAll(reduceGame(g, { type: "reply", room: "chiikawa", kind: "ask" }));
  assert.equal(permission(g, "chiikawa", id, "close"), true);
});

test("food-only sharing creates a relevant reply without face consent", () => {
  const g = ask(start(), "group", "snack");
  assert.equal(g.consents.length, 0);
  assert.equal(g.story.opinionsSeen, true);
  assert.ok(g.messages.group.at(-1)?.text.includes("츄러스"));
  assert.ok(!g.messages.group.at(-1)?.text.includes("가려"));
});

test("a renewed group question preserves Hachiware active withdrawal", () => {
  let g = ask(start(), "group");
  g.issues.push({
    id: "withdrawal",
    post: "existing-post",
    photo: "group",
    friend: "hachiware",
    resolved: false,
    withdrawal: true,
    notified: true,
    read: true,
  });
  g = reduceGame(g, { type: "sendPhotos", room: "group", photos: ["group"] });
  g = reduceGame(g, { type: "reply", room: "group", kind: "ask" });
  const reply = g.pending.find((p) => p.from === "hachiware")!;
  assert.ok(reply.text.includes("먼저 내 부탁"));
  assert.ok(reply.consents?.every((c) => c.condition === "no"));
});
function edited(g: Game, photo: "group" | "funny" = "group", edits = masks) {
  return reduceGame(g, { type: "saveVersion", photo, edits });
}
function finish(g: Game, choice: "respect" | "rush" = "respect") {
  g = readAll(g);
  if (!g.story.firstContact) g = ask(g, "group");
  g = reduceGame(g, { type: "viewPhoto", photo: "group" });
  if (!g.posts.length) g = reduceGame(g, { type: "decideNoPost" });
  assert.equal(storyGuide(g).ready, true);
  g = reduceGame(g, { type: "advance" });
  assert.equal(g.stage, "special");
  g = reduceGame(g, { type: "special", choice });
  assert.equal(g.stage, "special");
  assert.ok(g.specialResult);
  return reduceGame(g, { type: "completeSpecial" });
}
function unauthorized(hero: Character = "maru") {
  let g = ask(start(hero), "usagi", "snack");
  g = reduceGame(g, { type: "viewPhoto", photo: "group" });
  return reduceGame(g, {
    type: "post",
    photos: ["group", "funny"],
    caption: "추억",
    audience: "close",
  });
}

test("every hero starts with four thoughts and zero incoming messages or notifications", () => {
  for (const c of characters) {
    let g = newGame(c.id);
    assert.equal(g.stage, "intro");
    assert.equal(introductions[c.id].length, 4);
    assert.equal(Object.values(g.messages).flat().length, 0);
    assert.equal(g.notices.length, 0);
    g = reduceGame(g, { type: "advance" });
    assert.equal(g.stage, "intro");
    for (let i = 0; i < 4; i++) g = reduceGame(g, { type: "introNext" });
    assert.equal(g.stage, "play");
    assert.equal(g.story.phase, "first_contact");
    assert.equal(g.messages.group.length, 0);
  }
});
test("photo attachments and the question are separate explicit actions", () => {
  for (const c of characters) {
    let g = start(c.id);
    assert.equal(replyOptions(g, "group", "group")[0].kind, "topic");
    g = reduceGame(g, {
      type: "reply",
      room: "group",
      kind: "ask",
      photo: "group",
    });
    assert.equal(g.messages.group.length, 0);
    g = reduceGame(g, { type: "reply", room: "group", kind: "topic" });
    assert.equal(g.pending.length, 1);
    assert.equal(g.pending[0].purpose, "photo_question");
    g = readAll(g);
    assert.equal(g.consents.length, 0);
    g = reduceGame(g, {
      type: "sendPhotos",
      room: "group",
      photos: ["group", "snack"],
    });
    assert.deepEqual(g.messages.group.at(-1)?.photos, ["group", "snack"]);
    assert.equal(g.pending.length, 0);
    const option = replyOptions(g, "group", "group")[0];
    g = reduceGame(g, { type: "reply", room: "group", kind: "ask" });
    assert.equal(g.messages.group.at(-1)?.text, option.text);
    assert.equal(g.pending.length, 4);
    g = readAll(g);
    assert.equal(g.consents.length, 6);
    assert.equal(g.story.opinionsSeen, true);
  }
});
test("intro position can be restored and moved back", () => {
  let g = newGame("chiikawa");
  g = reduceGame(g, { type: "introNext" });
  g = migrateGame(JSON.parse(JSON.stringify(g)));
  assert.equal(g.story.introLine, 1);
  g = reduceGame(g, { type: "introBack" });
  assert.equal(g.story.introLine, 0);
});
test("conditional consent requires the covered version to be shown again", () => {
  let g = ask(start(), "chiikawa");
  g = edited(g);
  const id = g.versions[0].id;
  assert.equal(permission(g, "chiikawa", id, "close"), false);
  assert.equal(conversationState(g, "chiikawa", id, "close"), "reask_ready");
  g = ask(g, "chiikawa", id);
  assert.equal(permission(g, "chiikawa", id, "close"), true);
  assert.equal(permission(g, "chiikawa", "group", "close"), false);
  assert.equal(permission(g, "chiikawa", id, "public"), true);
});
test("Maru initially refuses and keeps either seeded retry outcome across saves", () => {
  for (const allows of [true, false]) {
    let g = ask(start("chiikawa", allows), "maru");
    assert.equal(g.consents[0].condition, "no");
    g = edited(g);
    const id = g.versions[0].id;
    assert.equal(permission(g, "maru", id, "close"), false);
    g = ask(g, "maru", id);
    assert.equal(permission(g, "maru", id, "close"), allows);
    g = migrateGame(JSON.parse(JSON.stringify(g)));
    assert.equal(g.maruAllows, allows);
    assert.equal(permission(g, "maru", id, "close"), allows);
  }
});
test("Hachiware distinguishes close friends from public posting", () => {
  let g = ask(start(), "hachiware");
  assert.equal(permission(g, "hachiware", "group", "close"), true);
  g = ask(g, "hachiware", "group", "public");
  assert.equal(permission(g, "hachiware", "group", "public"), false);
  g = edited(g);
  g = ask(g, "hachiware", g.versions[0].id, "public");
  assert.equal(permission(g, "hachiware", g.versions[0].id, "public"), true);
});
test("Usagi group consent does not grant funny-photo consent", () => {
  let g = ask(start(), "usagi");
  assert.equal(permission(g, "usagi", "group", "close"), true);
  assert.equal(permission(g, "usagi", "funny", "close"), false);
  g = ask(g, "usagi", "funny");
  assert.equal(g.consents.find((c) => c.photo === "funny")?.condition, "no");
});
test("keeping one photo in group chat does not decide the entire episode", () => {
  let g = ask(start(), "group");
  g = reduceGame(g, {
    type: "reply",
    room: "group",
    kind: "keepPhoto",
    photo: "group",
    audience: "close",
  });
  g = readAll(g);
  assert.equal(g.story.photoChoices.group, "keep");
  assert.equal(g.story.decision, "share");
  assert.equal(g.skipped, false);
  assert.equal(storyGuide(g).ready, undefined);
  g = reduceGame(g, { type: "viewPhoto", photo: "snack" });
  g = reduceGame(g, { type: "decideNoPost" });
  assert.equal(finish(g).ending, "good");
});
test("completion requires an initial request, opinions, a viewed photo and a real decision", () => {
  let g = start();
  g = reduceGame(g, { type: "advance" });
  assert.equal(g.room, "group");
  g = reduceGame(g, { type: "completeSpecial" });
  assert.equal(g.ending, null);
  g = ask(g, "group");
  g = reduceGame(g, { type: "advance" });
  assert.equal(g.screen, "album");
  g = reduceGame(g, { type: "viewPhoto", photo: "snack" });
  assert.equal(storyGuide(g).ready, undefined);
  g = reduceGame(g, { type: "decideNoPost" });
  assert.equal(storyGuide(g).ready, true);
});
test("all heroes can complete without publication", () => {
  for (const c of characters) {
    const g = finish(ask(start(c.id), "group"));
    assert.equal(g.ending, "good");
    assert.equal(g.posts.length, 0);
  }
});
test("a final alternate choice alone never forces an unresolved ending", () => {
  for (const c of characters)
    assert.equal(finish(ask(start(c.id), "group"), "rush").ending, "good");
});
test("unasked and refused conversations do not offer an unsupported apology", () => {
  let g = start("chiikawa");
  assert.deepEqual(
    replyOptions(g, "maru", "group", "close").map((o) => o.kind),
    [],
  );
  g = ask(g, "maru");
  assert.ok(
    !replyOptions(g, "maru", "group", "close").some(
      (o) => o.kind === "apology" || o.kind === "insist",
    ),
  );
});
test("apology alone leaves the posted-photo request unresolved", () => {
  let g = readAll(unauthorized());
  g = reduceGame(g, {
    type: "reply",
    room: "chiikawa",
    kind: "apology",
    photo: "group",
    audience: "close",
  });
  g = readAll(g);
  assert.ok(g.issues.some((i) => !i.resolved));
  assert.equal(storyGuide(g).screen, "sns");
});
test("actual removal sends followups and permits relationship recovery", () => {
  let g = readAll(unauthorized());
  g = reduceGame(g, {
    type: "reply",
    room: "chiikawa",
    kind: "apology",
    photo: "group",
    audience: "close",
  });
  g = readAll(g);
  g = reduceGame(g, { type: "deletePost", id: g.posts[0].id });
  assert.ok(g.pending.some((p) => p.purpose === "followup"));
  g = readAll(g);
  assert.equal(finish(g).ending, "recovery");
});
test("multiple requests from the same friend can all be answered before an unresolved ending", () => {
  let g = readAll(unauthorized());
  const count = g.issues.length;
  for (let i = 0; i < count; i++) {
    const issue = g.issues.find((i) => !i.decision)!;
    g = reduceGame(g, {
      type: "reply",
      room: issue.friend,
      kind: "insist",
      photo: issue.photo,
      audience: "close",
    });
    g = readAll(g);
  }
  assert.ok(g.issues.every((i) => i.decision === "keep"));
  assert.equal(finish(g).ending, "unresolved");
});
test("repair remains possible after several refusals to remove a photo", () => {
  let g = readAll(unauthorized());
  const count = g.issues.length;
  for (let i = 0; i < count; i++) {
    const issue = g.issues.find((i) => !i.decision)!;
    g = readAll(
      reduceGame(g, {
        type: "reply",
        room: issue.friend,
        kind: "insist",
        photo: issue.photo,
        audience: "close",
      }),
    );
  }
  g = readAll(reduceGame(g, { type: "deletePost", id: g.posts[0].id }));
  assert.equal(finish(g).ending, "recovery");
});
test("withdrawal is optional, public-only and triggered by reading the relevant reaction", () => {
  for (const enabled of [false, true]) {
    let g = start("chiikawa", true, { withdrawal: enabled, friend: "usagi" });
    g = edited(g, "funny", [
      { kind: "sticker", x: 0.563, y: 0.641, size: 0.4, symbol: "■" },
    ]);
    const id = g.versions[0].id;
    g = ask(g, "usagi", id, "public");
    g = reduceGame(g, { type: "viewPhoto", photo: "funny" });
    g = reduceGame(g, {
      type: "post",
      photos: [id],
      caption: "추억",
      audience: "public",
    });
    assert.equal(g.issues.length, 0);
    g = readAll(g);
    assert.equal(
      g.issues.some((i) => i.withdrawal),
      enabled,
    );
    if (enabled) {
      assert.equal(g.issues[0].friend, "usagi");
      g = readAll(reduceGame(g, { type: "deletePost", id: g.posts[0].id }));
      assert.equal(finish(g).ending, "recovery");
    } else assert.equal(finish(g).ending, "good");
  }
});
test("scope changes reopen a previously repaired request", () => {
  let g = ask(start("usagi"), "hachiware");
  g = edited(g);
  const id = g.versions[0].id;
  g = reduceGame(g, {
    type: "post",
    photos: [id],
    caption: "추억",
    audience: "public",
  });
  g = readAll(
    reduceGame(g, { type: "audience", post: g.posts[0].id, audience: "close" }),
  );
  assert.equal(g.issues.find((i) => i.friend === "hachiware")?.resolved, true);
  g = reduceGame(g, {
    type: "audience",
    post: g.posts[0].id,
    audience: "public",
  });
  assert.equal(g.issues.find((i) => i.friend === "hachiware")?.resolved, false);
});
test("versions remain linked to originals and deleted versions retain their edits", () => {
  let g = edited(start());
  const original = structuredClone(g.versions[0]);
  g = edited(g);
  g = reduceGame(g, { type: "deleteVersion", id: original.id });
  assert.equal(g.versions.length, 2);
  assert.deepEqual(g.versions[0].edits, original.edits);
  assert.equal(g.versions[0].deleted, true);
  assert.equal(g.versions[0].photo, "group");
});
test("legacy migration preserves messages, posts, versions, consent, probability and ending", () => {
  let g = ask(start("chiikawa", false), "maru");
  g = edited(g);
  g = reduceGame(g, {
    type: "post",
    photos: ["snack"],
    caption: "추억",
    audience: "close",
  });
  g = finish(g);
  const old = structuredClone(g) as unknown as Record<string, unknown>;
  old.revision = 2;
  delete old.events;
  delete old.withdrawalPlan;
  delete old.specialResult;
  const migrated = migrateGame(old as unknown as Game);
  assert.deepEqual(migrated.messages, g.messages);
  assert.deepEqual(migrated.posts, g.posts);
  assert.deepEqual(migrated.versions, g.versions);
  assert.deepEqual(migrated.consents, g.consents);
  assert.equal(migrated.maruAllows, false);
  assert.equal(migrated.ending, g.ending);
  assert.equal(migrated.stage, "stageComplete");
  assert.deepEqual(migrateGame(migrated), migrated);
});
test("geometry rejects tiny marks and covering a different friend", () => {
  for (const face of photoById("group").faces) {
    assert.equal(protection(face, []).safe, false);
    assert.equal(
      protection(face, [
        { kind: "sticker", symbol: "■", x: 0.5, y: 0.1, size: 0.2 },
      ]).safe,
      false,
    );
    assert.equal(
      protection(face, [
        {
          kind: "sticker",
          symbol: "■",
          x: face.center.x,
          y: face.center.y,
          size: 0.3,
        },
      ]).safe,
      true,
    );
    assert.equal(
      protection(face, [
        {
          kind: "sticker",
          symbol: "■",
          x: face.center.x,
          y: face.center.y,
          size: 0.03,
        },
      ]).safe,
      false,
    );
  }
  assert.equal(
    protection(photoById("funny").faces[0], [
      { kind: "sticker", symbol: "■", x: 0.563, y: 0.641, size: 0.4 },
    ]).safe,
    true,
  );
});
test("brush distance matches the image 4:3 coordinates", () => {
  const edit: Edit = {
    kind: "brush",
    size: 0.1,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
    ],
  };
  assert.equal(covered({ x: 0.3, y: 0.16 }, [edit]), true);
  assert.equal(covered({ x: 0.3, y: 0.18 }, [edit]), false);
  assert.equal(covered({ x: 0.551, y: 0.1 }, [edit]), false);
});
test("an exposed facial feature fails even when more than ninety percent is covered", () => {
  const face = photoById("group").faces[0],
    eye = face.features[0],
    edits: Edit[] = [];
  for (
    let x = face.center.x - face.rx - 0.02;
    x <= face.center.x + face.rx + 0.02;
    x += 0.01
  )
    for (
      let y = face.center.y - face.ry - 0.02;
      y <= face.center.y + face.ry + 0.02;
      y += 0.013
    ) {
      if (Math.hypot(x - eye.x, (y - eye.y) * 0.75) > 0.028)
        edits.push({ kind: "brush", size: 0.02, points: [{ x, y }] });
    }
  const result = protection(face, edits);
  assert.ok(result.ratio > 0.9);
  assert.equal(result.featuresHidden, false);
  assert.equal(result.safe, false);
  assert.equal(
    protection(face, [
      { kind: "sticker", symbol: "■", size: 0.3, x: 0.832, y: 0.68 },
    ]).safe,
    false,
  );
});
test("structured scrapbook events retain posted and removed photo IDs", () => {
  let g = ask(start(), "group");
  g = reduceGame(g, {
    type: "post",
    photos: ["snack"],
    caption: "추억",
    audience: "close",
  });
  const post = g.posts[0].id;
  g = reduceGame(g, { type: "audience", post, audience: "public" });
  g = reduceGame(g, { type: "removePhoto", post, photo: "snack" });
  assert.deepEqual(g.events.filter((e) => e.type === "post")[0].photos, [
    "snack",
  ]);
  assert.equal(
    g.events.filter((e) => e.type === "scope")[0].audience,
    "public",
  );
  assert.deepEqual(
    g.events.filter((e) => e.type === "remove-photo")[0].photos,
    ["snack"],
  );
  assert.deepEqual(g.posts[0].originalPhotos, ["snack"]);
});

test("a queued group reply cannot restore consent after a newer withdrawal", () => {
  let g = start("chiikawa", true, { withdrawal: true, friend: "usagi" });
  g = edited(g, "funny", [
    { kind: "sticker", symbol: "■", x: 0.563, y: 0.641, size: 0.4 },
  ]);
  const id = g.versions[0].id;
  g = ask(g, "usagi", id, "public");
  g = reduceGame(g, {
    type: "post",
    photos: [id],
    caption: "추억",
    audience: "public",
  });
  g = reduceGame(g, {
    type: "reply",
    room: "group",
    kind: "ask",
    photo: id,
    audience: "public",
  });
  g = readAll(g);
  assert.ok(g.issues.some((i) => i.withdrawal));
  assert.equal(permission(g, "usagi", id, "public"), false);
});
