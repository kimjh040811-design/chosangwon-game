import type { Audience, Character, Consent } from "./model";

type Condition = Consent["condition"];
export type Activity = "edit" | "opinions" | "audience" | "memory";
interface Opinion { condition: Condition; text: string; reason: string }
interface PhotoActivity {
  type: Activity;
  goal: string;
  opinions?: Partial<Record<Character, Opinion>>;
  scopeFriend?: Character;
  subject?: Character;
  memory?: string;
  approvals?: Partial<Record<Character, string>>;
}
const cover = (text: string, reason = text): Opinion => ({ condition: "cover", text, reason });
const refuse = (text: string, reason = text): Opinion => ({ condition: "no", text, reason });

// Only real pictured faces can receive a cover request. The birthday owner is
// an opinion participant for the gift photo, never a fictitious face target.
export const photoActivities: Record<string, PhotoActivity> = {
  group: { type: "edit", goal: "치이카와 얼굴 한 곳 가리기", opinions: {
    chiikawa: cover("내 얼굴만 가려 주면 괜찮아…", "내 얼굴이 잘 보여서 조금 부끄러워… 얼굴이 안 보이면 마음이 편해.") } },
  snack: { type: "memory", goal: "함께 먹은 간식 추억 고르기", memory: "츄러스랑 아이스크림! 또 먹고 싶다. 이 사진도 올려 두자!" },
  funny: { type: "opinions", goal: "좋아하는 표정과 보여 주고 싶은 모습의 차이", opinions: {
    usagi: refuse("우! 이 표정은 올리지 말아 줘! 우리끼리만 보자!", "그 표정은 내가 올리고 싶은 모습이 아니야!") } },
  "EP01-P04": { type: "edit", goal: "회전목마의 두 친구 부탁 함께 반영", opinions: {
    chiikawa: cover("내 얼굴이 가까이 나왔네… 여기는 좀 가려 줄래?", "얼굴이 크게 보이니까… 조금 부끄러워. 가려 주면 좋겠어."),
    hachiware: cover("이 사진은 내 얼굴도 가려 줄래? 목마랑 같이 찍은 건 남기고 싶어!", "사진은 좋은데, 내 얼굴은 조금 쑥스러워. 얼굴 가리고 올리면 어떨까?") } },
  "EP01-P05": { type: "audience", goal: "놀이기구 사진을 보여 줄 사람 고르기", scopeFriend: "hachiware", approvals: { usagi: "야하! 한 번 더! 이 사진 올려!" } },
  "EP01-P06": { type: "memory", goal: "벤치에서 쉬던 순간 간직하기", memory: "여기 앉아서 쉬었지… 이 사진은 올려도 괜찮아." },
  "EP02-P01": { type: "edit", goal: "네 컷에 반복된 치이카와 얼굴 빠짐없이 가리기", opinions: {
    chiikawa: cover("네 군데 다 내 얼굴이 있네… 하나씩 가려 줄래?", "한 군데만 가려도 다른 컷에 얼굴이 보여서… 네 군데 다 가려 주면 좋겠어.") }, approvals: { hachiware: "난 좋아! 네 장 다 같이 올려 두자!", usagi: "야하! 네 컷 다 올려!" } },
  "EP02-P02": { type: "audience", goal: "단체 셀카의 공개 범위 판단", scopeFriend: "hachiware", approvals: { chiikawa: "으응… 이 셀카는 올려도 괜찮아.", usagi: "이 셀카 좋아! 올려!" } },
  "EP02-P03": { type: "opinions", goal: "친구마다 다른 장난스러운 셀카 의견", opinions: {
    chiikawa: refuse("으음… 이 표정은 좀 부끄러워. 이 사진은 우리끼리 간직할래.", "장난칠 땐 재미있었는데… 이 표정을 다른 사람들한테 보여 주기는 부끄러워.") }, approvals: { hachiware: "난 이 표정 마음에 들어! 올려도 좋아!", usagi: "야하! 내 표정 봐! 난 좋아!" } },
  "EP03-P01": { type: "edit", goal: "생일 단체사진에서 두 친구 얼굴 가리기", opinions: {
    chiikawa: cover("같이 찍어서 좋았어… 내 얼굴만 가려서 올려 줄래?", "사진은 남기고 싶은데… 내 얼굴이 보이면 조금 부끄러워."),
    usagi: cover("야하! 내 얼굴도 가려 줘! 그러면 좋아!", "얼굴은 가리고! 생일 사진은 남길래!") }, approvals: { hachiware: "좋아! 같이 축하한 사진이니까 남겨 두자!" } },
  "EP03-P02": { type: "audience", goal: "생일 주인공의 촛불 사진 공개 범위 판단", scopeFriend: "usagi" },
  "EP03-P03": { type: "opinions", goal: "선물 사진을 나누고 싶은 친구와 생일 주인공 의견 조율", subject: "usagi", opinions: {
    usagi: refuse("선물! 고마워! 선물 사진은 우리끼리만 간직하자!", "내 선물이야! 모두한테 보여 주고 싶진 않아!") } },
  "EP04-P01": { type: "edit", goal: "가린 사진 확인 후에도 게시 뒤 바뀐 마음에 대응", opinions: {
    chiikawa: cover("으응… 내 얼굴을 가려 주면 올려도 괜찮아.", "친구들이랑 찍은 건 좋은데… 얼굴은 안 보였으면 좋겠어.") }, approvals: { hachiware: "좋아! 다 같이 찍은 사진도 남겨야지!", usagi: "체육대회! 야하! 올려!" } },
  "EP04-P02": { type: "opinions", goal: "달리던 표정을 남길지 의견 조율", opinions: {
    chiikawa: refuse("열심히 뛰었는데… 이 표정은 마음에 안 들어. 이 사진은 올리지 말아 줘.", "내가 보여 주고 싶은 모습이 아니라서… 다른 사진을 골랐으면 좋겠어.") }, approvals: { usagi: "끝까지 달렸다! 난 좋아!" } },
  "EP04-P03": { type: "audience", goal: "응원 사진의 공유 대상 선택", scopeFriend: "hachiware" },
  "EP04-P04": { type: "memory", goal: "운동용품으로 하루 돌아보기", memory: "바통이랑 응원 도구까지! 이 사진 보니까 오늘 생각난다. 이것도 올려 두자!" },
};

