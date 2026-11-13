import type { EpisodeId, Character } from "./model";
export interface EpisodeDefinition {
  id: EpisodeId;
  title: string;
  intro: string[];
  topic: string;
  date: string;
  objectReaction: string;
}
export const episodes: EpisodeDefinition[] = [
  {
    id: "EP01",
    title: "롯데월드",
    intro: [],
    topic: "",
    date: "롯데월드에 다녀온 날",
    objectReaction: "그때 생각이 난다!",
  },
  {
    id: "EP02",
    title: "스티커 사진과 셀카",
    intro: [
      "친구들이랑 스티커 사진을 찍었어.",
      "네 컷마다 표정이 조금씩 다르네.",
      "셀카도 함께 골라서 SNS에 남기고 싶어.",
      "어떤 사진이 마음에 드는지 친구들에게 물어보자.",
    ],
    topic: "오늘 찍은 스티커 사진이랑 셀카, SNS에 올리고 싶어!",
    date: "함께 사진을 찍은 날",
    objectReaction: "사진 찍으며 웃었던 시간이 생각나.",
  },
  {
    id: "EP03",
    title: "우사기의 생일파티",
    intro: [
      "오늘은 우사기의 생일파티를 했어.",
      "촛불을 끄는 순간도 사진에 남았네.",
      "다 같이 축하한 시간을 SNS에도 남기고 싶어.",
      "친구들이 좋아하는 사진을 같이 골라 보자.",
    ],
    topic: "우사기 생일파티 사진을 SNS에 올리고 싶어. 같이 골라 볼까?",
    date: "우사기의 생일",
    objectReaction: "케이크랑 선물! 생일 축하했던 시간이 생각나.",
  },
  {
    id: "EP04",
    title: "체육대회",
    intro: [
      "오늘 체육대회에서 같이 뛰고 응원했어.",
      "사진을 보니 함성 소리가 또 들리는 것 같아.",
      "친구들과 함께한 순간을 SNS에 남기고 싶어.",
      "어떤 사진을 나누면 좋을지 이야기해 보자.",
    ],
    topic: "체육대회 사진을 SNS에 올리고 싶어. 우리 같이 볼까?",
    date: "체육대회가 끝난 날",
    objectReaction: "운동장에 두고 온 물품들이네. 오늘 즐거웠어!",
  },
];
export const episodeById = (id: EpisodeId) =>
  episodes.find((e) => e.id === id)!;
export const nextEpisode = (id: EpisodeId) =>
  episodes[episodes.findIndex((e) => e.id === id) + 1];

const heroStories: Record<
  Exclude<EpisodeId, "EP01">,
  Record<Character, { intro: string[]; topic: string }>
