export type Character = "chiikawa" | "hachiware" | "usagi" | "maru";
export type PhotoId = string;
export type EpisodeId = "EP01" | "EP02" | "EP03" | "EP04";
export type Audience = "public" | "close";
export type Screen = "home" | "album" | "chat" | "sns" | "notifications";
export interface Point {
  x: number;
  y: number;
}
export type Edit =
  | { kind: "brush"; points: Point[]; size: number }
  | { kind: "sticker"; x: number; y: number; size: number; symbol: string };
export interface Version {
  id: string;
  photo: PhotoId;
  edits: Edit[];
  deleted: boolean;
  created: string;
}
export interface Message {
  id: string;
  from: Character | "me";
  text: string;
  read: boolean;
  actor?: Character;
  issueId?: string;
  purpose?:
    | "request"
    | "followup"
    | "decision"
    | "consent"
    | "reply"
    | "reaction"
    | "photo_question"
    | "memory";
  postId?: string;
  photos?: string[];
  photoId?: string;
}
export type ReplyKind =
  | "topic"
  | "ask"
  | "show"
  | "cover"
  | "keepPhoto"
  | "otherPhoto"
  | "why"
  | "apology"
  | "respect"
  | "insist";
export type StoryPhase =
  | "intro"
  | "first_contact"
  | "consent_discussion"
  | "decision"
  | "consequence"
  | "resolution"
  | "special_event"
  | "ending";
export type ConversationState =
  | "unasked"
  | "requesting"
  | "approved"
  | "conditional"
  | "refused"
  | "reask_ready"
  | "reasked"
  | "issue"
  | "withdrawal"
  | "resolving"
  | "resolved";
export interface ReplyOption {
  kind: ReplyKind;
  text: string;
}
export interface PendingMessage {
  room: Character | "group";
  from: Character;
  text: string;
  issueId?: string;
  purpose?: Message["purpose"];
  consent?: Consent;
  consents?: Consent[];
  postId?: string;
  photoId?: string;
}
export interface Consent {
  friend: Character;
  photo: PhotoId;
  audience: Audience;
  condition: "yes" | "cover" | "no";
  asset?: string;
  valid?: boolean;
  reasked?: boolean;
}
export interface Post {
  id: string;
  author?: Character;
  caption: string;
  photos: string[];
  audience: Audience;
  deleted: boolean;
  comments: { friend: Character; text: string; photoId?: string }[];
  originalPhotos?: string[];
}
export interface Issue {
  id: string;
  post: string;
  photo: string;
  friend: Character;
  resolved: boolean;
  withdrawal: boolean;
  notified?: boolean;
  read?: boolean;
  decision?: "remove" | "keep";
  followedUp?: boolean;
  conversationClosed?: boolean;
}
export interface Notice {
  id: string;
  text: string;
  read: boolean;
  room?: Character | "group";
}
export interface PhotoRound {
  photo: PhotoId;
  asset: string;
  outcome: "active" | "posted" | "removed" | "kept" | "changed" | "unresolved";
}
export interface PhotoReview {
  asset: string;
  sent: string[];
  asked: string[];
  why: Character[];
  decision: "include" | "keep" | null;
}
export interface EpisodeReview {
  policyVersion?: number;
  enabled: boolean;
  phase: "select" | "photo" | "preview" | "published";
  current: PhotoId | null;
  photos: Record<PhotoId, PhotoReview>;
  audience: Audience;
  caption: string;
  audienceChosen?: boolean;
  changedScopePhotos?: string[];
  publication: Record<PhotoId, { asset: string; permitted: boolean }>;
  originalHero?: Character;
  activeIssue?: string;
  notice: string;
}
export interface Game {
  schema: 1;
  revision: 8;
  review: EpisodeReview;
  episode: EpisodeId;
  episodes: Partial<Record<EpisodeId, EpisodeProgress>>;
  photoFlow: {
    current: number | null;
    rounds: PhotoRound[];
    result: boolean;
  };
  story: {
    viewed: PhotoId[];
    decision: "undecided" | "share" | "keep";
    resultSeen: boolean;
    phase: StoryPhase;
    introLine: number;
    firstContact: boolean;
    topicStarted: boolean;
    photoPromptSeen: boolean;
    opinionsSeen: boolean;
    photoChoices: Partial<Record<PhotoId, "share" | "keep">>;
  };
  editorDraft: {
    source: string;
    photo: PhotoId;
    edits: Edit[];
    open?: boolean;
  } | null;
  hero: Character;
  stage: "intro" | "play" | "special" | "ending" | "stageComplete";
  screen: Screen;
  room: Character | "group" | null;
  maruAllows: boolean;
  versions: Version[];
  consents: Consent[];
  messages: Record<Character | "group", Message[]>;
  chatRequests: Record<Character | "group", string[]>;
  posts: Post[];
  issues: Issue[];
  trust: Record<Character, number>;
  history: string[];
  notices: Notice[];
  pending: PendingMessage[];
  everProblem: boolean;
  apologized: Character[];
  skipped: boolean;
  specialChoice: string | null;
  ending: "good" | "recovery" | "unresolved" | null;
  speed: number;
  withdrawalDone: boolean;
  withdrawalPlan: { enabled: boolean; friend: Character };
  chatTarget: { photo: string; audience: Audience } | null;
  events: {
    id: string;
    type:
      | "legacy"
      | "contact"
      | "edit"
      | "post"
      | "scope"
      | "remove-photo"
      | "delete-post"
      | "decision"
      | "special";
    text: string;
    photos: string[];
    audience?: Audience;
    post?: string;
  }[];
  specialResult: {
    reply: string;
    friend: Character;
    reconsidered: boolean;
  } | null;
}
export type EpisodeSnapshot = Omit<Game, "episode" | "episodes">;
export interface EpisodeProgress {
  completed: boolean;
  state: EpisodeSnapshot;
}
