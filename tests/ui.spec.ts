import { test, expect, type Page } from "@playwright/test";
import { newGame, reduceGame, SAVE_KEY, permission } from "../src/engine";
import { episodePhotos, photoById } from "../src/data";
import { protection, protectsFriend } from "../src/protection";
import type { EpisodeId, Game } from "../src/model";
import { mkdirSync } from "node:fs";
mkdirSync("qa/photo16/screenshots", { recursive: true });
mkdirSync("qa/focus/screenshots", { recursive: true });
mkdirSync("qa/final-polish/screenshots", { recursive: true });

const stored = (page: Page): Promise<Game> => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);

test("supplied BGM starts on interaction, loops, and independent sound settings survive reload", async ({ page }) => {
  await page.goto("/");
  const bgm = page.locator("audio[data-game-bgm]");
  expect(await bgm.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.getByRole("button", { name: "이야기 시작하기", exact: true }).click();
  await expect.poll(() => bgm.evaluate((a: HTMLAudioElement) => !a.paused && a.currentTime > 0)).toBe(true);
  expect(await bgm.evaluate((a: HTMLAudioElement) => a.loop && a.volume === 0.18 && a.duration > 0)).toBe(true);
  const save = await stored(page);
  await page.getByRole("button", { name: "소리 설정", exact: true }).click();
  await page.getByRole("button", { name: "배경음악 끄기", exact: true }).click();
  await expect.poll(() => bgm.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await expect(page.getByRole("button", { name: "효과음 끄기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "효과음 끄기", exact: true }).click();
  expect(await stored(page)).toEqual(save);
  await page.reload();
  await page.getByRole("button", { name: "이야기 이어하기", exact: true }).click();
  expect(await bgm.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  await page.getByRole("button", { name: "소리 설정", exact: true }).click();
  await expect(page.getByRole("button", { name: "효과음 켜기", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "배경음악 켜기", exact: true }).click();
  await expect.poll(() => bgm.evaluate((a: HTMLAudioElement) => !a.paused)).toBe(true);
});

test("sound controls fit a 320px screen and remain available inside fullscreen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await resume(page, episodeSeed());
  await page.getByRole("button", { name: "소리 설정", exact: true }).click();
  const panel = page.locator(".audio-settings-panel");
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "플레이 화면 크게 보기", exact: true }).click();
  await page.getByRole("button", { name: "소리 설정", exact: true }).click();
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => !document.fullscreenElement || document.fullscreenElement.contains(document.querySelector(".audio-settings-panel")))).toBe(true);
  await page.getByRole("button", { name: "배경음악 끄기", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "기본 화면으로 돌아가기", exact: true })).toBeVisible();
});

test("effects play once per action and the effects switch immediately silences future actions", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as typeof window & { toneCount: number };
    w.toneCount = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { w.toneCount++; return original.call(this); };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "이야기 시작하기", exact: true }).click();
  await page.locator(".intro-actions .primary").click();
  const count = () => page.evaluate(() => (window as typeof window & { toneCount: number }).toneCount);
  await expect.poll(count).toBe(1);
  await page.getByRole("button", { name: "소리 설정", exact: true }).click();
  await page.getByRole("button", { name: "효과음 끄기", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator(".intro-actions .primary").click();
  expect(await count()).toBe(1);
  await page.getByRole("button", { name: "소리 설정", exact: true }).click();
  await page.getByRole("button", { name: "효과음 켜기", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator(".intro-actions .primary").click();
  await expect.poll(count).toBe(2);
});

test("sending, receiving and saving use short distinct sounds without sounding on brush movement", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as typeof window & { toneCount: number };
    w.toneCount = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { w.toneCount++; return original.call(this); };
  });
  const seed = episodeSeed();
  seed.speed = 60000;
  await resume(page, seed);
  const count = () => page.evaluate(() => (window as typeof window & { toneCount: number }).toneCount);
  await choose(page, "group");
  await expect.poll(count).toBe(1);
  await page.getByRole("button", { name: "친구들에게 사진 보내기", exact: true }).click();
  await expect.poll(count).toBe(3);
  await replies(page);
  await expect.poll(count).toBe(5);
  await page.getByRole("button", { name: "이 사진 편집하기", exact: true }).click();
  await coverGroup(page);
  expect(await count()).toBe(5);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(count).toBe(8);
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기", exact: true }).click();
  await expect.poll(count).toBe(10);
});
const canvas = (page: Page) => page.getByRole("img", { name: "사진 위에 모자이크 칠하기 또는 스티커 이동", exact: true });

function preparedPreview(game: Game, include: string[]) {
  for (const photo of episodePhotos(game)) {
    game = reduceGame(game, { type: "reviewSelect", photo: photo.id });
    game = reduceGame(reduceGame(game, { type: "reviewSend" }), { type: "reviewReplies" });
    game = reduceGame(reduceGame(game, { type: "reviewAsk" }), { type: "reviewReplies" });
    game = reduceGame(reduceGame(game, { type: "reviewDecide", decision: include.includes(photo.id) ? "include" : "keep" }), { type: "reviewReplies" });
    game = reduceGame(game, { type: "reviewContinue" });
  }
  return game;
}

