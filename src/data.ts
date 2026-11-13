import type {
  Character,
  PhotoId,
  Point,
  Game,
  Edit,
  Consent,
  EpisodeId,
} from "./model";
import photoAssets from "./photo-assets.json" with { type: "json" };
import { episodeIntro } from "./episodes";
import { assetPath } from "./asset-path";
export const characters: {
  id: Character;
  name: string;
  color: string;
  line: string;
}[] = [
  {
    id: "chiikawa",
    name: "치이카와",
    color: "#f5c9d3",
    line: "작은 마음도 소중하게",
  },
  {
    id: "hachiware",
    name: "하치와레",
    color: "#bfdae4",
    line: "함께라서 더 즐거워!",
  },
  { id: "usagi", name: "우사기", color: "#f5df9c", line: "야하! 신나는 하루!" },
  { id: "maru", name: "마루", color: "#d8d2bd", line: "내 속도로, 천천히" },
];
export const nameOf = (id: Character) =>
  characters.find((c) => c.id === id)!.name;
export const profile = (id: Character) => assetPath(`/assets/profiles/profile_${id}.png`);
export const introductions: Record<Character, string[]> = {
  chiikawa: [
    "아… 오늘 롯데월드, 정말 재미있었어.",
    "같이 찍은 사진도 이렇게 많네.",
    "친구들이랑 웃는 사진, SNS에 올리고 싶다…",
    "올리기 전에 친구들한테 먼저 물어봐야겠어.",
  ],
  hachiware: [
    "와, 오늘 롯데월드 정말 신났어!",
    "우리 같이 찍은 사진도 많이 남겼네.",
    "이 사진들 SNS에 올리면 또 이야기할 수 있겠다!",
    "좋아! 먼저 친구들한테 괜찮은지 물어보자.",
  ],
  usagi: [
    "야하! 오늘 롯데월드, 또 가고 싶어!",
    "사진도 잔뜩 찍었다! 내 표정 좀 봐!",
    "SNS에도 올리고 싶어!",
    "우라! 올리기 전에 친구들한테 먼저 물어볼래!",
  ],
  maru: [
    "오늘 롯데월드에서 같이 놀아서 좋았어.",
    "찍어 둔 사진을 보니 그때 생각이 나네.",
    "마음에 드는 사진을 SNS에 올리고 싶어.",
    "함께 나온 친구들은 어떨까? 먼저 물어봐야겠다.",
  ],
};
export interface Face {
  imageRatio?: number;
  friend: Character;
  center: Point;
  rx: number;
  ry: number;
  features: Point[];
}
const face = (
  friend: Character,
  x: number,
  y: number,
  rx: number,
  ry: number,
  features: number[][],
): Face => ({
  friend,
  center: { x, y },
  rx,
  ry,
  features: features.map(([x, y]) => ({ x, y })),
});
export interface PhotoDefinition {
  episode?: EpisodeId;
  width?: number;
  height?: number;
  crop?: { x: number; y: number; width: number; height: number };
  derivedFrom?: string;
  id: PhotoId;
  title: string;
  file: string;
  note: string;
  faces: Face[];
  kind: "group" | "food" | "portrait" | "scene";
  subject?: Character;
  conditions?: Partial<
    Record<
      Character,
      { close: Consent["condition"]; public: Consent["condition"] }
    >
  >;
  reactions?: Partial<Record<Character, string>>;
}
export const photos: PhotoDefinition[] = [
  {
    id: "group",
    kind: "group",
    title: "우리의 첫 단체사진",
    file: "/assets/photos/photo_01_lotteworld_group.png",
    note: "롯데월드 · 오후 2:14",
    faces: [
      face("chiikawa", 0.132, 0.701, 0.097, 0.102, [
        [0.122, 0.706],
        [0.18, 0.714],
        [0.145, 0.748],
      ]),
      face("hachiware", 0.356, 0.681, 0.095, 0.091, [
        [0.329, 0.666],
        [0.389, 0.676],
        [0.357, 0.718],
      ]),
      face("usagi", 0.59, 0.655, 0.097, 0.1, [
        [0.56, 0.635],
        [0.618, 0.648],
        [0.582, 0.678],
      ]),
      face("maru", 0.832, 0.68, 0.089, 0.089, [
        [0.797, 0.663],
        [0.878, 0.645],
        [0.844, 0.699],
        [0.843, 0.721],
      ]),
    ],
  },
  {
    id: "snack",
    kind: "food",
    title: "달콤했던 쉬는 시간",
    file: "/assets/photos/photo_02_snack.png",
    note: "롯데월드 · 오후 3:32",
    faces: [],
  },
  {
    id: "funny",
    kind: "portrait",
    subject: "usagi",
    title: "우사기의 결정적 순간",
    file: "/assets/photos/photo_03_usagi_funny.png",
    note: "롯데월드 · 오후 4:08",
    faces: [
      face("usagi", 0.563, 0.641, 0.149, 0.162, [
        [0.488, 0.59],
        [0.526, 0.675],
        [0.543, 0.606],
      ]),
    ],
  },
];
photos.push(
  ...photoAssets.map((p) => ({
    ...p,
    episode: p.episode as EpisodeId,
    kind: p.faces.length ? ("group" as const) : ("scene" as const),
    faces: p.faces as Face[],
  })),
);
for (const photo of photos) {
  photo.file = assetPath(photo.file);
  photo.episode ??= "EP01";
  photo.width ??= 1448;
  photo.height ??= 1086;
  photo.faces = photo.faces.map((f) => ({
    ...f,
    imageRatio: photo.height! / photo.width!,
  }));
}
export const episodePhotos = (game: Pick<Game, "episode">) =>
  photos.filter((p) => p.episode === (game.episode ?? "EP01"));
