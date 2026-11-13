import type {
  Audience,
  Character,
  Consent,
  Game,
  ReplyOption,
  ConversationState,
} from "./model";
import { imageInfo, photoById, sharedPhotos } from "./data";
import { protectsFriend } from "./protection";
import {
  photoDialogue,
  temporaryPhotoReply,
  photoImpression,
  photoReference,
} from "./photo-dialogue";
import { episodeTopic } from "./episodes";
import { activityOpinion, photoActivities } from "./photo-activities";

export function conversationIssue(game: Game, friend: Character | "group") {
  const issues = game.issues.filter(
    (i) => i.friend === friend && !i.resolved && i.notified,
  );
  return (
    issues.find((i) => i.id === game.review?.activeIssue) ??
    issues.find((i) => !i.decision) ??
    issues.find((i) => i.decision === "remove") ??
    issues[0]
  );
}

export function replyOptions(
  game: Game,
  room: Character | "group",
  id: string,
  audience: Audience = "close",
): ReplyOption[] {
  if (game.pending.some((p) => p.room === room)) return [];
  if (!game.story.topicStarted)
    return room === "group"
      ? [{ kind: "topic", text: topicText(game.hero, game.episode) }]
      : [];
  if (!game.story.photoPromptSeen) return [];
  const sent = sharedPhotos(game, room);
  if (room === "group")
    return !sent.includes(id)
      ? []
      : game.chatRequests[room].includes(id)
        ? [
            ...(sent.some((photo) =>
              photoById(imageInfo(game, photo).photo).faces.some(
                (face) =>
                  face.friend !== game.hero &&
                  game.consents.some(
                    (c) =>
                      c.friend === face.friend &&
                      c.photo === imageInfo(game, photo).photo &&
                      c.valid !== false &&
                      c.condition !== "yes" &&
                      !protectsFriend(
                        imageInfo(game, photo).photo,
                        face.friend,
                        imageInfo(game, photo).edits,
                      ),
                  ),
              ),
            )
              ? [
                  {
                    kind: "cover" as const,
                    text: "부탁한 얼굴을 가려서 다시 보내 볼게.",
                  },
                ]
              : []),
            { kind: "otherPhoto", text: "다른 사진도 같이 골라 볼까?" },
            ...(game.story.photoChoices[imageInfo(game, id).photo] !== "keep"
              ? [
                  {
                    kind: "keepPhoto" as const,
                    text:
                      sent.length > 1
                        ? "이 사진들은 우리끼리만 간직할게."
                        : "이 사진은 우리끼리만 간직할게.",
                  },
                ]
              : []),
          ]
        : [{ kind: "ask", text: questionText(game, id, audience, true) }];
  const issue = conversationIssue(game, room);
  if (issue) {
    const options: ReplyOption[] = [];
    if (issue.decision !== "remove") {
      if (!issue.withdrawal && !game.apologized.includes(room))
        options.push({
          kind: "apology",
          text: "불편하게 해서 미안해. 그 사진은 지금 내릴게.",
        });
      else
        options.push({
          kind: "respect",
          text: "알겠어. 그 사진은 지금 내릴게.",
        });
    }
    const post = game.posts.find((p) => p.id === issue.post);
    if (
      !game.messages[room].some(
        (m) =>
          m.from === "me" && m.issueId === issue.id && m.text === "어떤 점이 불편했는지 이야기해 줄래?",
      )
    )
      options.push({
        kind: "why",
        text: "어떤 점이 불편했는지 이야기해 줄래?",
      });
    if (issue.decision !== "keep")
      options.push({
        kind: "insist",
        text:
          post?.audience === "close"
            ? "친한 친구만 보는데, 그냥 두면 안 될까?"
            : "다 같이 잘 나온 사진인데, 그냥 두면 안 될까?",
      });
    return options;
  }
  const earlier = game.issues.find(
    (i) => i.friend === room && i.resolved && !i.conversationClosed,
  );
  if (earlier)
    return [
      ...(!earlier.withdrawal && !game.apologized.includes(room)
        ? [
            {
              kind: "apology" as const,
              text: "사진을 다시 살폈어. 불편하게 해서 미안해.",
            },
          ]
        : []),
      {
        kind: "respect",
        text: "이야기해 줘서 고마워. 다음엔 같이 고르자.",
      },
    ];
  if (!sent.includes(id)) return [];
  if (!game.chatRequests[room].includes(id))
    return [
      { kind: "ask", text: questionText(game, id, audience, false) },
      { kind: "keepPhoto", text: "이 사진은 일단 간직할게." },
    ];
  const image = imageInfo(game, id),
    face = photoById(image.photo).faces.find((f) => f.friend === room);
  if (!face)
    return [
      { kind: "otherPhoto", text: "다른 사진도 같이 볼까?" },
      { kind: "keepPhoto", text: "이 사진은 일단 간직할게." },
    ];
  const prior = game.consents.find(
    (c) =>
      c.friend === room &&
      c.photo === image.photo &&
      c.audience === audience &&
      c.valid !== false,
  );
  const ask = {
    kind: "ask" as const,
    text: questionText(game, id, audience, false),
  };
  let options: ReplyOption[];
  if (!prior)
    options = [
      ask,
      {
        kind: "show",
        text: `${photoReference(image.photo, game.hero)}, 기억나?`,
      },
    ];
  else if (prior.condition === "no")
    options = [
      ...(!image.edits.length ||
      (face && !protectsFriend(image.photo, room, image.edits))
        ? [
            {
              kind: "cover" as const,
              text: "그럼 얼굴을 가려 보고 다시 물어볼게.",
            },
          ]
        : []),
      { kind: "otherPhoto", text: "다른 사진을 찾아볼게." },
      { kind: "keepPhoto", text: "알겠어. 이 사진은 올리지 않을게." },
    ];
  else if (
    prior.condition === "cover" &&
    face &&
    protectsFriend(image.photo, room, image.edits)
  )
    options = [
      ...(prior.asset !== id
        ? [ask]
        : [
            { kind: "respect" as const, text: "고마워! 이 편집본으로 올릴게." },
          ]),
      { kind: "otherPhoto", text: "다른 사진도 한번 골라 볼게." },
      { kind: "keepPhoto", text: "이번 사진은 그냥 간직할래." },
    ];
  else if (prior.condition === "cover")
    options = [
      { kind: "cover", text: "알겠어! 네 얼굴이 안 보이게 가려 볼게." },
      { kind: "otherPhoto", text: "그럼 다른 사진을 찾아볼게." },
      ...(image.edits.length ? [ask] : []),
      { kind: "keepPhoto", text: "그럼 이 사진은 우리끼리 간직할게." },
    ];
  else
    options = [
      { kind: "respect", text: "좋아! 말해 준 대로 올릴게." },
      { kind: "keepPhoto", text: "생각해 보니 이 사진은 간직하고 싶어." },
    ];
  return options;
}