function episodeSeed(episode: EpisodeId = "EP01") {
  let game = reduceGame(newGame("maru"), { type: "reviewStart" });
  while (game.episode !== episode) {
    for (let i = 0; i < 4; i++) game = reduceGame(game, { type: "introNext" });
    game = preparedPreview(game, []);
    game = reduceGame(reduceGame(game, { type: "reviewFinish" }), { type: "reviewNext" });
  }
  for (let i = 0; i < 4; i++) game = reduceGame(game, { type: "introNext" });
  game = reduceGame(game, { type: "reviewAudience", audience: "close" });
  return game;
}

async function resume(page: Page, seed: object) {
  await page.addInitScript(({ key, seed }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed));
  }, { key: SAVE_KEY, seed });
  await page.goto("/");
  await page.getByRole("button", { name: "이야기 이어하기", exact: true }).click();
}
async function intro(page: Page) {
  for (let i = 0; i < 4; i++) await page.locator(".intro-actions .primary").click();
  const scope = page.getByRole("button", { name: "친한 친구 공개로 시작", exact: true });
  if (await scope.isVisible()) await scope.click();
}
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "이야기 시작하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "마루의 생각" })).toBeVisible();
  await intro(page);
}
async function replies(page: Page) {
  const skip = page.getByRole("button", { name: /답장이 오고 있어요/ }).first();
  if (await skip.isVisible()) await skip.click();
  await expect.poll(async () => (await stored(page)).pending.length).toBe(0);
}
async function choose(page: Page, photo: string) {
  await page.getByRole("button", { name: `${photoById(photo).title} 살펴보기`, exact: true }).click();
}
async function ask(page: Page) {
  await page.getByRole("button", { name: "친구들에게 사진 보내기", exact: true }).click();
  await replies(page);
  const question = page.getByRole("button", { name: "SNS에 올려도 되는지 묻기", exact: true });
  if (await question.isVisible()) await question.click();
  await replies(page);
}
async function decide(page: Page, include: boolean) {
  await page.getByRole("button", { name: include ? "SNS 게시 목록에 넣기" : "게시하지 않고 보관하기", exact: true }).click();
  await replies(page);
  await page.getByRole("button", { name: /^(다음 사진 보기|게시 목록 보기)$/ }).click();
}
async function reviewAll(page: Page, include: boolean) {
  for (const photo of episodePhotos(await stored(page))) {
    if ((await stored(page)).review.photos[photo.id]?.decision) continue;
    await choose(page, photo.id); await ask(page); await decide(page, include);
    expect((await stored(page)).posts).toHaveLength(0);
  }
}
async function publish(page: Page) {
  await page.getByRole("button", { name: /한 번에 게시하기$/ }).click(); await replies(page);
}
async function coverGroup(page: Page) {
  await page.getByRole("button", { name: "크게", exact: true }).click();
  const box = (await canvas(page).boundingBox())!;
  for (const y of [.65, .75]) {
    await page.mouse.move(box.x + box.width * .06, box.y + box.height * y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .22, box.y + box.height * y, { steps: 12 });
    await page.mouse.up();
  }
}

test("Maru starts immediately and six photos are available", async ({ page }) => {
  await start(page);
  expect((await stored(page)).hero).toBe("maru");
  await expect(page.locator(".character-card")).toHaveCount(0);
  await expect(page.locator(".review-photo-grid > button")).toHaveCount(6);
  await expect(page.getByLabel("사진 검토 진행")).toContainText("0 / 6");
});

test("caption drafts survive reload and kept scope photos do not request another review", async ({ page }) => {
  await resume(page, preparedPreview(episodeSeed(), ["snack"]));
  await page.getByLabel("함께 남길 말").fill("다 같이 웃었던 날!");
  await expect.poll(async () => (await stored(page)).review.caption).toBe("다 같이 웃었던 날!");
  await page.getByLabel("게시물 공개 범위").selectOption("public");
  await expect(page.getByLabel("공개 범위 변경으로 달라진 조건")).toHaveCount(0);
  await expect(page.getByRole("status")).not.toContainText(photoById("EP01-P05").title);
  await page.reload();
  await page.getByRole("button", { name: "이야기 이어하기", exact: true }).click();
  await expect(page.getByLabel("함께 남길 말")).toHaveValue("다 같이 웃었던 날!");
  await expect(page.getByLabel("공개 범위 변경으로 달라진 조건")).toHaveCount(0);
});

test("small-screen choice navigation and an approving friend's question use the right context", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("button", { name: "아래 선택지 보기", exact: true })).toBeVisible();
  await page.screenshot({ path: "qa/final-polish/screenshots/choices-320.png", fullPage: true });
  await page.getByRole("button", { name: "아래 선택지 보기", exact: true }).click();
  await expect(page.getByRole("button", { name: "SNS 게시 목록에 넣기", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "친구에게 더 이야기하기", exact: true }).click();
  await page.getByRole("button", { name: "하치와레에게 이유 묻기", exact: true }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("하치와레, 이 사진은 어떤 점이 마음에 들어?");
  expect((await stored(page)).posts).toHaveLength(0);
});