> = {
  EP02: {
    chiikawa: {
      intro: [
        "친구들이랑 사진 찍으러 갔어…",
        "네 컷마다 표정이 조금씩 다르네.",
        "이 셀카는 마음에 들어. SNS에도 남겨 볼까…",
        "친구들이 좋아하는 사진도 궁금해.",
      ],
      topic: "저기… 같이 찍은 네 컷 사진이랑 셀카, SNS에 올리고 싶어.",
    },
    hachiware: {
      intro: [
        "우리 같이 스티커 사진을 찍었어!",
        "네 번 찍을 때마다 자꾸 웃음이 났네.",
        "난 이 셀카도 좋아. 다른 친구들은 어떨까?",
        "좋아! 마음에 드는 사진을 같이 골라 보자.",
      ],
      topic:
        "얘들아! 네 컷 사진이랑 셀카 중에 어떤 게 좋아? SNS에 남기고 싶어!",
    },
    usagi: {
      intro: [
        "사진 네 번! 표정도 네 가지!",
        "셀카도 찍었다! 내 표정 봐!",
        "이 중에 마음에 드는 걸 SNS에 올리고 싶어!",
        "친구들은 어떤 게 좋을까?",
      ],
      topic: "네 컷 사진! 셀카! SNS에 올릴 사진 같이 고르자!",
    },
    maru: {
      intro: [
        "다 같이 스티커 사진과 셀카를 찍었어.",
        "같은 날 찍어도 사진마다 느낌이 다르네.",
        "친구들이 편하게 느끼는 사진은 어떤 걸까?",
        "좋아하는 사진을 함께 골라 SNS에도 남겨 보고 싶어.",
      ],
      topic:
        "같이 찍은 사진을 보고 있었어. 서로 마음에 드는 걸 골라서 SNS에 남겨 볼까?",
    },
  },
  EP03: {
    chiikawa: {
      intro: [
        "우사기의 생일을 같이 축하했어…",
        "케이크 앞에서 다 같이 웃었네.",
        "이 사진을 보면 축하하던 때가 생각날 것 같아.",
        "우사기랑 친구들은 어떤 사진이 좋을까?",
      ],
      topic: "우사기 생일 때 찍은 사진… SNS에 남기고 싶은데, 같이 볼래?",
    },
    hachiware: {
      intro: [
        "오늘은 우사기 생일파티를 했어!",
        "촛불 부는 순간까지 사진에 남았네.",
        "다 같이 축하해서 더 좋았어. SNS에도 남기고 싶다!",
        "우사기랑 친구들이 좋아하는 사진을 골라 보자.",
      ],
      topic:
        "우사기야, 생일 축하해! 파티 사진 SNS에 남기고 싶은데, 다 같이 골라 볼까?",
    },
    usagi: {
      intro: [
        "오늘은 내 생일이었어!",
        "케이크! 선물! 친구들이 다 같이 축하해 줬어!",
        "촛불 끄는 사진도 있다! SNS에 남기고 싶어!",
        "다 같이 나온 사진은 친구들 생각도 들어 볼래!",
      ],
      topic: "내 생일파티 사진! 같이 축하한 거 SNS에도 남기고 싶어!",
    },
    maru: {
      intro: [
        "우사기 생일을 함께 축하했어.",
        "케이크와 선물, 같이 모였던 얼굴들이 담겼네.",
        "축하한 기억을 사진으로 나누면 좋겠어.",
        "우사기가 좋아하는 사진도 같이 골라 보자.",
      ],
      topic:
        "생일파티 사진을 보니 축하하던 시간이 생각나. SNS에 나눌 사진을 같이 볼까?",
    },
  },
  EP04: {
    chiikawa: {
      intro: [
        "체육대회에서 많이 뛰었어…",
        "친구들이 응원하던 모습도 찍혔네.",
        "이 사진 보니까 조금 뿌듯해.",
        "어떤 사진을 SNS에 남길지 같이 이야기해 볼까…",
      ],
      topic: "체육대회 사진을 봤어… 뛰던 사진이랑 응원 사진, 같이 골라 볼래?",
    },
    hachiware: {
      intro: [
        "오늘 체육대회, 정말 열심히 뛰고 응원했어!",
        "달리는 표정이랑 응원하는 표정이 다 다르네.",
        "우리 같이 힘냈던 걸 SNS에도 남기고 싶어.",
        "마음에 드는 사진을 친구들과 골라 보자!",
      ],
      topic: "다들 수고했어! 뛰고 응원한 사진 중에 SNS에 올릴 걸 같이 볼까?",
    },
    usagi: {
      intro: [
        "달렸다! 응원도 했다!",
        "사진 속에서도 신나게 뛰고 있네!",
        "같이 힘낸 사진을 SNS에 올리고 싶어!",
        "친구들은 어떤 순간이 좋았을까?",
      ],
      topic: "달린 사진! 응원한 사진! 체육대회 추억 같이 고르자!",
    },
    maru: {
      intro: [
        "체육대회에서 같이 뛰고 응원했어.",
        "경기와 응원, 서로 다른 순간이 사진에 담겼네.",
        "함께 힘냈던 기억을 나누고 싶어.",
        "각자 편하게 느끼는 사진을 골라 보자.",
      ],
      topic:
        "체육대회 사진이 모였네. 뛰고 응원한 순간을 SNS에 어떻게 남길지 같이 볼까?",
    },
  },
};
export const episodeIntro = (
  episode: Exclude<EpisodeId, "EP01">,
  hero: Character,
) => heroStories[episode][hero].intro;
export const episodeTopic = (
  episode: Exclude<EpisodeId, "EP01">,
  hero: Character,
) => heroStories[episode][hero].topic;