export function questionText(
  game: Game,
  id: string,
  _audience: Audience,
  group: boolean,
) {
  const lead = group ? "얘들아, " : "";
  const target =
    sharedPhotos(game, group ? "group" : (game.room ?? "group")).length > 1
      ? "방금 보낸 사진들을 SNS에 올려도 괜찮아?"
      : `${photoReference(imageInfo(game, id).photo, game.hero)}${game.hero === "usagi" ? "! SNS에 올려도 돼?" : ", SNS에 올려도 괜찮아?"}`;
  const voices: Record<Character, string> = {
    chiikawa: `저기… ${lead}${target}`,
    hachiware: `${lead}${target}`,
    usagi: `야하! ${lead}${target}`,
    maru: `${lead}${target} ${group ? "너희" : "네"} 생각도 궁금해.`,
  };
  return voices[game.hero];
}
export function topicText(hero: Character, episode: Game["episode"] = "EP01") {
  if (episode !== "EP01") return episodeTopic(episode, hero);
  const text: Record<Character, string> = {
    chiikawa: "저기… 오늘 롯데월드에서 찍은 사진을 SNS에 올리고 싶어.",
    hachiware: "얘들아! 오늘 롯데월드 사진을 SNS에 올리고 싶은데!",
    usagi: "야하! 오늘 찍은 사진, SNS에 올리고 싶어!",
    maru: "오늘 같이 찍은 사진을 SNS에 올리고 싶어. 너희랑 이야기해 보고 싶었어.",
  };
  return text[hero];
}

