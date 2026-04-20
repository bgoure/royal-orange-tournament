import Link from "next/link";
import type { ReactNode } from "react";

const EXTERNAL_RESOURCES: { label: string; href: string }[] = [
  {
    label: "OBA RP2.10 10U/11U Playing Rules",
    href: "https://ondeck.baseballontario.com/page/5937/rep-division-procedures-playing-rules/20363/rep-division-playing-rules#RP2.10:~:text=RP2.10%C2%A0%20%C2%A010U/11U%20Playing%20Rules",
  },
  {
    label: "OBA Rep Division Playing Rules",
    href: "https://ondeck.baseballontario.com/page/5937/rep-division-procedures-playing-rules/20363/rep-division-playing-rules",
  },
  {
    label: "OBA Bat Rules",
    href: "https://ondeck.baseballontario.com/page/786/oba-procedures-playing-rules/20362/bat-rules-explained",
  },
  {
    label: "Official Baseball Rules",
    href: "https://ondeck.baseballontario.com/page/3013/official-baseball-rules",
  },
];

function SectionShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <h2 className="border-b border-royal/20 bg-royal px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-white sm:text-sm">
        {title}
      </h2>
      <div className="space-y-4 px-4 py-4 text-sm leading-relaxed text-zinc-800 sm:px-5 sm:py-5 sm:text-[15px] sm:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function RoyalOrangeClassicRules({ tournamentName }: { tournamentName: string }) {
  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-royal-50 via-white to-accent-50/40 p-4 shadow-sm sm:p-5">
        <p className="text-sm font-semibold text-royal">External Resources</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {EXTERNAL_RESOURCES.map((item, i) => {
            const royal = i % 2 === 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  royal
                    ? "inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-royal px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-royal-800 sm:min-w-[min(100%,280px)]"
                    : "inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 border-accent bg-white px-4 py-2.5 text-center text-sm font-semibold text-accent shadow-sm transition-colors hover:bg-accent-50 sm:min-w-[min(100%,280px)]"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-royal/20 border-l-4 border-l-accent bg-gradient-to-r from-royal-50/90 to-white px-4 py-4 shadow-md sm:px-6 sm:py-5">
        <p className="text-lg font-bold leading-snug tracking-tight text-royal sm:text-xl">
          Tournament rules for {tournamentName}.
        </p>
      </div>

      <SectionShell title="Administrative Items">
        <P>
          <span className="font-semibold text-royal">a)</span> Ontario Baseball Association (O.B.A.) Constitution and
          Official Rules shall apply, subject to exceptions as indicated in the following rules and regulations.
        </P>
        <P>
          <span className="font-semibold text-royal">b)</span> Standard Baseball Rules apply except as amended by OBA.
        </P>
        <P>
          <span className="font-semibold text-royal">c)</span> Managers and coaches are responsible for the conduct of
          their players, and anyone involved with the team, both on and off the field.
        </P>
        <P>
          <span className="font-semibold text-royal">i.</span> There will be Zero Tolerance for any form of abuse
          directed toward umpires, game convenors, or the tournament director. Any such incidents may result in
          immediate ejection from the grounds, forfeiture of the game, and will be reported to the OBA without delay.
        </P>
        <P>
          <span className="font-semibold text-royal">d)</span> Tournament awards are set at fourteen (14) per team.
        </P>
      </SectionShell>

      <SectionShell title="Format &amp; Schedule">
        <P>
          <span className="font-semibold text-royal">e)</span> This is an 8-team tournament for each age group, divided
          into 2 divisions of 4 teams each. Each team will play 3 round robin games -- weather permitting.
        </P>
        <P>
          <span className="font-semibold text-royal">i.</span> The top 2 teams from each division will advance to the
          knockout stage on Sunday.
        </P>
        <P>
          <span className="font-semibold text-royal">ii.</span> The 3rd and 4th place finishers will have a consolation
          game on Sunday.
        </P>
        <P>
          <span className="font-semibold text-royal">iii.</span> In the event of inclement weather or other delays, the
          tournament schedule may be revised -- updates will be sent via a WhatsApp group for Coaches and Managers.
        </P>
        <P>
          <span className="font-semibold text-royal">f)</span> Games will commence promptly on time as per the schedule.
          Barring extenuating circumstances, any team unable to field nine (9) eligible players within 15 minutes of
          the scheduled starting time will default the game.
        </P>
      </SectionShell>

      <SectionShell title="Pitch Counts">
        <P>
          <span className="font-semibold text-royal">g)</span> Baseball Ontario pitching rules will be strictly enforced
          (where applicable).
        </P>
        <div className="space-y-3 border-l-2 border-accent/40 pl-4">
          <P>
            <span className="font-semibold text-royal">iv.</span> Pitch Counts will be strictly enforced per OBA Arm
            Care Rules listed in A12.01/13.01.
          </P>
          <P>
            <span className="font-semibold text-royal">v.</span> The Home team is responsible for capturing the pitch
            count in the pitch count app in real time (either pitch by pitch or at the end of each inning) during the
            game.
          </P>
          <P>
            <span className="font-semibold text-royal">vi.</span> Pitch Counts of the &quot;Official Pitch Counter&quot;
            will be the only numbers used by the Umpires during a game regardless of what numbers (Pitch Counts) any
            coach or spectator may have – no appeal or protest of the numbers recorded will be permitted. Note: It is
            recommended that coaches check the Pitch Count of a pitcher as recorded by the &quot;Official Pitch
            Counter&quot; at the conclusion of each inning.
          </P>
          <P>
            <span className="font-semibold text-royal">vii.</span> Both coaches shall verify respective the Official
            Pitch Counts immediately following the conclusion of the game acknowledging the Pitch Counts of the pitchers
            used during that game. In the event of a discrepancy in numbers, the Pitch Counts of the &quot;Official Pitch
            Counter&quot; shall stand. In the event a coach fails to enter or verify the Pitch Counts, the Pitch Counts
            recorded will be considered official and no appeal or protest of the numbers will be allowed at later time.
            Note: It is recommended that coaches meet the Convenor immediately following the game and enter and verify the
            Pitch Counts together.
          </P>
        </div>
      </SectionShell>

      <SectionShell title="Score Reporting">
        <P>
          <span className="font-semibold text-royal">h)</span> The home team is to keep the official score. At the end of
          the game, both Head Coaches will sign the Game Summary Sheet. Please submit all completed/signed scoresheet
          promptly after the game at the concession stand near Lions 1 field, -- alternatively give the completed
          scoresheet to the assigned game convenor.
        </P>
        <P>
          <span className="font-semibold text-royal">i.</span> Note: Be sure to write the Game ID (generated by the
          pitch count app) on the scoresheet.
        </P>
      </SectionShell>

      <SectionShell title="Game Balls">
        <P>
          <span className="font-semibold text-royal">i)</span> For each game, 2 new balls will be provided by the game
          convenor. Please keep any usable balls afterward as backups—they tend to disappear quickly in foul territory
          (especially near Lions 3!).
        </P>
      </SectionShell>

      <SectionShell title="Field Use &amp; Conduct">
        <P>
          <span className="font-semibold text-royal">j)</span> No infield practice is permitted during the tournament.
        </P>
        <P>
          <span className="font-semibold text-royal">k)</span> The decision of the umpire(s) is final. There will be no
          protest of judgment calls with the umpire(s).
        </P>
        <P>
          <span className="font-semibold text-royal">l)</span> Ejection from any tournament game will result in an
          automatic suspension from the next scheduled game and/or the balance of the tournament depending on the
          circumstances.
        </P>
      </SectionShell>

      <SectionShell title="Game Duration &amp; Extra Innings">
        <P>
          <span className="font-semibold text-royal">m)</span> Round robin games may end in a tie. No extra innings will
          be played.
        </P>
        <P>
          <span className="font-semibold text-royal">n)</span> Round robin games are capped at 7 innings or 2 hours
          using the dead drop time limit rule. No new inning may begin after 1 hour 45 minutes from the scheduled start
          time, if an inning is not completed at 2-hour dead drop time limit, the score will revert to the previous
          completed inning. In event of delays due to weather:
        </P>
        <P>
          <span className="font-semibold text-royal">i.</span> If the game start time is delayed, a new scheduled start
          time will be communicated by the tournament committee and be used as the new starting time for dead drop
          rule.
        </P>
        <P>
          <span className="font-semibold text-royal">ii.</span> If the weather delay occurs mid-game and the game is
          suspended. The convenors will note the time the game stopped and accordingly adjust the dead drop time.
        </P>
        <P>
          <span className="font-semibold text-royal">o)</span> Official Game: A game shall be official if curfew is
          reached, and the home team is leading after 3 ½ innings or the visitors are leading after 4 complete innings.
          If 4 innings have been completed and the game is suspended, then it will be considered official. If the game
          is suspended prior to curfew and prior to 4 innings being completed, then the game shall be resumed from the
          point of suspension. The defensive team must resume their exact positions on the field, though players
          eligible to be substituted or re-entered may do so. The count, if any, on the batter will be unchanged and the
          batting order must be the same upon resumption of the suspended game. If the home team is batting and leading
          or scores the winning run when curfew is reached, the game will end immediately and be considered official at
          that point and the score, and offensive and defensive innings recorded at that time (full innings will be
          assigned to the offensive and defensive teams).
        </P>
      </SectionShell>

      <SectionShell title="Mercy Rule">
        <P>
          <span className="font-semibold text-royal">p)</span> The OBA mercy rule [RP.2.10(c)] will be in effect for all
          games including the championship game.
        </P>
        <div className="space-y-2 border-l-2 border-accent/40 pl-4">
          <P>
            <span className="font-semibold text-royal">viii.</span> 18 runs after 3 innings
          </P>
          <P>
            <span className="font-semibold text-royal">ix.</span> 15 runs after 4 innings
          </P>
          <P>
            <span className="font-semibold text-royal">x.</span> 10 runs after 5 innings
          </P>
          <P>
            <span className="font-semibold text-royal">xi.</span> 9 runs after 6 innings or any subsequent inning
            thereafter.
          </P>
        </div>
      </SectionShell>

      <SectionShell title="Standings &amp; Tiebreakers">
        <P>
          <span className="font-semibold text-royal">q)</span> Standings: 2 points for a win, 1 point for a tie, 0 points
          for a loss.
        </P>
        <P>
          <span className="font-semibold text-royal">r)</span> If teams are tied in standings after round robin play,
          OBA tiebreaker rules RP 7.3 (a) and (b) will apply as follows:
        </P>
        <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:p-4">
          <p className="font-bold text-royal">RP7.3(a)</p>
          <div className="space-y-2">
            <P>
              <span className="font-semibold text-royal">i)</span> Teams with a forfeit loss are ineligible for
              tiebreakers.
            </P>
            <P>
              <span className="font-semibold text-royal">ii)</span> The winner of the head-to-head game between the two
              (2) teams will advance.
            </P>
            <P>
              <span className="font-semibold text-royal">iii)</span> Team with the smallest runs against ratio (Runs
              allowed divided by the number of defensive innings played) in games among tied teams.
            </P>
            <P>
              <span className="font-semibold text-royal">iv)</span> Team with the smallest runs against ratio (Runs
              allowed divided by the number of defensive innings played) in all games.
            </P>
            <P>
              <span className="font-semibold text-royal">v)</span> Team with the highest runs for ratio (Runs scored
              divided by the number of offensive innings played) in games among tied teams.
            </P>
            <P>
              <span className="font-semibold text-royal">vi)</span> Team with the highest runs for ratio (Runs scored
              divided by the number of offensive innings played) in all games.
            </P>
            <P>
              <span className="font-semibold text-royal">vii)</span> Coin Toss.
            </P>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:p-4">
          <p className="font-bold text-royal">
            RP7.3(b) In all other circumstances (3 or more teams), the following will be utilized:
          </p>
          <div className="space-y-2">
            <P>
              <span className="font-semibold text-royal">i)</span> Teams with a forfeit loss are ineligible for
              tiebreakers.
            </P>
            <P>
              <span className="font-semibold text-royal">ii)</span> Team with the smallest runs against ratio (Runs
              allowed divided by the number of defensive innings played) in games among tied teams.
            </P>
            <P>
              <span className="font-semibold text-royal">iii)</span> Team with the smallest runs against ratio (Runs
              allowed divided by the number of defensive innings played) in all games.
            </P>
            <P>
              <span className="font-semibold text-royal">iv)</span> Team with the highest runs for ratio (Runs scored
              divided by the number of offensive innings played) in games among tied teams.
            </P>
            <P>
              <span className="font-semibold text-royal">v)</span> Team with the highest runs for ratio (Runs scored
              divided by the number of offensive innings played) in all games.
            </P>
            <P>
              <span className="font-semibold text-royal">vi)</span> Coin Toss.
            </P>
          </div>
        </div>
        <P>
          <span className="font-semibold text-accent">Note #1:</span> Once the tie between 3 or more teams is broken and
          the # 1 team is determined based on the above, in cases where further placement is required, the tiebreakers
          will continue if there are 3 or more teams. When only 2 teams remain, the tie between those 2 teams will be
          broken based on RP7.3(a) above.
        </P>
        <P>
          <span className="font-semibold text-accent">Note #2:</span> In the event of a forfeit during the Round Robin, a
          score of &quot;7-0&quot; will be recorded with 1 run being awarded per inning to the winning team (e.g. 4 runs
          after 4 innings).
        </P>
      </SectionShell>

      <SectionShell title="Playoffs">
        <P>
          <span className="font-semibold text-royal">s)</span> Semi-final and Championship games will be 2 hours in
          length from scheduled start time. If the top of the new inning is started within 15 minutes of the time limit,
          the umpire will declare that inning to be the last inning and the 8-run maximum will apply.
        </P>
        <P>
          <span className="font-semibold text-royal">t)</span> In the event of a tie at the conclusion of 7 innings
          and/or upon expiration of the time limit in any Semi-Final or Championship Game, the game will continue until
          such time as a winner is determined. The game will continue with complete innings being played as per RP2.10
          (g)
        </P>
        <P>
          <span className="font-semibold text-royal">u)</span> Extra Inning in Playoffs: Each team will begin the extra
          inning (and any subsequent necessary extra innings) with a player on second base only, no outs. The batter
          with the last full plate appearance in the previous inning will be placed on second base as per RP2.8.
        </P>
      </SectionShell>

      <SectionShell title="Home Team Designation">
        <P>
          <span className="font-semibold text-royal">v)</span> Round Robin stage: Home field will be determined prior to
          the start of all round-robin games by the flip of a coin with the team travelling the farthest making the call
          in all games.
        </P>
        <P>
          <span className="font-semibold text-royal">w)</span> Playoffs: Higher Seed will have the option of home or
          away in all playoff round games. If both teams have the same seed (e.g., both 1st-place teams), a coin toss
          will determine the home team, again with the team traveling furthest making the call.
        </P>
      </SectionShell>
    </div>
  );
}
