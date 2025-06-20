import type { Team, TradeScenario } from "~/types";

export default function TradeCard({
  trade,
  involvedTeams,
}: {
  trade: TradeScenario;
  involvedTeams: Team[];
}) {
  const formatPlayerName = (playerName: string) => {
    const playerNameSplit = playerName.split(" ");
    const firstName = playerNameSplit[0];
    const lastName = playerNameSplit[1];
    return `${firstName} ${lastName}`;
  };

  const TradesWithInfo = trade.teams.map((tradeTeam) => {
    const findTeam = involvedTeams.find(
      (team) => team.displayName === tradeTeam.teamName
    );

    const findPlayers = tradeTeam.receives?.players?.map((player) => {
      const findPlayerFromResponse = involvedTeams.find(
        (team) => team.displayName === player.from
      );
      return findPlayerFromResponse?.players?.find(
        (p) => p.fullName === formatPlayerName(player.name)
      );
    });

    return {
      team: findTeam,
      playersReceived: findPlayers,
      picksReceived: tradeTeam.receives?.picks,
    };
  });

  return (
    <div>
      {TradesWithInfo.map((trade) => (
        <div>
          <img
            src={trade.team?.logos?.[0]?.href}
            alt={trade.team?.displayName}
            width={24}
            height={24}
            className="object-contain"
          />
          <div>{trade.team?.displayName}</div>
          <div>
            Players Recieved{" "}
            {trade.playersReceived
              ?.map((player) => player?.fullName)
              .join(", ")}
          </div>
          <div>
            Picks Recieved{" "}
            {trade.picksReceived?.map((pick) => pick?.name).join(", ")}
          </div>
          <br></br>
        </div>
      ))}
    </div>
  );
}
