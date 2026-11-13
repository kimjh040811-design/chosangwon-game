import type { Character, Consent } from "./model";
type Condition = Consent["condition"];
interface PhotoDialogue {
  reference: string;
  conditions: Partial<Record<Character, Condition>>;
  observations: Partial<Record<Character, string>>;
  observer: string;
}
export const photoDialogue: Record<string, PhotoDialogue> = {
  group: {
    reference: "성 앞에서 찍은 이 사진",
    conditions: {},
    observer: "성 앞에서 다 같이 찍었네.",
    observations: {
      chiikawa: "성 앞에서 모였을 때네… 다 같이 나온 사진이야.",
      hachiware: "성 앞에서 다 같이 웃었네! 또 생각난다.",
      usagi: "야하! 성 앞에서 찍은 사진!",
      maru: "같이 걸어 다녔던 시간이 생각나.",
    },
  },
  snack: {
    reference: "츄러스랑 아이스크림 사진",
    conditions: {},
    observer: "간식 먹으며 쉬던 시간이네.",
    observations: {
      chiikawa: "츄러스 맛있었어… 달콤한 냄새가 또 생각나.",
      hachiware: "와, 츄러스랑 아이스크림! 잠깐 쉬니까 더 맛있었지!",
      usagi: "츄러스! 또 먹고 싶어!",
      maru: "그늘에서 간식 먹으며 쉬니까 좋았어.",
    },
  },
  funny: {
    reference: "우사기 표정이 찍힌 이 사진",
    conditions: {},
    observer: "우사기 표정이 크게 찍혔네.",
    observations: {
      chiikawa: "우사기 표정이… 깜짝 놀랐어.",
      hachiware: "이 순간이 찍혔네! 우사기는 이 사진 어때?",
      usagi: "우… 내 표정이 이렇게 찍혔어?",
      maru: "찍힌 사람도 마음에 드는 사진이면 좋겠어.",
    },
  },
  "EP01-P04": {
    reference: "회전목마 앞에서 찍은 이 사진",
    conditions: { chiikawa: "cover", hachiware: "yes" },
    observer: "회전목마 불빛이 반짝이네.",
    observations: {
      chiikawa: "목마 뒤에서 불빛이 반짝였어…",
      hachiware: "회전목마 불빛이랑 우리 표정, 둘 다 잘 나왔네!",
      maru: "회전목마 앞에서 잠깐 멈춰 섰던 때구나.",
    },
  },
  "EP01-P05": {
    reference: "놀이기구에서 찍힌 이 사진",
    conditions: { hachiware: "cover", usagi: "yes" },
    observer: "타고 있을 때 표정이 찍혔네.",
    observations: {
      hachiware: "나 엄청 놀랐네! 그때 꽉 잡고 있었어.",
      usagi: "야하! 난 신났어! 한 번 더 타고 싶다!",
    },
  },
  "EP01-P06": {
    reference: "벤치에서 쉬던 이 사진",
    conditions: { chiikawa: "cover" },
    observer: "벤치에서 쉬던 때네. 조용해서 좋았어.",
    observations: {
      chiikawa: "벤치에 앉으니까 편했어…",
      maru: "잠깐 쉬면서 이야기하던 시간이 좋았어.",
    },
  },
  "EP02-P01": {
    reference: "같이 찍은 네 컷 사진",
    conditions: { chiikawa: "cover", hachiware: "yes", usagi: "yes" },
    observer: "네 컷마다 표정이 달라서 보는 재미가 있네.",
    observations: {
      chiikawa: "네 컷에 내 얼굴이 다 있네… 표정도 조금씩 달라.",
      hachiware: "난 두 번째 컷이 좋아! 찍을 때 자꾸 웃음이 났어.",
      usagi: "네 번 찍었다! 표정도 네 가지!",
      maru: "한 장 안에 같이 찍은 순간이 네 번 담겼네.",
    },
  },
  "EP02-P02": {
    reference: "가까이 모여 찍은 이 셀카",
    conditions: { chiikawa: "yes", hachiware: "yes", usagi: "yes" },
    observer: "다들 가까이 모여서 찍었네.",
    observations: {
      chiikawa: "이 셀카는 마음에 들어… 표정이 잘 보이네.",
      hachiware: "우리 화면에 꽉 찼네! 같이 모여서 찍으니까 좋다.",
      usagi: "다 같이 꽉! 이 셀카 좋아!",
      maru: "가까이 모여 있으니 표정이 잘 보이네.",
    },
  },
  "EP02-P03": {
    reference: "장난치면서 찍은 이 셀카",
    conditions: { chiikawa: "yes", hachiware: "yes", usagi: "yes" },
    observer: "세 친구 표정이 다 다르네.",
    observations: {
      chiikawa: "장난치다가 찍혔네… 내 표정 좀 봐.",
      hachiware: "각자 장난친 표정이 달라서 재미있어!",
      usagi: "야하! 다음엔 다른 표정도 찍자!",
    },
  },
  "EP03-P01": {
    reference: "생일 케이크 앞에서 같이 찍은 이 사진",
    conditions: { chiikawa: "yes", hachiware: "yes", usagi: "yes" },
    observer: "같이 생일 축하했던 사진이네.",
    observations: {
      chiikawa: "다 같이 축하해서 좋았어… 우사기도 웃고 있네.",
      hachiware: "우사기 생일을 같이 축하해서 더 좋았어!",
      usagi: "내 생일! 다 같이 모였다!",
      maru: "케이크 앞에 모여 축하하던 시간이 생각나.",
    },
  },
  "EP03-P02": {
    reference: "우사기가 촛불을 부는 이 사진",
    conditions: { usagi: "yes" },
    observer: "우사기가 촛불 부는 순간이네.",
    observations: {
      chiikawa: "촛불이 옆으로 기울었어… 우사기 열심히 불었네.",
      hachiware: "촛불 끄는 순간이 딱 찍혔네! 생일 축하해!",
      usagi: "야하! 내가 촛불 끄는 사진! 마음에 들어!",
      maru: "촛불 끄는 순간까지 남았네. 좋은 생일 추억이야.",
    },
  },
  "EP03-P03": {
    reference: "생일 케이크랑 선물 사진",
    conditions: {},
    observer: "케이크랑 선물이 담겼네.",
    observations: {
      chiikawa: "케이크 예뻤어… 같이 나눠 먹으니까 좋았어.",
      hachiware: "케이크랑 선물 보니까 축하하던 시간이 생각나!",
      usagi: "내 생일 케이크! 선물도 있다!",
      maru: "케이크와 선물이 한 장에 모였네. 축하한 마음이 담긴 것 같아.",
    },
  },
  "EP04-P01": {
    reference: "체육대회에서 같이 찍은 이 사진",
    conditions: { chiikawa: "cover", hachiware: "yes", usagi: "yes" },
    observer: "체육대회 끝나고 같이 모였네.",
    observations: {
      chiikawa: "다 같이 찍었네… 많이 뛰어서 힘들었어.",
      hachiware: "뛰고 응원한 다음에 모였지! 다들 수고했어!",
      usagi: "다 같이 찰칵! 체육대회 신났다!",
      maru: "경기도 응원도 끝나고 모였을 때구나.",
    },
  },
  "EP04-P02": {
    reference: "달리는 순간이 찍힌 이 사진",
    conditions: { chiikawa: "cover", usagi: "yes" },
    observer: "트랙에서 달리는 순간이 찍혔네.",
    observations: {
      chiikawa: "나 진짜 열심히 뛰었네…",
      usagi: "야하! 결승선까지 쌩!",
    },
  },
  "EP04-P03": {
    reference: "응원하던 순간이 찍힌 이 사진",
    conditions: { hachiware: "cover" },
    observer: "옆에서 열심히 응원하고 있었네.",
    observations: {
      hachiware: "나 깃발 들고 응원하고 있었네! 목소리도 컸을 거야.",
      maru: "손을 들고 응원하던 순간이 찍혔구나.",
    },
  },
  "EP04-P04": {
    reference: "운동장에 놓인 물품 사진",
    conditions: {},
    observer: "공이랑 바통, 응원 물품이 모였네.",
    observations: {
      chiikawa: "바통이랑 공이네… 오늘 많이 뛰었어.",
      hachiware: "응원 물품까지 모였네! 체육대회 생각난다.",
      usagi: "바통! 공! 달릴 때 생각난다!",
      maru: "운동장에 놓인 물품만 봐도 오늘이 생각나.",
    },
  },
};
export function photoImpression(id: string, friend: Character) {
  const photo = photoDialogue[id];
  return (
    photo?.observations[friend] ??
    photo?.observer ??
    "이 사진을 보니까 그때가 생각나."
  );
}
export function photoReference(id: string, hero?: Character) {
  if (hero === "usagi" && id === "EP03-P02") return "내가 촛불을 부는 이 사진";
  if (hero === "usagi" && id === "funny") return "내 표정이 찍힌 이 사진";
  return photoDialogue[id]?.reference ?? "이 사진";
}
export function temporaryPhotoReply(
  id: string,
  friend: Character,
  condition: Condition,
  safe: boolean,
) {
  const impression = photoImpression(id, friend);
  if (condition === "cover") {
    if (safe)
      return friend === "chiikawa"
        ? "으응… 내 얼굴이 모두 안 보이네. 이 사진이면 좋아."
        : "내 얼굴이 안 보이니까 마음이 편하다. 이 사진은 올려도 좋아!";
    return friend === "chiikawa"
      ? `${impression} 얼굴은 좀 부끄러워. 가려 줄 수 있어?`
      : `${impression} 이 사진은 내 얼굴을 가린 뒤 올려 줘.`;
  }
  const permission: Record<Character, string> = {
    chiikawa: "응… 이 사진은 올려도 좋아.",
    hachiware: "응! 이 사진 올려도 좋아!",
    usagi: "난 좋아! 올려!",
    maru: "응, 이 사진은 나눠도 괜찮아.",
  };
  return `${impression} ${permission[friend]}`;
}
