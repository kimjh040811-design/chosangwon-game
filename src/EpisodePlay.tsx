import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Expand, Home, Send, Maximize, Minimize } from "lucide-react";
import type { Action } from "./engine";
import type { Game, Post } from "./model";
import { episodePhotos, imageInfo, imageLabel, nameOf, photoById, profile } from "./data";
import { episodeById } from "./episodes";
import { replyOptions } from "./dialogue";
import { currentRequests, currentReview, reviewedCount, reviewSelection, needsScopeConfirmation } from "./review";
import { ChatHistory } from "./Chat";
import Editor from "./Editor";
import Photo from "./Photo";
import { usePlayFocus } from "./usePlayFocus";
import { GameAudioControls } from "./GameAudio";

type Dispatch = (action: Action) => void;

function startEditing(game: Game, dispatch: Dispatch, photo: string, action: Action) {
  const draft = game.editorDraft;
  if (draft && draft.photo !== photo && draft.edits.length && !window.confirm("편집 중인 다른 사진의 초안이 있어요. 새 사진을 편집하면 그 초안이 바뀌어요. 계속할까요?")) return;
  dispatch(action);
}

function PhotoImage({ game, id }: { game: Game; id: string }) {
  const image = imageInfo(game, id);
  return <Photo photo={image.photo} edits={image.edits} label={imageLabel(game, id)} />;
}

function ReplyWait({ game, dispatch }: { game: Game; dispatch: Dispatch }) {
  return game.pending.length > 0 && (
    <button className="reply-wait" onClick={() => dispatch({ type: "reviewReplies" })}>
      {nameOf(game.pending[0].from)}의 답장이 오고 있어요. 바로 읽기
    </button>
  );
}

function PublishedPost({ game, post, dispatch }: { game: Game; post: Post; dispatch: Dispatch }) {
  const author = post.author ?? game.hero;
  return (
    <article className="review-post" aria-label="SNS 게시물">
      <header><img className="avatar" src={profile(author)} alt={nameOf(author)} /><div><strong>{nameOf(author)}</strong><small>{post.audience === "close" ? "친한 친구" : "전체 공개"}</small></div></header>
      {post.deleted ? <p className="removed-post">이 게시물을 내렸어요.</p> : (
        <>
          <div className="batch-photos">
            {post.photos.map((id) => <figure key={id}><PhotoImage game={game} id={id} /><figcaption>{imageLabel(game, id)}</figcaption>
              <button aria-label={`${imageLabel(game, id)} 게시 사진 삭제`} onClick={() => dispatch({ type: "removePhoto", post: post.id, photo: id })}>이 사진만 내리기</button>
            </figure>)}
          </div>
          <p className="post-caption">{post.caption}</p>
          <div className="review-comments">{post.comments.filter((c) => !c.photoId || post.photos.includes(c.photoId)).map((comment, index) =>
            <p key={index}>{comment.photoId && <small className="comment-photo-name">{imageLabel(game, comment.photoId)}</small>}<strong>{nameOf(comment.friend)}</strong> {comment.text}</p>)}</div>
          <button className="text-button" onClick={() => dispatch({ type: "deletePost", id: post.id })}>게시물 전체 내리기</button>
        </>
      )}
    </article>
  );
}

