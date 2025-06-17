"use client";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import type { Team } from "~/types";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { PlusIcon } from "lucide-react";

interface TeamSelectDropdownProps {
  allTeams: Team[];
  selectedTeamIds: number[];
  onTeamSelect: (team: Team) => void;
  maxTeamsReached: boolean;
  isLoading?: boolean;
}

export function TeamSelectDropdown({
  allTeams,
  selectedTeamIds,
  onTeamSelect,
  maxTeamsReached,
  isLoading = false,
}: TeamSelectDropdownProps) {
  const availableTeams = allTeams.filter(
    (team) => !selectedTeamIds.includes(team.id)
  );

  if (maxTeamsReached) {
    return (
      <Button disabled className="w-full md:w-auto">
        Max Teams Selected (5)
      </Button>
    );
  }

  if (availableTeams.length === 0 && !maxTeamsReached) {
    return (
      <Button disabled className="w-full md:w-auto">
        All Teams Selected
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full md:w-auto border-indigoMain"
          disabled={maxTeamsReached || isLoading}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            <>
              Add Team{" "}
              <ChevronDownIcon className="ml-2 h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[calc(100vw-2rem)] md:w-auto max-h-[80vh] md:max-h-60 overflow-y-auto border-indigoMain"
        sideOffset={5}
      >
        <div className="h-[80vh] md:h-auto overflow-y-auto">
          {availableTeams.map((team) => (
            <DropdownMenuItem
              key={team.id}
              onSelect={() => onTeamSelect(team)}
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              {team.logos[0] && (
                <Image
                  src={team.logos[0].href}
                  alt={team.logos[0].alt}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              )}
              {team.displayName}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