export function conversationState(
  game: Game,
  friend: Character,
  id: string,
  audience: Audience,
): ConversationState {
  if (
    game.pending.some(
      (p) => p.room === friend && (p.consent || p.consents?.length),
    )
  )
    return "requesting";
  const issue = conversationIssue(game, friend);
  if (issue)
    return issue.decision === "remove"
      ? "resolving"
      : issue.withdrawal
        ? "withdrawal"
        : "issue";
  if (
    game.issues.some(
      (i) => i.friend === friend && i.resolved && !i.conversationClosed,
    )
  )
    return "resolved";
  const consent = game.consents.find(
    (c) =>
      c.friend === friend &&
      c.photo === imageInfo(game, id).photo &&
      c.audience === audience &&
      c.valid !== false,
  );
  if (!consent) return "unasked";
  const image = imageInfo(game, id),
    face = photoById(image.photo).faces.find((f) => f.friend === friend);
  if (
    image.edits.length &&
    face &&
    protectsFriend(image.photo, friend, image.edits) &&
    consent.asset !== id
  )
    return "reask_ready";
  if (consent.reasked) return "reasked";
  return consent.condition === "no"
    ? "refused"
    : consent.condition === "cover"
      ? "conditional"
      : "approved";
}

export function consentAnswer(
  game: Game,
  friend: Character,
  id: string,
  audience: Audience,
): { condition: Consent["condition"]; text: string } {
  const image = imageInfo(game, id),
    face = photoById(image.photo).faces.find((f) => f.friend === friend);
  if (
    game.issues.some(
      (i) =>
        i.friend === friend &&
        i.withdrawal &&
        !i.resolved &&
        imageInfo(game, i.photo).photo === image.photo,
    )
  )
    return {
      condition: "no",
      text: "지금은 그 사진을 내리고 싶어. 먼저 내 부탁을 들어 줬으면 해.",
    };
  if (!face)
    return {
      condition: "yes",
      text: photoImpression(image.photo, friend),
    };
  const safe = protectsFriend(image.photo, friend, image.edits);
  const temporary = photoDialogue[image.photo]?.conditions[friend];
  if (temporary)
    return {
      condition: temporary,
      text: temporaryPhotoReply(image.photo, friend, temporary, safe),
    };
  const configured = photoById(image.photo).conditions?.[friend]?.[audience];
  if (configured)
    return {
      condition: configured,
      text:
        photoById(image.photo).reactions?.[friend] ??
        (configured === "no"
          ? "이 사진은 우리끼리만 간직하고 싶어."
          : configured === "cover"
            ? "내 얼굴이 안 보이는 편집본이면 좋아."
            : "응, 이 사진은 SNS에 올려도 괜찮아."),
    };
  const prior = game.consents.find(
    (c) =>
      c.friend === friend &&
      c.photo === image.photo &&
      c.audience === audience &&
      c.valid !== false,
  );
  if (friend === "chiikawa")
    return {
      condition: "cover",
      text: safe
        ? "응… 얼굴이 안 보이니까 마음이 놓여. 이 사진이면 좋아!"
        : "으응… 나는 얼굴이 보이면 좀 부끄러워. 내 얼굴을 가려 줄 수 있어?",
    };
  if (friend === "maru") {
    if (prior && safe && image.edits.length)
      return game.maruAllows
        ? {
            condition: "cover",
            text: "다시 보여 줘서 고마워. 이렇게 얼굴이 안 보이면 괜찮아.",
          }
        : {
            condition: "no",
            text: "가려 준 건 고마워. 그래도 난 이번 사진은 올리고 싶지 않아.",
          };
    return {
      condition: "no",
      text:
        image.photo === "group"
          ? "오늘은 내 사진이 SNS에 안 올라갔으면 좋겠어. 우리끼리만 보면 안 될까?"
          : `${photoImpression(image.photo, friend)} 나는 이 사진은 SNS에 올리지 않고 간직하고 싶어. 다른 사진도 같이 볼까?`,
    };
  }
  if (friend === "usagi")
    return photoById(image.photo).kind === "portrait" &&
      photoById(image.photo).subject === friend
      ? safe
        ? { condition: "cover", text: "야하! 얼굴이 안 보이네! 이건 좋아!" }
        : {
            condition: "no",
            text: "우라! 그 표정은 안 돼! 단체사진만 올려 줘!",
          }
      : { condition: "yes", text: "야하! 성 앞에서 찍은 사진! 좋아, 올려!" };
  return {
    condition: audience === "close" ? "yes" : safe ? "cover" : "no",
    text:
      audience === "public"
        ? safe
          ? "얼굴이 안 보이네. 이 사진은 전체 공개로 올려도 괜찮아!"
          : "나는 이 사진은 친한 친구들끼리 보고 싶어. 전체 공개는 좀 쑥스러워."
        : safe
          ? "내 얼굴이 안 보이는 이 사진은 친한 친구들끼리 나눠도 좋아!"
          : "친한 친구들끼리 보는 건 좋아! 전체 공개라면 내 얼굴은 가려 줘.",
  };
}