test("playful selfie opinions have distinct voices without repeating the first impression", async ({ page }) => {
  await resume(page, episodeSeed("EP02")); await choose(page, "EP02-P03"); await ask(page);
  await expect(page.getByRole("log")).toContainText("으음… 이 표정은 좀 부끄러워. 이 사진은 우리끼리 간직할래.");
  await expect(page.getByRole("log")).toContainText("난 이 표정 마음에 들어! 올려도 좋아!");
  await expect(page.getByRole("log")).toContainText("야하! 내 표정 봐! 난 좋아!");
  const messages = (await stored(page)).messages.group;
  expect(messages.filter((m) => m.from === "chiikawa" && m.text.includes("장난치다가 찍혔네"))).toHaveLength(1);
  await page.screenshot({ path: "qa/final-polish/screenshots/character-voices.png", fullPage: true });
});

test("native fullscreen enlarges play, preserves progress and keeps the editor working", async ({ page }) => {
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  const initial = await stored(page);
  await page.getByRole("button", { name: "플레이 화면 크게 보기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("play-focus"))).toBe(true);
  await expect(page.locator(".review-message p").last()).toHaveCSS("font-size", "19px");
  expect(await stored(page)).toEqual(initial);
  await expect.poll(() => page.getByRole("log").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(3);
  await page.screenshot({ path: "qa/focus/screenshots/desktop-fullscreen.png", fullPage: true });
  await page.getByRole("button", { name: "이 사진 편집하기", exact: true }).click();
  await coverGroup(page);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기", exact: true }).click(); await replies(page);
  const version = (await stored(page)).versions.at(-1)!;
  expect(permission(await stored(page), "chiikawa", version.id, "close")).toBe(true);
  await page.getByRole("button", { name: "기본 화면으로 돌아가기", exact: true }).click();
  await expect(page.locator(".play-focus")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.locator(".review-message p").last()).toHaveCSS("font-size", "17px");
  expect((await stored(page)).versions.at(-1)!.id).toBe(version.id);
  await page.getByRole("button", { name: "플레이 화면 크게 보기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("play-focus"))).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator(".play-focus")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.classList.contains("game-focus-open"))).toBe(false);
});

for (const width of [320, 390]) test(`focus fallback gives larger readable chat and an accessible exit at ${width}px`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => { Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: undefined }); });
  const page = await context.newPage();
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  const initial = await stored(page);
  const originalHeight = (await page.getByRole("log").boundingBox())!.height;
  await page.getByRole("button", { name: "플레이 화면 크게 보기", exact: true }).tap();
  await expect(page.locator(".play-focus")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("게임 화면을 크게 펼쳤어요");
  const log = page.getByRole("log");
  expect((await log.boundingBox())!.height).toBeGreaterThan(originalHeight);
  await expect(log.locator("p").last()).toHaveCSS("font-size", "19px");
  expect(await page.locator(".play-focus").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await stored(page)).toEqual(initial);
  await page.screenshot({ path: `qa/focus/screenshots/mobile-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "사진 펼쳐서 확인하기", exact: true }).tap();
  await expect(page.getByLabel("현재 사진에 대한 친구 의견")).toBeVisible();
  await page.getByRole("button", { name: "사진 접고 대화 넓게 보기", exact: true }).tap();
  await page.getByRole("button", { name: "기본 화면으로 돌아가기", exact: true }).tap();
  await expect(page.locator(".play-focus")).toHaveCount(0);
  expect(await stored(page)).toEqual(initial);
  await context.close();
});

test("fullscreen rejection still opens focus and Escape restores normal play", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new DOMException("Blocked", "NotAllowedError"));
  });
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  const initial = await stored(page);
  await page.getByRole("button", { name: "플레이 화면 크게 보기", exact: true }).click();
  await expect(page.locator(".play-focus")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("크게 펼쳤어요");
  await page.keyboard.press("Escape");
  await expect(page.locator(".play-focus")).toHaveCount(0);
  expect(await stored(page)).toEqual(initial);
  expect(await page.evaluate(() => document.body.classList.contains("game-focus-open"))).toBe(false);
});

test("save failures remain visible inside native fullscreen", async ({ page }) => {
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  await page.getByRole("button", { name: "플레이 화면 크게 보기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
  await page.getByRole("button", { name: "게시하지 않고 보관하기", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("저장할 공간이 부족");
  expect(await page.getByRole("alert").evaluate((el) => document.fullscreenElement?.contains(el))).toBe(true);
});

for (const [episode, photo, friend] of [["EP02", "EP02-P02", "hachiware"], ["EP03", "EP03-P02", "usagi"]] as const)
  test(`${episode} scope change names only the affected photo and unsafe publication remains possible`, async ({ page }) => {
    await resume(page, preparedPreview(episodeSeed(episode), [photo]));
    expect(permission(await stored(page), friend, photo, "close")).toBe(true);
    await page.getByLabel("게시물 공개 범위").selectOption("public");
    await expect(page.getByLabel("공개 범위 변경으로 달라진 조건")).toContainText(photoById(photo).title);
    expect((await stored(page)).review.changedScopePhotos).toEqual([photo]);
    expect(permission(await stored(page), friend, photo, "public")).toBe(false);
    await page.screenshot({ path: `qa/photo16/screenshots/${episode}-scope-change.png`, fullPage: true });
    await page.getByRole("button", { name: "이 사진의 조건 확인하기" }).click();
    await page.getByRole("button", { name: "바뀐 공개 범위로 다시 묻기" }).click(); await replies(page);
    await expect(page.getByRole("log")).toContainText(friend === "usagi" ? "모르는 사람도 봐?" : "전체 공개구나!");
    await page.getByRole("button", { name: "게시 목록 보기", exact: true }).click();
    await publish(page);
    expect((await stored(page)).posts[0].audience).toBe("public");
    expect((await stored(page)).issues.some((i) => i.photo === photo && i.friend === friend)).toBe(true);
  });

for (const width of [320, 390]) test(`chat-focused layout expands the real photo and preserves history at ${width}px`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  const log = page.getByRole("log");
  const collapsed = (await page.locator(".review-main-photo").boundingBox())!.height;
  expect((await log.boundingBox())!.height).toBeGreaterThanOrEqual(215);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `qa/photo16/screenshots/chat-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "사진 펼쳐서 확인하기" }).tap();
  expect((await page.locator(".review-main-photo").boundingBox())!.height).toBeGreaterThan(collapsed * 2);
  await expect(page.getByLabel("현재 사진에 대한 친구 의견")).toBeVisible();
  await page.screenshot({ path: `qa/photo16/screenshots/photo-${width}.png`, fullPage: true });
  await page.getByRole("button", { name: "사진 접고 대화 넓게 보기" }).tap();
  const labelCount = await log.locator(".message-photo-label").count();
  expect(labelCount).toBe(1);
  await log.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
  await page.getByRole("button", { name: "친구에게 더 이야기하기" }).tap();
  await page.getByRole("button", { name: "치이카와에게 이유 묻기" }).tap(); await replies(page);
  expect(await log.evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "새 답장 보기" }).tap();
  expect(await log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(3);
  await context.close();
});

test("two real faces can be covered with mouse strokes and exact resend", async ({ page }) => {
  await resume(page, episodeSeed()); await choose(page, "EP01-P04"); await ask(page);
  await page.getByRole("button", { name: "이 사진 편집하기" }).click();
  await expect(page.locator(".editor-request")).toContainText("치이카와");
  await expect(page.locator(".editor-request")).toContainText("하치와레");
  await page.getByRole("button", { name: "크게", exact: true }).click();
  const box = (await canvas(page).boundingBox())!;
  for (const face of photoById("EP01-P04").faces.filter((f) => f.friend !== "maru")) {
    for (const dy of [-.05, .05]) {
      await page.mouse.move(box.x + box.width * (face.center.x - face.rx), box.y + box.height * (face.center.y + dy));
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * (face.center.x + face.rx), box.y + box.height * (face.center.y + dy), { steps: 12 });
      await page.mouse.up();
    }
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const version = (await stored(page)).versions.at(-1)!;
  expect(protectsFriend(version.photo, "chiikawa", version.edits)).toBe(true);
  expect(protectsFriend(version.photo, "hachiware", version.edits)).toBe(true);
  expect(permission(await stored(page), "hachiware", version.id, "close")).toBe(false);
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  expect(permission(await stored(page), "hachiware", version.id, "close")).toBe(true);
  await page.screenshot({ path: "qa/photo16/screenshots/two-faces-confirmed.png", fullPage: true });
});

test("touch mosaic taps edit the actual photo and saving still requires a resend", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  await page.getByRole("button", { name: "이 사진 편집하기" }).tap();
  await page.getByRole("button", { name: "크게", exact: true }).tap();
  await canvas(page).scrollIntoViewIfNeeded();
  const box = (await canvas(page).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  for (const y of [.65, .75]) {
    for (const x of [.06, .14, .22]) await canvas(page).tap({ position: { x: box.width * x, y: box.height * y } });
  }
  await expect.poll(async () => (await stored(page)).editorDraft?.edits.length ?? 0).toBeGreaterThan(0);
  await page.getByRole("button", { name: "저장", exact: true }).tap();
  await expect.poll(async () => (await stored(page)).versions.length).toBe(1);
  const version = (await stored(page)).versions.at(-1)!;
  expect(protectsFriend(version.photo, "chiikawa", version.edits)).toBe(true);
  expect(permission(await stored(page), "chiikawa", version.id, "close")).toBe(false);
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).tap(); await replies(page);
  await expect.poll(async () => permission(await stored(page), "chiikawa", version.id, "close")).toBe(true);
  await page.screenshot({ path: "qa/photo16/screenshots/touch-edit-confirmed.png", fullPage: true });
  await context.close();
});

test("public route reviews all sixteen loaded photos, repairs actual posts and reaches recovery ending", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await start(page);
  // Use the same scope control students see at the start of each later meeting.
  for (let ep = 1; ep <= 4; ep++) {
    if (ep > 1) {
      for (let i = 0; i < 4; i++) await page.locator(".intro-actions .primary").click();
      await page.getByRole("button", { name: "전체 공개로 시작" }).click();
    }
    for (const photo of episodePhotos(await stored(page))) {
      await choose(page, photo.id);
      await expect.poll(() => page.locator(".review-main-photo canvas").evaluate((el: HTMLCanvasElement) => el.getContext("2d")!.getImageData(Math.floor(el.width / 2), Math.floor(el.height / 2), 1, 1).data[3] > 0)).toBe(true);
      await ask(page);
      if (["snack", "EP01-P06", "EP04-P04"].includes(photo.id))
        await expect(page.getByRole("button", { name: "SNS에 올려도 되는지 묻기", exact: true })).toHaveCount(0);
      await decide(page, true);
    }
    if (ep === 1) await page.getByLabel("게시물 공개 범위").selectOption("public");
    await publish(page);
    expect((await stored(page)).posts).toHaveLength(1);
    if (ep === 3) {
      const cake = (await stored(page)).issues.find((i) => i.photo === "EP03-P03")!;
      await page.locator(".request-list button").filter({ hasText: photoById("EP03-P03").title }).click();
      await page.locator(".reply-why").click(); await replies(page);
      await expect(page.getByRole("log")).toContainText("내 선물이야! 모두한테 보여 주고 싶진 않아!");
      expect(cake.friend).toBe("usagi");
    }
    await page.getByRole("button", { name: "게시물 전체 내리기" }).click(); await replies(page);
    expect((await stored(page)).issues.every((i) => i.resolved)).toBe(true);
    await page.getByRole("button", { name: "이번 만남 돌아보기", exact: true }).click();
    await page.screenshot({ path: `qa/photo16/screenshots/public-EP0${ep}-result.png`, fullPage: true });
    await page.getByRole("button", { name: ep === 4 ? "최종 이야기 보기" : "다음으로", exact: true }).click();
  }
  expect((await stored(page)).ending).toBe("recovery");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "qa/photo16/screenshots/public-ending.png", fullPage: true });
});