function Requests({ game, dispatch }: { game: Game; dispatch: Dispatch }) {
  const detail = useRef<HTMLDivElement>(null);
  useEffect(() => { detail.current?.scrollIntoView({ block: "start" }); }, [game.review.activeIssue]);
  const issue = game.issues.find((i) => i.id === game.review.activeIssue);
  const post = issue && game.posts.find((p) => p.id === issue.post);
  const options = issue && !issue.resolved ? replyOptions(game, issue.friend, issue.photo) : [];
  return (
    <section className="review-requests" aria-label="게시 후 친구의 부탁">
      <h2>친구의 부탁 <span>{game.issues.filter((i) => !i.resolved).length}개 남음</span></h2>
      <div className="request-list">
        {game.issues.map((item) => <button key={item.id} aria-pressed={item.id === issue?.id} className={item.resolved ? "resolved" : ""}
          onClick={() => dispatch({ type: "reviewOpenIssue", id: item.id })}>
          <img className="avatar small" src={profile(item.friend)} alt="" />
          <span>{nameOf(item.friend)} · {imageLabel(game, item.photo)}<small>{item.resolved ? "사진을 다시 살폈어요" : item.decision === "remove" ? "삭제 약속 · 사진은 아직 게시 중" : "사진을 내려 달라는 부탁"}</small></span>
        </button>)}
      </div>
      {issue && <div ref={detail} className="issue-detail" data-issue-id={issue.id}>
        <div className="issue-photo"><PhotoImage game={game} id={issue.photo} /><div><strong>{imageLabel(game, issue.photo)}</strong><p>{post && !post.deleted && post.photos.includes(issue.photo) ? "SNS에 올라가 있는 사진이에요." : "SNS에서 내린 사진이에요."}</p></div></div>
        {!issue.resolved && episodePhotos(game).some((p) => p.id === imageInfo(game, issue.photo).photo) && <button disabled={Boolean(game.pending.length)} onClick={() => startEditing(game, dispatch, imageInfo(game, issue.photo).photo, { type: "reviewEditPosted", photo: issue.photo })}>사진첩에 새 편집본 만들기</button>}
        <ChatHistory game={game} room={issue.friend} current={imageInfo(game, issue.photo).photo} />
        <ReplyWait game={game} dispatch={dispatch} />
        <div className="issue-actions">
          {options.map((option) => <button key={option.kind} disabled={Boolean(game.pending.length)} className={`reply-${option.kind}`} onClick={() => dispatch({ type: "reply", room: issue.friend, kind: option.kind, photo: issue.photo })}>{option.text}</button>)}
          {!issue.resolved && <button className="primary" disabled={Boolean(game.pending.length)} onClick={() => dispatch({ type: "removePhoto", post: issue.post, photo: issue.photo })}>요청받은 이 사진 내리기</button>}
        </div>
      </div>}
    </section>
  );
}

