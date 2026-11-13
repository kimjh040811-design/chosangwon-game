import { useState } from "react";
import { X } from "lucide-react";
import type { Game } from "./model";
import { episodePhotos, imageInfo, versionLabel, imageLabel } from "./data";
import Photo from "./Photo";
export default function Scrapbook({ game }: { game: Game }) {
  const [source, setSource] = useState(
    game.versions[0]?.photo ?? episodePhotos(game)[0].id,
  );
  const [selected, setSelected] = useState<string>(
    game.versions.find((v) => v.photo === source)?.id ?? source,
  );
  const [zoom, setZoom] = useState<string | null>(null);
  const versions = game.versions.filter((v) => v.photo === source);
  const current = imageInfo(game, selected);
  function choose(id: string) {
    const photo = imageInfo(game, id).photo;
    setSource(photo);
    setSelected(id);
  }
  return (
    <section className="scrapbook" aria-label="우리의 추억 스크랩북">
      <header className="scrapbook-heading">
        <h1>우리의 추억</h1>
        <p>사진을 고르고, 바뀐 모습을 나란히 살펴봐요.</p>
      </header>
      <nav className="scrapbook-tabs" aria-label="추억 사진 고르기">
        {episodePhotos(game).map((photo) => (
          <button
            key={photo.id}
            className={source === photo.id ? "selected" : ""}
            onClick={() => {
              setSource(photo.id);
              setSelected(
                game.versions.find((v) => v.photo === photo.id)?.id ?? photo.id,
              );
            }}
          >
            {photo.title}
          </button>
        ))}
      </nav>
      <div className="scrapbook-compare">
        <figure>
          <button aria-label="원본 크게 보기" onClick={() => setZoom(source)}>
            <Photo photo={source} />
          </button>
          <figcaption>원본</figcaption>
        </figure>
        <figure>
          <button
            aria-label="선택한 편집본 크게 보기"
            onClick={() => setZoom(selected)}
          >
            <Photo photo={current.photo} edits={current.edits} />
          </button>
          <figcaption>
            {versionLabel(game, selected)}{" "}
            {game.versions.find((v) => v.id === selected)?.deleted && (
              <span className="deleted-label">삭제된 편집본</span>
            )}
          </figcaption>
        </figure>
      </div>
      <div className="scrapbook-thumbnails" aria-label="원본과 모든 편집 버전">
        {[
          { id: source, photo: source, edits: [], deleted: false },
          ...versions,
        ].map((item) => (
          <button
            key={item.id}
            className={selected === item.id ? "selected" : ""}
            aria-pressed={selected === item.id}
            aria-label={`${versionLabel(game, item.id)}${item.deleted ? " 삭제된 편집본" : ""} 선택`}
            onClick={() => choose(item.id)}
          >
            <Photo photo={item.photo} edits={item.edits} />
            <span>{versionLabel(game, item.id)}</span>
            {item.deleted && <small>삭제된 편집본</small>}
          </button>
        ))}
      </div>
      {!versions.length && (
        <p className="muted">
          이 사진의 편집본은 만들지 않았어요. 원본을 그대로 간직했어요.
        </p>
      )}
      <section className="scrapbook-events">
        <h2>사진에 담긴 이야기</h2>
        {game.events.map((event) => (
          <article
            className={`scrapbook-event event-${event.type}`}
            key={event.id}
          >
            <p>{event.text}</p>
            {event.audience && (
              <span className="version-badge">
                {event.audience === "public" ? "전체 공개" : "친한 친구 공개"}
              </span>
            )}
            {event.photos.length > 0 && (
              <div className="event-photos">
                {event.photos.map((id, i) => {
                  const image = imageInfo(game, id);
                  return (
                    <button
                      key={`${id}-${i}`}
                      aria-label={`${imageLabel(game, id)} 기록에서 보기`}
                      onClick={() => choose(id)}
                    >
                      <Photo photo={image.photo} edits={image.edits} />
                      <span>{versionLabel(game, id)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </section>
      {zoom && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="추억 사진 크게 보기"
            className="modal-sheet photo-detail"
          >
            <header className="app-header">
              <h2>{imageLabel(game, zoom)}</h2>
              <button
                className="icon-button"
                aria-label="추억 사진 닫기"
                onClick={() => setZoom(null)}
              >
                <X />
              </button>
            </header>
            <Photo
              photo={imageInfo(game, zoom).photo}
              edits={imageInfo(game, zoom).edits}
            />
          </section>
        </div>
      )}
    </section>
  );
}