export const introLines = (game: Game) =>
  game.episode === "EP01"
    ? introductions[game.hero]
    : episodeIntro(game.episode, game.hero);
export const isRetiredPhoto = (id: string) =>
  ["castle-group", "castle-three", "castle-view"].includes(id);
export const photoById = (id: PhotoId): PhotoDefinition =>
  photos.find((p) => p.id === id) ??
  (isRetiredPhoto(id)
    ? {
        id,
        title: "제외된 사진",
        note: "이전 저장 기록",
        file: "",
        kind: "scene",
        faces: [],
        episode: "EP01",
        width: 1448,
        height: 1086,
      }
    : undefined)!;
export function imageInfo(
  game: Game,
  id: string,
): { photo: PhotoId; edits: Edit[] } {
  const version = game.versions.find((v) => v.id === id);
  return version
    ? { photo: version.photo, edits: version.edits }
    : { photo: id as PhotoId, edits: [] };
}
export function versionLabel(game: Game, id: string) {
  const index = game.versions.findIndex((v) => v.id === id);
  return index < 0 ? "원본" : `편집본 ${index + 1}`;
}
export const imageLabel = (game: Game, id: string) =>
  `${photoById(imageInfo(game, id).photo).title} · ${versionLabel(game, id)}`;
export function sharedPhotos(game: Game, room: Character | "group"): string[] {
  return (
    game.messages[room]
      .findLast((message) => message.from === "me" && message.photos?.length)
      ?.photos?.filter((id) => !isRetiredPhoto(imageInfo(game, id).photo)) ?? []
  );
}
export const specialStories: Record<
  Character,
  { text: string; respect: string; rush: string; reply: string }
> = {
  chiikawa: {
    text: "하치와레가 학급 소식에 쓸 사진을 고르고 있어. “네 사진을 써도 될까? 다른 친구들 사진도 있으면 좋겠다!”",
    respect: "내 얼굴은 가려 줘. 다른 친구들에게도 물어보자.",
    rush: "내 얼굴이 보이는 사진도 괜찮아.",
    reply: "“응! 친구들한테도 어떤 사진이 좋은지 물어볼게.” 하치와레가 답했어.",
  },
  hachiware: {
    text: "다른 반 친구가 메시지를 보냈어. “성 앞에서 찍은 단체사진, 우리 공개 계정에도 올려도 돼?”",
    respect: "잠깐! 같이 찍은 친구들한테 다시 물어볼게.",
    rush: "일단 보내고 나중에 물어볼까?",
    reply:
      "“아, 다른 곳에도 올라가는 거구나. 먼저 알려 줘서 고마워!” 친구들의 답장이 왔어.",
  },
  usagi: {
    text: "반 친구가 네 사진을 채팅 스티커로 만들고 싶대. “그 재미있는 표정, 써도 돼?”",
    respect: "야하! 어디서 쓸 건지 듣고 내가 고를래!",
    rush: "그 표정 마음에 들어! 스티커로 써도 좋아!",
    reply: "어디에 쓸지 듣고, 네가 마음에 드는 사진을 골랐어. “이걸로 만들자!”",
  },
  maru: {
    text: "하치와레가 말했어. “마루 사진은 따로 간직하고, SNS에는 간식 사진을 올리면 어떨까?”",
    respect: "좋아. 내 마음을 물어봐 줘서 고마워.",
    rush: "나도 나온 사진 중 편한 걸 같이 골라볼래.",
    reply:
      "“좋아, 간식 사진으로 하자!” 하치와레는 네가 고른 사진을 따로 챙겼어.",
  },
};

export function specialScene(game: Game) {
  const base = specialStories[game.hero];
  const lead = game.posts.some((p) => !p.deleted)
    ? "올린 사진을 돌아보며 집으로 가는 길. "
    : game.skipped
      ? "오늘 사진을 간직하기로 한 뒤, 집으로 가는 길. "
      : "사진에 대해 이야기를 나누고 집으로 가는 길. ";
  const responses: Record<Character, string> = {
    chiikawa:
      "“알겠어! 네가 고른 사진으로 할게. 다른 친구들 사진은 따로 물어보자.”",
    hachiware:
      "“잠깐, 아직 보내지 말자. 같이 나온 친구들에게 새로 보여 줄 곳을 먼저 물어보자.”",
    usagi: "“좋아! 네가 고른 그 사진으로 만들고, 말한 단체방에서만 쓸게.”",
    maru: "“좋아. 마루가 편한 사진을 같이 골라 보자. 네가 결정해 줘.”",
  };
  return {
    ...base,
    text: lead + base.text,
    friend:
      game.hero === "hachiware" ? ("maru" as const) : ("hachiware" as const),
    response: game.specialChoice === "rush" ? responses[game.hero] : base.reply,
  };
}