export function activityOpinion(photo: string, friend: Character, audience: Audience): Opinion {
  const activity = photoActivities[photo];
  const fixed = activity?.opinions?.[friend];
  if (fixed) return fixed;
  if (activity?.scopeFriend === friend) return audience === "close"
    ? { condition: "yes", text: friend === "usagi" ? "친구들끼리? 야하! 좋아! 올려!" : "친구들끼리 보는 거면 좋아! 이대로 올려도 돼.", reason: friend === "usagi" ? "우리끼리 보는 건 좋아! 모르는 사람한텐 얼굴 보이기 싫어!" : "우리끼리 볼 땐 괜찮은데, 모르는 사람들한테까지 보여 주기는 쑥스러워." }
    : cover(friend === "usagi" ? "모르는 사람도 봐? 우… 그럼 내 얼굴은 가려 줘!" : "전체 공개구나! 그럼 내 얼굴은 가려 줄래?", friend === "usagi" ? "우리끼리 보는 건 좋아! 다 보는 거면 얼굴 가릴래!" : "친구들끼리는 괜찮아. 누구나 볼 수 있다면 얼굴은 가리고 싶어.");
  const approvals: Record<Character, string> = {
    chiikawa: "으응… 이 사진은 올려도 괜찮아.",
    hachiware: "좋아! 이 사진 올려도 돼!",
    usagi: "야하! 좋아! 올려!",
    maru: "응, 이 사진은 올려도 좋아.",
  };
  const reasons: Record<Character, string> = {
    chiikawa: "친구들이랑 같이 찍어서… 보면 기분이 좋아.",
    hachiware: "사진 보니까 같이 놀던 생각이 나! 이 모습은 남겨 두고 싶어.",
    usagi: "이 모습 마음에 들어! 나중에 또 볼래!",
    maru: "이 사진을 보면 함께한 시간이 생각날 것 같아.",
  };
  return { condition: "yes", text: activity?.memory ?? activity?.approvals?.[friend] ?? approvals[friend], reason: reasons[friend] };
}
