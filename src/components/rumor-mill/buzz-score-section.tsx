"use client";

import Image from "next/image";
import { FlameIcon } from "lucide-react";
import type { BuzzItem } from "~/actions/rumors";

interface BuzzScoreSectionProps {
  players: BuzzItem[];
  teams: BuzzItem[];
  onBuzzClick: (type: "player" | "team", id: number, name: string) => void;
}

function BuzzPill({
  item,
  rank,
  onClick,
}: {
  item: BuzzItem;
  rank: number;
  onClick: () => void;
}) {
  const isHot = rank < 3;
  const imageUrl =
    item.type === "player" ? item.headshot : item.logo;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-high transition-colors shrink-0"
    >
      {/* Avatar / Logo */}
      <div className="relative h-8 w-8 rounded-full bg-surface-highest overflow-hidden shrink-0">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover"
            sizes="32px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-on-surface-variant/50">
            {item.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Name + count */}
      <div className="flex flex-col items-start">
        <span className="text-xs font-medium text-on-surface leading-tight group-hover:text-primary transition-colors whitespace-nowrap">
          {item.name}
        </span>
        <span className="text-[10px] text-on-surface-variant/50 leading-tight">
          {item.mentions} mention{item.mentions !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Hot indicator */}
      {isHot && (
        <FlameIcon className="h-3.5 w-3.5 text-amber-400/80 shrink-0" />
      )}
    </button>
  );
}

export function BuzzScoreSection({
  players,
  teams,
  onBuzzClick,
}: BuzzScoreSectionProps) {
  const hasData = players.length > 0 || teams.length > 0;

  if (!hasData) {
    return (
      <section className="bg-surface-low rounded-xl px-6 py-5">
        <p className="text-sm text-on-surface-variant/40">
          Building buzz data — check back soon.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-surface-low rounded-xl px-6 pt-5 pb-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/50 mb-3">
        Trending This Week
      </h2>

      <div className="flex gap-6 overflow-x-auto pb-2 scrollbar-thin">
        {/* Players */}
        {players.length > 0 && (
          <div className="flex flex-col gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-primary-dim/60 font-medium">
              Players
            </span>
            <div className="flex gap-2">
              {players.map((player, i) => (
                <BuzzPill
                  key={player.id}
                  item={player}
                  rank={i}
                  onClick={() =>
                    onBuzzClick("player", player.id, player.name)
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {players.length > 0 && teams.length > 0 && (
          <div className="w-px bg-outline-variant/15 self-stretch shrink-0 my-2" />
        )}

        {/* Teams */}
        {teams.length > 0 && (
          <div className="flex flex-col gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-primary-dim/60 font-medium">
              Teams
            </span>
            <div className="flex gap-2">
              {teams.map((team, i) => (
                <BuzzPill
                  key={team.id}
                  item={team}
                  rank={i}
                  onClick={() =>
                    onBuzzClick("team", team.id, team.name)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