test("a real photo impression precedes fixed opinions and a visible pre-publication reason reply", async ({ page }) => {
  await start(page); await choose(page, "group");
  await page.getByRole("button", { name: "친구들에게 사진 보내기" }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("성 앞에서 다 같이 웃었네");
  expect((await stored(page)).consents).toHaveLength(0);
  await page.getByRole("button", { name: "SNS에 올려도 되는지 묻기" }).click(); await replies(page);
  for (const line of ["난 좋아! 다 같이 잘 나왔어!", "내 얼굴만 가려 주면 괜찮아…", "야하! 난 좋아!"])
    await expect(page.getByRole("log")).toContainText(line);
  await page.getByRole("button", { name: "친구에게 더 이야기하기" }).click();
  await page.getByRole("button", { name: "치이카와에게 이유 묻기" }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("내 얼굴이 잘 보여서 조금 부끄러워");
  await expect(page.getByRole("button", { name: "치이카와에게 이유 묻기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다른 사진 먼저 보기" })).toBeEnabled();
});

test("editing first survives close and reload and sends an exact approved version", async ({ page }) => {
  await start(page); await choose(page, "group");
  await page.getByRole("button", { name: "이 사진 편집하기" }).click(); await coverGroup(page);
  await page.getByRole("button", { name: "편집 닫기" }).click();
  await expect(page.getByLabel("현재 사진의 다음 행동")).toBeVisible();
  await page.getByRole("button", { name: "이 사진 편집하기" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const version = (await stored(page)).versions.at(-1)!;
  expect(protectsFriend(version.photo, "chiikawa", version.edits)).toBe(true);
  expect(permission(await stored(page), "chiikawa", version.id, "close")).toBe(false);
  await page.reload(); await page.getByRole("button", { name: "이야기 이어하기" }).click();
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  expect((await stored(page)).messages.group.findLast((m) => m.photos)?.photos).toEqual([version.id]);
  expect(permission(await stored(page), "chiikawa", version.id, "close")).toBe(true);
  await expect(page.getByRole("log")).toContainText("응! 이제 괜찮아. 고마워!");
  await expect(page.getByRole("log")).toContainText("좋다! 이제 다 같이 볼 수 있겠다!");
  await expect(page.getByRole("button", { name: "SNS 게시 목록에 넣기" })).toBeEnabled();
});

test("partial covering gets visible feedback and can be re-edited", async ({ page }) => {
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  await page.getByRole("button", { name: "이 사진 편집하기" }).click();
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.click(box.x + box.width * .12, box.y + box.height * .7);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("고마워… 그런데 내 얼굴이 아직 보여.");
  await expect(page.getByRole("log")).toContainText("아! 조금 더 가려야겠다!");
  await page.getByRole("button", { name: "다시 편집하기" }).click(); await coverGroup(page);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  expect(permission(await stored(page), "chiikawa", (await stored(page)).versions.at(-1)!.id, "close")).toBe(true);
});

test("an unconfirmed edit can enter the batch and only actual publication creates its request", async ({ page }) => {
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  await page.getByRole("button", { name: "이 사진 편집하기" }).click(); await coverGroup(page);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const id = (await stored(page)).versions.at(-1)!.id;
  await expect(page.locator(".unconfirmed-friends")).toContainText("지금 사진은 아직 확인 전이에요");
  await decide(page, true);
  expect((await stored(page)).issues).toHaveLength(0);
  await reviewAll(page, false); await publish(page);
  expect((await stored(page)).posts[0].photos).toEqual([id]);
  expect((await stored(page)).issues.some((i) => i.friend === "chiikawa" && i.photo === id)).toBe(true);
});

test("keeping survives Home and reload with the requesting friend and cumulative room history", async ({ page }) => {
  await resume(page, episodeSeed()); await choose(page, "funny"); await ask(page);
  await page.getByRole("button", { name: "게시하지 않고 보관하기", exact: true }).click(); await replies(page);
  expect((await stored(page)).messages.group.at(-1)!.from).toBe("usagi");
  await page.getByRole("button", { name: "홈", exact: true }).click();
  await page.reload(); await page.getByRole("button", { name: "이야기 이어하기" }).click();
  expect((await stored(page)).review.photos.funny.decision).toBe("keep");
  await choose(page, "group"); await ask(page);
  await expect(page.getByRole("log")).toContainText("이 표정은 올리지 말아 줘!");
  await expect(page.locator('.review-message[data-photo-id="funny"]')).not.toHaveCount(0);
  await expect(page.getByLabel("현재 사진에 대한 친구 의견")).not.toContainText("그 표정은 안 돼");
});

test("all six photographs are reviewed before one preview and one real SNS post", async ({ page }) => {
  test.setTimeout(90000);
  await start(page); await reviewAll(page, true);
  await expect(page.getByLabel("사진 검토 진행")).toContainText("6 / 6");
  await expect(page.locator(".review-preview .batch-photos figure")).toHaveCount(6);
  expect((await stored(page)).posts).toHaveLength(0);
  await publish(page);
  expect((await stored(page)).posts).toHaveLength(1);
  expect((await stored(page)).posts[0].photos).toHaveLength(6);
  await expect(page.getByRole("article", { name: "SNS 게시물", exact: true })).toHaveCount(1);
});

test("private explanations and promises render and only actual removal resolves each photograph", async ({ page }) => {
  await resume(page, preparedPreview(episodeSeed(), ["group", "snack", "funny"])); await publish(page);
  const issues = (await stored(page)).issues;
  const chi = issues.find((i) => i.friend === "chiikawa")!;
  const usagi = issues.find((i) => i.friend === "usagi")!;
  await page.locator(".request-list button").filter({ hasText: "치이카와" }).click();
  await expect(page.getByRole("log")).toContainText("내 얼굴 가려 달라고 했는데");
  await page.locator(".reply-why").click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("내 얼굴이 잘 보여서 조금 부끄러워");
  await page.locator(".reply-apology").click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("사진도 내려 주면 좋겠어");
  expect((await stored(page)).issues.find((i) => i.id === chi.id)!.resolved).toBe(false);
  await expect(page.locator(".request-list")).toContainText("사진은 아직 게시 중");
  await page.getByRole("button", { name: "요청받은 이 사진 내리기", exact: true }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("사진 내려갔네");
  expect((await stored(page)).posts[0].photos).toEqual(["snack", "funny"]);
  expect((await stored(page)).issues.find((i) => i.id === usagi.id)!.resolved).toBe(false);
  await page.getByRole("button", { name: "게시물 전체 내리기", exact: true }).click(); await replies(page);
  expect((await stored(page)).issues.every((i) => i.resolved)).toBe(true);
});

test("the same friend explains each issue and prior apologies stay linked to the old photograph", async ({ page }) => {
  await resume(page, preparedPreview(episodeSeed(), ["group", "EP01-P04"])); await publish(page);
  const requests = page.locator(".request-list button");
  await requests.filter({ hasText: "우리의 첫 단체사진" }).click();
  await page.locator(".reply-why").click(); await replies(page);
  await page.locator(".reply-apology").click(); await replies(page);
  await requests.filter({ hasText: "회전목마" }).filter({ hasText: "치이카와" }).click();
  await expect(page.locator(".reply-why")).toBeVisible();
  await page.locator(".reply-why").click(); await replies(page);
  const bench = (await stored(page)).issues.find((i) => i.photo === "EP01-P04" && i.friend === "chiikawa")!;
  await expect(page.locator(`.review-message[data-issue-id="${bench.id}"]`).filter({ hasText: "불편하게 해서 미안해" })).toHaveCount(0);
  await expect(page.getByRole("log")).toContainText("앞서 본 사진");
});

test("editing and confirming a new album version leaves the published original request active", async ({ page }) => {
  await resume(page, preparedPreview(episodeSeed(), ["group", "snack"])); await publish(page);
  await page.locator(".request-list button").filter({ hasText: "치이카와" }).click();
  await page.getByRole("button", { name: "사진첩에 새 편집본 만들기" }).click();
  await coverGroup(page);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByLabel("사진첩에 저장한 새 편집본")).toContainText("SNS에는 게시했던 사진이 계속 남아 있어요");
  await expect(page.locator(".posted-version-comparison figcaption")).toHaveText(["SNS에 올라간 사진", "사진첩에 저장한 새 편집본"]);
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  const g = await stored(page);
  expect(permission(g, "chiikawa", g.versions.at(-1)!.id, "close")).toBe(true);
  expect(g.posts[0].photos).toEqual(["group", "snack"]);
  expect(g.issues.find((i) => i.photo === "group")!.resolved).toBe(false);
  await expect(page.getByLabel("사진첩에 저장한 새 편집본").getByRole("log")).toContainText("응! 이제 괜찮아. 고마워!");
  await page.getByRole("button", { name: "요청받은 이 사진 내리기" }).click(); await replies(page);
  expect((await stored(page)).posts[0].photos).toEqual(["snack"]);
  await expect(page.getByLabel("사진첩에 저장한 새 편집본")).toContainText("이 사진은 SNS에서 내렸어요");
});

test("finishing with an unread request opens its actual photo and conversation before allowing continuation", async ({ page }) => {
  await resume(page, preparedPreview(episodeSeed(), ["group", "funny"])); await publish(page);
  const g = await stored(page);
  const unread = g.issues.find((i) => !i.read)!;
  expect(unread).toBeDefined();
  const request = g.messages[unread.friend].find((m) => m.issueId === unread.id && m.purpose === "request")!;
  await page.getByRole("button", { name: "남은 부탁을 확인하고 만남 마무리" }).click();
  expect((await stored(page)).stage).toBe("play");
  await expect(page.locator(".issue-detail")).toBeVisible();
  await expect(page.locator(".issue-detail")).toHaveAttribute("data-issue-id", unread.id);
  await expect(page.getByRole("log")).toContainText(request.text);
});

test("all keeping reviews sixteen photos and reaches the final good ending with honest feedback", async ({ page }) => {
  test.setTimeout(180000); await start(page);
  for (let ep = 1; ep <= 4; ep++) {
    await reviewAll(page, false);
    await page.getByRole("button", { name: "이번 만남 돌아보기", exact: true }).click();
    await expect(page.getByLabel("이번 만남의 신뢰도")).toContainText("100%");
    await expect(page.getByLabel("이번 만남의 신뢰도")).not.toContainText("편집한 사진을 다시 보여");
    if (ep < 4) { await page.getByRole("button", { name: "다음으로", exact: true }).click(); await intro(page); }
  }
  await page.getByRole("button", { name: "최종 이야기 보기", exact: true }).click();
  expect((await stored(page)).ending).toBe("good");
  await expect(page.locator(".journey-choice-summary li")).toHaveCount(4);
  await expect(page.locator(".ending-image")).toHaveJSProperty("naturalWidth", 1600);
});

for (const repaired of [false, true]) test(`final outcome reflects ${repaired ? "actual repair" : "unresolved requests"}`, async ({ page }) => {
  await resume(page, preparedPreview(episodeSeed("EP04"), ["EP04-P01", "EP04-P02"])); await publish(page);
  for (const button of await page.locator(".request-list button").all()) await button.click();
  if (repaired) { await page.getByRole("button", { name: "게시물 전체 내리기" }).click(); await replies(page); }
  await page.getByRole("button", { name: repaired ? "이번 만남 돌아보기" : "남은 부탁을 확인하고 만남 마무리", exact: true }).click();
  await expect(page.getByLabel("이번 만남의 신뢰도")).toBeVisible();
  await page.getByRole("button", { name: "최종 이야기 보기" }).click();
  expect((await stored(page)).ending).toBe(repaired ? "recovery" : "unresolved");
});

test("birthday refusal is fixed and Usagi acknowledges keeping it", async ({ page }) => {
  await resume(page, episodeSeed("EP03")); await choose(page, "EP03-P03"); await ask(page);
  await expect(page.getByRole("log")).toContainText("선물 사진은 우리끼리만 간직하자!");
  await page.getByRole("button", { name: "게시하지 않고 보관하기" }).click(); await replies(page);
  expect((await stored(page)).messages.group.at(-1)!.from).toBe("usagi");
  expect((await stored(page)).posts).toHaveLength(0);
});

for (const width of [320, 390]) test(`photostrip zoom and all four covered faces work at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  await resume(page, episodeSeed("EP02")); await choose(page, "EP02-P01"); await ask(page);
  await page.getByRole("button", { name: "이 사진 편집하기" }).click();
  await expect(page.locator(".editor-request")).toContainText("치이카와");
  const before = (await canvas(page).boundingBox())!.width;
  await page.getByRole("button", { name: "확대", exact: true }).click();
  expect((await canvas(page).boundingBox())!.width).toBeGreaterThan(before * 1.9);
  const faces = photoById("EP02-P01").faces.filter((f) => f.friend === "chiikawa");
  await page.getByRole("button", { name: "크게", exact: true }).click();
  const enlarged = (await canvas(page).boundingBox())!;
  const first = faces[0];
  await page.mouse.move(enlarged.x + enlarged.width * (first.center.x - first.rx), enlarged.y + enlarged.height * first.center.y);
  await page.mouse.down();
  await page.mouse.move(enlarged.x + enlarged.width * (first.center.x + first.rx), enlarged.y + enlarged.height * first.center.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const draft = (await stored(page)).editorDraft;
    return Boolean(draft && protection(first, draft.edits).safe);
  }).toBe(true);
  await page.getByRole("button", { name: "축소", exact: true }).click();
  await page.getByRole("button", { name: "크게", exact: true }).click();
  const box = (await canvas(page).boundingBox())!;
  for (const face of photoById("EP02-P01").faces.filter((f) => f.friend === "chiikawa")) {
    await page.mouse.move(box.x + box.width * (face.center.x - face.rx), box.y + box.height * face.center.y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * (face.center.x + face.rx), box.y + box.height * face.center.y, { steps: 12 });
    await page.mouse.up();
  }
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const version = (await stored(page)).versions.at(-1)!;
  expect(protectsFriend(version.photo, "chiikawa", version.edits)).toBe(true);
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("응! 이제 괜찮아. 고마워!");
  await page.getByRole("button", { name: "SNS 게시 목록에 넣기" }).scrollIntoViewIfNeeded();
  expect((await page.getByRole("button", { name: "SNS 게시 목록에 넣기" }).boundingBox())!.height).toBeGreaterThanOrEqual(46);
  await page.screenshot({ path: `qa/integrated/mobile-${width}.png`, animations: "disabled", fullPage: true });
});

test("sticker movement, keyboard resizing and saved-version approval use the same photo coordinates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resume(page, episodeSeed()); await choose(page, "group"); await ask(page);
  await page.getByRole("button", { name: "이 사진 편집하기" }).click();
  await page.getByRole("button", { name: "● 스티커 추가", exact: true }).click();
  await page.getByRole("slider", { name: "스티커 크기" }).focus();
  await page.keyboard.press("End");
  const box = (await canvas(page).boundingBox())!;
  const face = photoById("group").faces.find((f) => f.friend === "chiikawa")!;
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * face.center.x, box.y + box.height * face.center.y, { steps: 12 });
  await page.mouse.up();
  await page.getByRole("button", { name: "실행 취소" }).click();
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const version = (await stored(page)).versions.at(-1)!;
  expect(version.edits[0].kind).toBe("sticker");
  expect(protectsFriend(version.photo, "chiikawa", version.edits)).toBe(true);
  await page.getByRole("button", { name: "친구에게 편집본 보여 주기" }).click(); await replies(page);
  await expect(page.getByRole("log")).toContainText("응! 이제 괜찮아. 고마워!");
});

test("new photo reasons stay available and a promise leaves both editing and permission untouched", async ({ page }) => {
  await resume(page, episodeSeed());
  for (const id of ["group", "EP01-P04"]) {
    await choose(page, id); await ask(page);
    await page.getByRole("button", { name: "친구에게 더 이야기하기" }).click();
    await page.getByRole("button", { name: "치이카와에게 이유 묻기" }).click(); await replies(page);
    await expect(page.locator(`.review-message[data-photo-id="${id}"]`).last()).toContainText(id === "group" ? "조금 부끄러워" : "얼굴이 크게 보이니까");
    await page.getByRole("button", { name: "얼굴을 가려 주겠다고 말하기" }).first().click(); await replies(page);
    expect((await stored(page)).versions).toHaveLength(0);
    expect(permission(await stored(page), "chiikawa", id, "close")).toBe(false);
    await decide(page, false);
  }
});

test("prior protagonist records retain their speaker while new play is Maru", async ({ page }) => {
  let old = newGame("hachiware");
  for (let i = 0; i < 4; i++) old = reduceGame(old, { type: "introNext" });
  old = reduceGame(old, { type: "reply", room: "group", kind: "topic" });
  while (old.pending.length) old = reduceGame(old, { type: "deliver" });
  await resume(page, { ...old, revision: 7, review: undefined });
  expect((await stored(page)).hero).toBe("maru");
  expect((await stored(page)).review.originalHero).toBe("hachiware");
  expect((await stored(page)).messages.group.find((m) => m.from === "me")!.actor).toBe("hachiware");
});

test("legacy multi-photo records and hidden reply survive with a raw save backup", async ({ page }) => {
  let g = preparedPreview(episodeSeed(), ["group", "funny"]);
  g = reduceGame(reduceGame(g, { type: "reviewPublish", audience: "close", caption: "이전 기록" }), { type: "reviewReplies" });
  const issue = g.issues.find((i) => i.friend === "chiikawa")!;
  g.messages.chiikawa.push({ id: "legacy-reply", from: "chiikawa", text: "얼굴이 보여서 부끄러웠어…", purpose: "reply", read: true });
  await resume(page, { ...g, revision: 7, review: undefined });
  const restored = await stored(page);
  expect(restored.posts[0].photos).toEqual(g.posts[0].photos);
  expect(restored.issues).toHaveLength(g.issues.length);
  const raw = await page.evaluate((key) => localStorage.getItem(key + "-before-integrated"), SAVE_KEY);
  expect(JSON.parse(raw!).revision).toBe(7);
  await page.locator(".request-list button").filter({ hasText: "치이카와" }).click();
  await expect(page.getByRole("log")).toContainText("얼굴이 보여서 부끄러웠어");
  expect(restored.messages.chiikawa.find((m) => m.id === "legacy-reply")!.photoId).toBe(issue.photo);
});

test("revision eight progress keeps an exact raw backup before the photo policy upgrade", async ({ page }) => {
  const old = preparedPreview(episodeSeed(), ["group", "snack"]);
  delete old.review.policyVersion;
  delete old.review.audienceChosen;
  const raw = JSON.stringify(old);
  await resume(page, old);
  expect(await page.evaluate((key) => localStorage.getItem(key + "-before-photo16"), SAVE_KEY)).toBe(raw);
  expect((await stored(page)).review.audienceChosen).toBe(true);
  expect((await stored(page)).review.photos.group.decision).toBe("include");
  expect((await stored(page)).messages.group).toEqual(old.messages.group);
});

test("storage errors are visible and unreadable saves remain available", async ({ browser }) => {
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); }; });
  const page = await blocked.newPage(); await page.goto("/");
  await page.getByRole("button", { name: "이야기 시작하기" }).click();
  await expect(page.getByRole("alert")).toContainText("저장할 공간이 부족");
  await expect(page.getByRole("heading", { name: "마루의 생각" })).toBeVisible(); await blocked.close();
  const broken = await browser.newContext();
  await broken.addInitScript((key) => localStorage.setItem(key, "{broken"), SAVE_KEY);
  const other = await broken.newPage(); await other.goto("/");
  await expect(other.getByRole("alert")).toContainText("원본 기록");
  expect(await other.evaluate((key) => localStorage.getItem(key), SAVE_KEY)).toBe("{broken"); await broken.close();
});