export type ReactionKind =
  | "request"
  | "positive"
  | "removed"
  | "removedCautious"
  | "withdrawal"
  | "keep"
  | "settled";
export function reactionLine(
  game: Game,
  friend: Character,
  id: string,
  kind: ReactionKind,
  audience: Audience = "close",
): string {
  const image = imageInfo(game, id);
  const present = photoById(image.photo).faces.some(
    (face) => face.friend === friend,
  );
  if (game.review?.enabled && photoActivities[image.photo]?.subject === friend) {
    const live = game.posts.some((p) => !p.deleted && p.photos.includes(id));
    if (kind === "removed" || kind === "removedCautious") return live
      ? "선물 사진은 아직 올라가 있어. 내려 줄래?"
      : "선물 사진을 내려 줬네! 우리만의 추억으로 간직하자. 고마워!";
    if (kind === "keep" || kind === "request") return "받은 선물은 우리만의 추억으로 남기고 싶어. 이 사진은 내려 줘!";
  }
  if (!present) return photoImpression(image.photo, friend);
  const hidden = protectsFriend(image.photo, friend, image.edits);
  const consent = game.consents.find(
    (c) =>
      c.friend === friend &&
      c.photo === image.photo &&
      c.audience === audience &&
      c.valid !== false,
  );
  const post = game.posts.find((p) => p.photos.includes(id) && !p.deleted);
  if ((kind === "removed" || kind === "removedCautious") && post) kind = "keep";
  if (kind === "positive") {
    const covered = hidden && image.edits.length > 0;
    if (covered && consent?.condition === "cover") {
      const thanks: Record<Character, string> = {
        chiikawa: "내 얼굴이 안 보이네… 부탁 들어 줘서 고마워.",
        hachiware: "얼굴 가린 사진으로 올렸네. 내 말 기억해 줘서 고마워!",
        usagi: "얼굴이 안 보인다! 이 사진 좋아!",
        maru: "내가 괜찮다고 한 사진으로 올렸네. 마음이 편해.",
      };
      return `${photoImpression(image.photo, friend)} ${thanks[friend]}`;
    }
    return photoImpression(image.photo, friend);
  }
  if (kind === "request") {
    if (
      game.issues.some(
        (issue) =>
          issue.friend === friend &&
          issue.withdrawal &&
          !issue.resolved &&
          imageInfo(game, issue.photo).photo === image.photo,
      )
    )
      return reactionLine(game, friend, id, "withdrawal", audience);
    const otherScope = game.consents.some(
      (c) =>
        c.friend === friend &&
        c.photo === image.photo &&
        c.audience !== audience &&
        c.valid !== false &&
        (c.condition === "yes" ||
          (c.condition === "cover" && hidden && (!c.asset || c.asset === id))),
    );
    if (otherScope && (!consent || consent.condition === "no")) {
      const scopeLines: Record<Character, string> = {
        chiikawa:
          "으응… 지금 보여 주는 범위는 마음이 편하지 않아. 사진을 잠깐 내려 줄래?",
        hachiware:
          audience === "public"
            ? "친한 친구들끼리는 좋았는데, 전체 공개는 쑥스러워. 사진을 잠깐 내려 줄래?"
            : "어디까지 보여 줄지 다시 같이 정하고 싶어. 사진을 잠깐 내려 줄래?",
        usagi: "우! 지금 보여 주는 곳은 같이 정한 게 아니야! 잠깐 내려 줘!",
        maru: "지금 공개하는 범위는 마음이 편하지 않아. 먼저 사진을 내리고 다시 이야기할래?",
      };
      return scopeLines[friend];
    }
    if (consent?.condition === "no")
      return friend === "maru"
        ? "내가 올리고 싶지 않다고 한 사진이네. 지금은 내려 줄래?"
        : friend === "usagi"
          ? "우라! 이 사진은 싫다고 했어! 내려 줘!"
          : "이 사진은 간직하고 싶다고 했어. 잠깐 내려 줄래?";
    if (consent?.condition === "cover" && !hidden)
      return friend === "chiikawa"
        ? game.review?.enabled ? "내 얼굴 가려 달라고 했는데… 사진 내려 줄래?" : "어… 내 얼굴이 아직 보여. 부끄러운데, 그 사진 내려 줄 수 있어?"
        : "내 얼굴이 아직 보이네. 가린 사진으로 같이 정하고 싶어. 잠깐 내려 줄래?";
    if (hidden)
      return friend === "usagi"
        ? "얼굴은 안 보이네. 그래도 이 사진은 아직 같이 안 골랐어. 잠깐 내려 줘!"
        : "얼굴은 가려 줬네. 이 사진도 나한테 보여 주고 정했으면 좋겠어. 잠깐 내려 줄래?";
  }
  const lines: Record<
    Character,
    Record<Exclude<ReactionKind, "positive" | "settled">, string>
  > = {
    chiikawa: {
      request:
        "어… 사진이 올라왔네. 나도 먼저 보고 고르고 싶었어. 잠깐 내려 줄래?",
      removed: "응, 사진 내려갔네. 내 말 들어 줘서 고마워.",
      removedCautious:
        "응… 내려 줘서 고마워. 아직 조금 속상하지만, 내 말 들어 줬구나.",
      withdrawal:
        "아까는 괜찮았는데… 계속 올라가 있으니 신경 쓰여. 지금은 내려 줄래?",
      keep: "보는 사람이 적어도 나는 좀 불편해… 지금은 내려 줬으면 해.",
    },
    hachiware: {
      request:
        "어, 나도 나온 사진이네? 올리기 전에 나한테도 보여 줬으면 좋았을 텐데. 잠깐 내려 줄래?",
      removed: "내려 줬구나! 이야기 들어 줘서 고마워. 다음 사진도 같이 고르자.",
      removedCautious: "사진은 내려갔네. 아직 좀 속상해. 다음엔 같이 고르자.",
      withdrawal:
        "처음엔 좋았는데 다시 보니 쑥스러워졌어. 지금 올라간 사진은 내려 줄 수 있어?",
      keep: "나는 지금은 내리고 싶어. 같이 찍었어도 생각은 다를 수 있잖아.",
    },
    usagi: {
      request: "우라! 이 사진은 아직 좋다고 안 했어! 내려 줘!",
      removed: "내렸네! 고마워! 다음 사진도 보자!",
      removedCautious: "우… 내렸네. 조금 속상해. 다음엔 먼저 보여 줘!",
      withdrawal: "우… 다시 보니까 이 사진은 간직만 할래. 내려 줘!",
      keep: "우라! 내 사진이야. 지금은 싫어!",
    },
    maru: {
      request:
        "이 사진이 올라온 걸 보고 놀랐어. 나도 먼저 보고 정하고 싶었어. 잠깐 내려 줄래?",
      removed: "내려 줘서 고마워. 이제 마음이 좀 편해졌어.",
      removedCautious:
        "내려 줘서 고마워. 아직 속상하지만, 다시 이야기해 보고 싶어.",
      withdrawal:
        "생각이 바뀌었어. 내 사진이 올라가 있으니 마음이 불편해. 내려 줬으면 해.",
      keep: "나는 지금은 내 사진을 간직하고 싶어. 내 부탁도 들어 줄래?",
    },
  };
  if (kind === "settled") {
    const scope =
      audience === "close"
        ? "친한 친구들끼리 보는 지금 범위"
        : "지금 공개 범위";
    const replies: Record<Character, string> = {
      chiikawa: `으응… ${scope}라면 괜찮아.`,
      hachiware: `${scope}면 좋아! 내 생각도 물어봐 줘서 고마워.`,
      usagi: "야하! 지금 사진은 좋아!",
      maru: "내가 괜찮다고 한 사진과 범위로 정했네. 마음이 놓여.",
    };
    return replies[friend];
  }
  return lines[friend][kind];
}
export function topicReply(friend: Character) {
  const lines: Record<Character, string> = {
    chiikawa: "으응… 무슨 사진? 나도 보고 싶어.",
    hachiware: "무슨 사진? 어떤 사진인지 먼저 보여 줘!",
    usagi: "무슨 사진? 야하! 보여 줘!",
    maru: "무슨 사진인지 궁금해. 같이 보고 이야기하자.",
  };
  return lines[friend];
}
export function postConversationPrompt(friend: Character) {
  return {
    chiikawa: "저기… 올라온 사진 때문에 조금 이야기하고 싶어.",
    hachiware: "사진 봤어! 채팅에서 잠깐 이야기할래?",
    usagi: "우! 마루, 이 사진 좀 봐!",
    maru: "올라온 사진에 대한 내 생각을 말하고 싶어. 채팅 볼래?",
  }[friend];
}
export function issueExplanation(
  game: Game,
  friend: Character,
  id: string,
  audience: Audience,
) {
  if (
    game.issues.some(
      (i) =>
        i.friend === friend && i.photo === id && i.withdrawal && !i.resolved,
    )
  )
    return reactionLine(game, friend, id, "withdrawal", audience);
  const image = imageInfo(game, id);
  if (game.review?.enabled && photoActivities[image.photo]) return activityOpinion(image.photo, friend, audience).reason;
  if (friend === "chiikawa")
    return protectsFriend(image.photo, friend, image.edits)
      ? "가려 준 건 알아… 그래도 어떤 사진을 올릴지 내 생각도 먼저 말하고 싶었어."
      : "어떤 사진이 올라갈지 나도 먼저 보고 고르고 싶어…";
  if (friend === "hachiware")
    return audience === "public"
      ? "다른 사람들도 볼 수 있는 곳이네. 어디까지 나눌지 같이 정하고 싶었어."
      : "친한 친구들한테 보여 주더라도 어떤 사진인지 먼저 같이 고르고 싶었어.";
  if (friend === "usagi")
    return image.photo === "funny"
      ? "그 표정은 내가 올리고 싶은 모습이 아니야!"
      : "내 사진이야! 어디에 보일지 나도 고르고 싶어!";
  return "같이 찍은 기억은 좋아. 이 사진을 공개하는 건 지금은 마음이 편하지 않아.";
}
export function removalPromiseReply(friend: Character) {
  const lines: Record<Character, string> = {
    chiikawa: "으응… 내 마음 알아줘서 고마워. 사진도 내려 주면 좋겠어.",
    hachiware: "응, 이야기 들어 줘서 고마워. 사진도 내려 주면 좋겠어.",
    usagi: "응! 사진도 내려 줘!",
    maru: "내 생각을 들어 줘서 고마워. 사진을 내리면 마음이 편해질 것 같아.",
  };
  return lines[friend];
}
export function groupFollowup(kind: ReplyOption["kind"], friend: Character) {
  if (kind === "respect")
    return {
      chiikawa: "으응… 내 생각도 들어 줘서 고마워.",
      hachiware: "좋아! 마음에 드는 사진을 같이 골랐네!",
      usagi: "좋아! 이 사진으로 고르자!",
      maru: "응. 내가 편한 사진을 같이 골라 줘서 고마워.",
    }[friend];
  const replies: Record<
    Character,
    { cover: string; keepPhoto: string; otherPhoto: string }
  > = {
    chiikawa: {
      cover: "으응… 가리고 나면 다시 보여 줄래?",
      keepPhoto: "응… 우리끼리 간직하자. 고마워.",
      otherPhoto: "다른 사진도 보고 싶어…",
    },
    hachiware: {
      cover: "고마워! 가리면 다시 보여 줘. 같이 보자!",
      keepPhoto: "좋아. 다음에 만나서 같이 봐도 재밌겠다!",
      otherPhoto: "다른 사진도 보자! 마음에 드는 게 또 있을 거야.",
    },
    usagi: {
      cover: "야하! 가린 사진도 보여 줘!",
      keepPhoto: "야하! 우리끼리만 보자!",
      otherPhoto: "다음 사진! 같이 고르자!",
    },
    maru: {
      cover: "응, 바꾼 사진을 보고 내 생각도 말해 볼게.",
      keepPhoto: "고마워. 간직하면서 같이 보는 것도 좋겠어.",
      otherPhoto: "좋아. 편하게 나눌 사진을 같이 찾아보자.",
    },
  };
  return replies[friend][
    kind === "cover"
      ? "cover"
      : kind === "keepPhoto"
        ? "keepPhoto"
        : "otherPhoto"
  ];
}