export default function EpisodePlay({ game, dispatch, saveError }: { game: Game; dispatch: Dispatch; saveError?: string }) {
  const focus = usePlayFocus();
  const [enlarged, setEnlarged] = useState(false);
  const audience = game.review.audience;
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const caption = game.review.caption;
  const [more, setMore] = useState(false);
  const actions = useRef<HTMLDivElement>(null);
  const [choicesVisible, setChoicesVisible] = useState(true);
  const record = currentReview(game);
  const photos = episodePhotos(game);
  const selected = reviewSelection(game);
  const scopeChanges = (game.review.changedScopePhotos ?? []).filter((id) => game.review.photos[id]?.decision === "include");
  const pending = game.pending.length > 0;
  const requests = record ? currentRequests(game, record.asset) : [];
  const blockers = requests.filter((r) => r.condition !== "yes");
  const requestText = record?.asked.length
    ? blockers.map((r) => `${nameOf(r.friend)} — ${r.text}`).join(" ") || "친구들에게 보여 주고 싶은 모습으로 편집해 보세요."
    : "아직 친구의 의견을 듣기 전이에요. 편집한 사진을 친구들에게 보여 줄 수 있어요.";
  const isPhoto = game.review.phase === "photo" && record;
  const draft = game.editorDraft;
  const postedOriginal = record && game.posts.filter((p) => !p.deleted).flatMap((p) => p.photos)
    .find((id) => id !== record.asset && imageInfo(game, id).photo === game.review.current);
  useEffect(() => { setPhotoExpanded(!record?.sent.length); setMore(false); }, [game.review.current]);
  useEffect(() => {
    if (!actions.current) return;
    const observer = new IntersectionObserver(([entry]) => setChoicesVisible(entry.isIntersecting && entry.intersectionRatio >= 0.2), {
      threshold: 0.2, rootMargin: "0px 0px -72px 0px",
    });
    observer.observe(actions.current);
    return () => observer.disconnect();
  }, [game.review.phase]);
  return (
    <main ref={focus.root} className={`review-game${focus.focused ? " play-focus" : ""}`}>
      <header className="review-header">
        <button className="icon-button" aria-label="홈" onClick={() => dispatch({ type: "reviewPreview" })}><Home size={21} /></button>
        <div className="review-title"><small>{game.episode} · {episodeById(game.episode).title}</small><h1>함께 남길 사진</h1></div>
        <span className="review-progress" aria-label="사진 검토 진행">{reviewedCount(game)} / {photos.length}<small>사진 검토</small></span>
        <GameAudioControls />
        <button className="play-focus-toggle" aria-label={focus.focused ? "기본 화면으로 돌아가기" : "플레이 화면 크게 보기"}
          aria-pressed={focus.focused} disabled={focus.busy} title={focus.focused ? "기본 화면으로 돌아가기 (Esc)" : "게임만 전체화면으로 크게 보기"} onClick={() => void focus.toggle()}>
          {focus.focused ? <Minimize size={20} /> : <Maximize size={20} />}
          {focus.focused ? <>작게<span className="focus-label-detail"> 보기</span></> : <>크게<span className="focus-label-detail"> 보기</span></>}
        </button>
      </header>
      {saveError && <p role="alert" className="save-error">{saveError}</p>}
      {focus.note && <p className={focus.note.startsWith("Esc") ? "focus-note" : "focus-announcement"} role="status">{focus.note}</p>}
      {game.review.notice && <p className="review-notice" role="status">{game.review.notice}</p>}
      {game.review.phase === "select" && !game.review.audienceChosen && <section className="audience-choice" aria-label="이번 만남의 공개 범위 선택">
        <h2>오늘 사진은 누구와 나눌까?</h2><p>이 범위에 맞춰 친구들에게 물어봐요. 게시 전에도 바꿀 수 있어요.</p>
        <button className="primary" onClick={() => dispatch({ type: "reviewAudience", audience: "close" })}>친한 친구 공개로 시작</button>
        <button onClick={() => dispatch({ type: "reviewAudience", audience: "public" })}>전체 공개로 시작</button>
      </section>}
      <p className="scope-indicator">{focus.focused && "확대 모드 · "}이번 만남 · {audience === "close" ? "친한 친구 공개" : "전체 공개"}</p>
      {game.review.phase === "select" && <section className="review-album" aria-label="이번 만남의 사진">
        <h2>어떤 사진부터 같이 볼까?</h2>
        <p>사진을 모두 살펴본 뒤, 담아 둔 사진을 한 번에 올려요.</p>
        <ReplyWait game={game} dispatch={dispatch} />
        <div className="review-photo-grid">{photos.map((photo) => {
          const entry = game.review.photos[photo.id];
          return <button key={photo.id} aria-label={`${photo.title} 살펴보기`} disabled={pending || game.review.audienceChosen === false} onClick={() => { setMore(false); dispatch({ type: "reviewSelect", photo: photo.id }); }}>
            <Photo photo={photo.id} /><strong>{photo.title}</strong><span>{entry?.decision === "keep" ? "사진첩에 보관" : entry?.decision === "include" ? "게시 목록에 담음" : entry?.sent.length ? "이야기하던 사진" : "함께 살펴보기"}</span>
          </button>;
        })}</div>
        {reviewedCount(game) === photos.length && <button className="primary full" onClick={() => dispatch({ type: "reviewPreview" })}>게시 목록 보기 <ArrowRight size={18} /></button>}
      </section>}

      {isPhoto && <div className={`review-workspace ${photoExpanded ? "photo-expanded" : "chat-focused"}`}>
        <section className="review-photo-panel" aria-label="현재 검토 사진">
          <div className="review-photo-heading"><h2>{photoById(game.review.current!).title}</h2><span>{record.asset === game.review.current ? "원본" : "편집본"}</span></div>
          <button className="review-main-photo" aria-label="현재 사진 크게 보기" onClick={() => setEnlarged(true)}><PhotoImage game={game} id={record.asset} /><Expand size={20} /></button>
          <button className="photo-view-toggle" aria-expanded={photoExpanded} onClick={() => setPhotoExpanded(!photoExpanded)}>{photoExpanded ? "사진 접고 대화 넓게 보기" : "사진 펼쳐서 확인하기"}</button>
          {record.asked.length > 0 && <p className="compact-request">{blockers.length ? blockers.map((r) => `${nameOf(r.friend)}: ${r.condition === "no" ? "게시 원하지 않음" : r.hidden ? r.confirmed ? "편집본 확인 완료" : "가림 확인 필요" : "얼굴 가리기"}`).join(" · ") : "친구들과 나누고 싶은 추억이에요."}</p>}
          {record.asked.length > 0 && <aside className="friend-requests" aria-label="현재 사진에 대한 친구 의견">
            {requests.length ? <>{blockers.map((request) => <div key={request.friend}>
              <img className="avatar small" src={profile(request.friend)} alt="" />
              <div><strong>{nameOf(request.friend)}</strong><p>{request.text}</p><small>{request.condition === "no" ? "게시를 원하지 않아요" : request.condition === "cover" ? request.hidden ? request.confirmed ? "이 편집본을 확인했어요" : "얼굴 가림 · 편집본 확인 전" : "얼굴 가림을 부탁했어요" : request.confirmed ? "사진을 확인하고 동의했어요" : "현재 편집본 확인 전"}</small></div>
            </div>)}{requests.some((r) => r.condition === "yes" && r.confirmed) && <p className="approved-friends">{requests.filter((r) => r.condition === "yes" && r.confirmed).map((r) => nameOf(r.friend)).join(" · ")} — 이 사진을 확인하고 동의했어요.</p>}{requests.some((r) => r.condition === "yes" && !r.confirmed) && <p className="unconfirmed-friends">{requests.filter((r) => r.condition === "yes" && !r.confirmed).map((r) => nameOf(r.friend)).join(" · ")} — 지금 사진은 아직 확인 전이에요.</p>}</> : <p>사람이 나오지 않는 사진이에요. 친구들과 추억을 나눴어요.</p>}
          </aside>}
        </section>
        <section className="review-dialogue-panel">
          {record.asked.length > 0 && !record.decision && !pending && !choicesVisible && !draft?.open && !enlarged && <button className="jump-to-choice" onClick={() => actions.current?.scrollIntoView({ block: "start" })}>아래 선택지 보기 <ArrowRight size={18} /></button>}
          <ChatHistory game={game} room="group" current={game.review.current} />
          <ReplyWait game={game} dispatch={dispatch} />
          <div ref={actions} className="review-actions" aria-label="현재 사진의 다음 행동">
            {record.decision ? <>
              <p className="decision-receipt"><Check size={18} />{record.decision === "include" ? "게시 목록에 담았어요. 아직 SNS에는 올라가지 않았어요." : "이 사진은 사진첩에 보관해요."}</p>
              <button className="primary" disabled={pending} onClick={() => dispatch({ type: "reviewContinue" })}>{reviewedCount(game) === photos.length ? "게시 목록 보기" : "다음 사진 보기"}<ArrowRight size={18} /></button>
              <button disabled={pending} onClick={() => dispatch({ type: "reviewReopen" })}>이 사진의 선택 바꾸기</button>
              {needsScopeConfirmation(game, record.asset) && <button disabled={pending} onClick={() => dispatch({ type: "reviewAsk" })}>바뀐 공개 범위로 다시 묻기</button>}
            </> : <>
              {record.asked.length > 0 && <p className="review-next-prompt">친구들의 의견을 참고해, 이 사진을 어떻게 할지 골라 주세요.</p>}
              {!record.sent.includes(record.asset) && <button className="primary" disabled={pending} onClick={() => { setPhotoExpanded(false); dispatch({ type: "reviewSend" }); }}><Send size={18} />{record.asset === game.review.current ? "친구들에게 사진 보내기" : "친구에게 편집본 보여 주기"}</button>}
              {record.sent.includes(record.asset) && (!record.asked.includes(record.asset) || needsScopeConfirmation(game, record.asset)) && <button className="primary" disabled={pending} onClick={() => dispatch({ type: "reviewAsk" })}>SNS에 올려도 되는지 묻기</button>}
              <button disabled={pending} onClick={() => startEditing(game, dispatch, game.review.current!, { type: "reviewEdit" })}>{record.asset === game.review.current ? "이 사진 편집하기" : "다시 편집하기"}</button>
              {record.asked.length > 0 && <>
                <button disabled={pending} onClick={() => dispatch({ type: "reviewDecide", decision: "include" })}>SNS 게시 목록에 넣기</button>
                <button disabled={pending} onClick={() => dispatch({ type: "reviewDecide", decision: "keep" })}>게시하지 않고 보관하기</button>
                {requests.length > 0 && <button className="text-button" disabled={pending} aria-expanded={more} onClick={() => setMore(!more)}>친구에게 더 이야기하기</button>}
                {more && <div className="review-followups">{requests.map((request) => <div key={request.friend}>
                  {!record.why.includes(request.friend) && <button onClick={() => dispatch({ type: "reviewWhy", friend: request.friend })} disabled={pending}>{nameOf(request.friend)}에게 이유 묻기</button>}
                  {request.condition === "cover" && !request.hidden && <button onClick={() => dispatch({ type: "reviewPromise", friend: request.friend })} disabled={pending}>얼굴을 가려 주겠다고 말하기</button>}
                </div>)}</div>}
              </>}
              <button className="text-button" disabled={pending} onClick={() => dispatch({ type: "reviewPreview" })}>다른 사진 먼저 보기</button>
            </>}
          </div>
        </section>
      </div>}

      {game.review.phase === "preview" && <section className="review-preview" aria-label="SNS 게시물 미리보기">
        <h2>{selected.length ? "함께 남길 사진을 골랐어" : "이번 사진은 모두 간직해요"}</h2>
        <p>{selected.length ? `${selected.length}장을 하나의 게시물로 올려요.` : "사진과 친구들의 이야기는 사진첩에 남아요."}</p>
        {selected.length > 0 && <article className="review-post">
          <header><img className="avatar" src={profile("maru")} alt="마루" /><strong>마루</strong></header>
          <div className="batch-photos">{selected.map((id) => <figure key={id}><PhotoImage game={game} id={id} /><figcaption>{imageLabel(game, id)}</figcaption></figure>)}</div>
          <label>함께 남길 말<textarea value={caption} onChange={(e) => dispatch({ type: "reviewCaption", caption: e.target.value })} /></label>
          <label>공개 범위<select aria-label="게시물 공개 범위" value={audience} onChange={(e) => dispatch({ type: "reviewAudience", audience: e.target.value as typeof audience })}><option value="close">친한 친구</option><option value="public">전체 공개</option></select></label>
          {scopeChanges.length ? <aside className="scope-changes" aria-label="공개 범위 변경으로 달라진 조건">{scopeChanges.map((id) => <div key={id}><strong>{photoById(id).title}</strong><p>{currentRequests(game, game.review.photos[id]?.asset ?? id).filter((r) => r.condition !== "yes").map((r) => `${nameOf(r.friend)}: ${r.text}`).join(" ") || "친한 친구 공개에서는 원본을 나눠도 괜찮아요."}</p><button onClick={() => dispatch({ type: "reviewSelect", photo: id })}>이 사진의 조건 확인하기</button></div>)}</aside> : null}
          <button className="primary full" onClick={() => dispatch({ type: "reviewPublish", audience, caption })}>사진 {selected.length}장 한 번에 게시하기</button>
        </article>}
        <div className="review-list-summary">{photos.map((photo) => <button key={photo.id} onClick={() => dispatch({ type: "reviewSelect", photo: photo.id })}>{photo.title}<span>{game.review.photos[photo.id]?.decision === "include" ? "게시 목록" : "보관"} · 다시 살펴보기</span></button>)}</div>
        {!selected.length && <button className="primary full" onClick={() => dispatch({ type: "reviewFinish" })}>이번 만남 돌아보기</button>}
      </section>}

      {game.review.phase === "published" && <section className="review-published" aria-label="게시 결과">
        <h2>오늘의 사진을 나눴어요</h2>
        <ReplyWait game={game} dispatch={dispatch} />
        {game.issues.length > 0 && <Requests game={game} dispatch={dispatch} />}
        {record && game.versions.some((v) => v.id === record.asset) && !game.posts.some((p) => !p.deleted && p.photos.includes(record.asset)) && <section className="post-edit-preview" aria-label="사진첩에 저장한 새 편집본">
          <h2>사진첩에 저장한 편집본</h2>
          <div className="posted-version-comparison">
            {postedOriginal && <figure><PhotoImage game={game} id={postedOriginal} /><figcaption>SNS에 올라간 사진</figcaption></figure>}
            <figure><PhotoImage game={game} id={record.asset} /><figcaption>사진첩에 저장한 새 편집본</figcaption></figure>
          </div>
          <p>{postedOriginal ? "SNS에는 게시했던 사진이 계속 남아 있어요. 위의 부탁에서 실제 게시 사진을 내릴 수 있어요." : "이 사진은 SNS에서 내렸어요. 새 편집본은 사진첩에 보관해요."}</p>
          {!record.sent.includes(record.asset) && <button className="primary" disabled={pending} onClick={() => dispatch({ type: "reviewSend" })}>친구에게 편집본 보여 주기</button>}
          <ChatHistory game={game} room="group" current={game.review.current} />
        </section>}
        {game.posts.map((post) => <PublishedPost key={post.id} game={game} post={post} dispatch={dispatch} />)}
        <button className="primary full" disabled={pending} onClick={() => dispatch({ type: "reviewFinish" })}>{game.issues.some((i) => !i.resolved) ? "남은 부탁을 확인하고 만남 마무리" : "이번 만남 돌아보기"}</button>
      </section>}

      {(isPhoto || game.review.phase === "published") && draft?.open && <div className="modal-backdrop">
        <Editor key={draft.source} photo={draft.photo} initial={draft.edits} request={requestText}
          onDraft={(edits) => dispatch({ type: "draft", source: draft.source, photo: draft.photo, edits })}
          onClose={() => dispatch({ type: "reviewCloseEditor" })}
          onSave={(edits) => dispatch({ type: "reviewSave", edits })} />
      </div>}
      {enlarged && record && <div className="modal-backdrop" onClick={() => setEnlarged(false)}><section className="photo-lightbox review-lightbox" role="dialog" aria-label="사진 크게 보기" onClick={(e) => e.stopPropagation()}><button onClick={() => setEnlarged(false)}><ArrowLeft size={18} /> 사진으로 돌아가기</button><PhotoImage game={game} id={record.asset} /></section></div>}
    </main>
  );
}
