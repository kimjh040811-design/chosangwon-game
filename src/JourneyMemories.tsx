import { useState } from "react";
import type { Game, EpisodeId } from "./model";
import { episodes } from "./episodes";
import Scrapbook from "./Scrapbook";
export default function JourneyMemories({ game }: { game: Game }) {
  const [selected, setSelected] = useState<EpisodeId>(game.episode);
  const snapshot = game.episodes[selected];
  const selectedGame =
    selected === game.episode
      ? game
      : snapshot
        ? ({ ...snapshot.state, episode: selected, episodes: {} } as Game)
        : null;
  return (
    <>
      <nav className="episode-tabs" aria-label="스테이지 기록">
        {episodes
          .filter((e) => e.id === game.episode || game.episodes[e.id])
          .map((e) => (
            <button
              key={e.id}
              aria-pressed={selected === e.id}
              onClick={() => setSelected(e.id)}
            >
              {e.id} · {e.title}
            </button>
          ))}
      </nav>
      {selectedGame && <Scrapbook key={selected} game={selectedGame} />}
    </>
  );
}
