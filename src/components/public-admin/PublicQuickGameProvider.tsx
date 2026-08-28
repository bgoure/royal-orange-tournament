"use client";

import { GameKind, GameResultType, GameStatus } from "@prisma/client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useActionState,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import {
  updatePublicQuickGameAction,
  updatePublicQuickGameScheduleAction,
  resetPublicQuickGamePoolScoringAction,
  type PublicQuickGameResult,
  type PublicQuickScheduleResult,
} from "@/lib/actions/public-quick-game";
import {
  formatGameScheduledAt,
  formatJsDateAsDatetimeLocalInZone,
  parseDatetimeLocalInTimeZone,
} from "@/lib/datetime-tournament";
import { isOba13SitOutGameNumber } from "@/lib/services/oba-de-13";

export type QuickEditFieldOption = { id: string; label: string };

export type QuickEditGamePayload = {
  id: string;
  fieldId: string;
  scheduledAt: Date;
  schedulePlaceholder: boolean;
  gameKind: GameKind;
  status: GameStatus;
  resultType: GameResultType;
  homeRuns: number | null;
  awayRuns: number | null;
  homeDefensiveInnings: number | null;
  awayDefensiveInnings: number | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  gameNumber?: string | null;
};

type Ctx = {
  enabled: boolean;
  open: (game: QuickEditGamePayload) => void;
};

const PublicQuickGameContext = createContext<Ctx | null>(null);

export function usePublicQuickGameEdit(): Ctx | null {
  return useContext(PublicQuickGameContext);
}

const initialAction: PublicQuickGameResult = { ok: false };

const RESET_POOL_SCORING_CONFIRM =
  "Reset this pool game?\n\n" +
  "• Runs set to 0 for both teams\n" +
  "• Defensive and offensive innings set to 0\n" +
  "• Result type set to Regular\n" +
  "• Status set to Scheduled\n" +
  "• Pool standings will be recalculated\n\n" +
  "Location, time, and teams stay the same. This cannot be undone automatically (re-enter scores if needed).";

function publicModalCompletionHeadline(status: GameStatus): { line: string; completed: boolean } {
  const completed = status === GameStatus.FINAL || status === GameStatus.CANCELLED;
  return {
    line: completed ? "Completed" : "Not completed",
    completed,
  };
}

function StatWheel({
  name,
  min,
  max,
  defaultValue,
  emptyOption,
  ariaLabel,
}: {
  name: string;
  min: number;
  max: number;
  defaultValue: number | null;
  emptyOption?: boolean;
  ariaLabel: string;
}) {
  const values = useMemo(() => {
    const out: number[] = [];
    for (let i = min; i <= max; i++) out.push(i);
    return out;
  }, [min, max]);

  const selectDefault =
    emptyOption && (defaultValue == null || defaultValue < min || defaultValue > max)
      ? ""
      : String(defaultValue ?? min);

  return (
    <select
      name={name}
      defaultValue={selectDefault}
      aria-label={ariaLabel}
      className="w-full rounded-xl border-2 border-accent bg-accent-50 px-2 py-2.5 text-center text-lg font-bold text-accent-800 shadow-sm focus:border-accent-700 focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-accent-light dark:bg-accent-900/30 dark:text-accent-100"
    >
      {emptyOption ? (
        <option value="">
          —
        </option>
      ) : null}
      {values.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

function QuickGameScheduleModal({
  game,
  tournamentSlug,
  timezone,
  fieldOptions,
  initialFieldId,
  initialWhenLocal,
  onClose,
  onSaved,
}: {
  game: QuickEditGamePayload;
  tournamentSlug: string;
  timezone: string;
  fieldOptions: QuickEditFieldOption[];
  initialFieldId: string;
  initialWhenLocal: string;
  onClose: () => void;
  onSaved: (fieldId: string, whenLocal: string) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res: PublicQuickScheduleResult = await updatePublicQuickGameScheduleAction({ ok: false }, fd);
    setPending(false);
    if (res.ok) {
      const fid = String(fd.get("fieldId") ?? "");
      const when = String(fd.get("scheduledAt") ?? "");
      onSaved(fid, when);
      router.refresh();
      onClose();
    } else {
      setError(res.error ?? "Could not update field or time.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center"
      role="presentation"
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-[111] m-4 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        role="dialog"
        aria-modal
        aria-labelledby="quick-game-schedule-title"
      >
        <h3 id="quick-game-schedule-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Edit location &amp; time
        </h3>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <input type="hidden" name="id" value={game.id} />
          <input type="hidden" name="gameKind" value={game.gameKind} />

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}

          <div>
            <label
              htmlFor="qgs-field"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Field
            </label>
            <select
              id="qgs-field"
              name="fieldId"
              required
              defaultValue={initialFieldId}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {fieldOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="qgs-when"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Game time ({timezone})
            </label>
            <input
              id="qgs-when"
              name="scheduledAt"
              type="datetime-local"
              required
              defaultValue={initialWhenLocal}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 flex-1 rounded-xl bg-royal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-royal-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickGameModal({
  game,
  tournamentSlug,
  timezone,
  fieldOptions,
  showPoolScoreReset,
  onClose,
}: {
  game: QuickEditGamePayload;
  tournamentSlug: string;
  timezone: string;
  fieldOptions: QuickEditFieldOption[];
  /** ADMIN / POWER_USER: show one-click pool scoring reset (with confirm). */
  showPoolScoreReset: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePublicQuickGameAction, initialAction);
  const [resetState, resetFormAction, resetPending] = useActionState(
    resetPublicQuickGamePoolScoringAction,
    initialAction,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const statusInputRef = useRef<HTMLInputElement>(null);

  const [scheduleDraft, setScheduleDraft] = useState<{
    fieldId: string;
    whenLocal: string;
  } | null>(null);

  const draftFieldId = scheduleDraft?.fieldId ?? game.fieldId;
  const draftWhenLocal = scheduleDraft?.whenLocal ?? formatJsDateAsDatetimeLocalInZone(game.scheduledAt, timezone);

  const [fieldHomeTeamId, setFieldHomeTeamId] = useState<string | null>(
    game.homeTeamId && game.awayTeamId ? game.homeTeamId : null,
  );

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [state.ok, onClose, router]);

  useEffect(() => {
    if (resetState.ok) {
      onClose();
      router.refresh();
    }
  }, [resetState.ok, onClose, router]);

  useEffect(() => {
    if (statusInputRef.current) {
      statusInputRef.current.value = game.status;
    }
  }, [game.status]);

  const isPool = game.gameKind === GameKind.POOL;
  const { line: completionLine, completed: dbCompleted } = publicModalCompletionHeadline(game.status);

  const fieldLabel =
    fieldOptions.find((f) => f.id === draftFieldId)?.label ?? `Field ${draftFieldId.slice(0, 6)}…`;

  const timeLabel = useMemo(() => {
    const showTbd = scheduleDraft == null && game.schedulePlaceholder;
    if (showTbd) return "TBD";
    try {
      const d = parseDatetimeLocalInTimeZone(draftWhenLocal, timezone);
      return formatGameScheduledAt(d, timezone).replace(/\s*([AP]M)/i, (_, ap) => String(ap).toLowerCase());
    } catch {
      return "TBD";
    }
  }, [draftWhenLocal, timezone, scheduleDraft, game.schedulePlaceholder]);

  function setStatusAndSubmit(status: GameStatus) {
    if (statusInputRef.current) {
      statusInputRef.current.value = status;
    }
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  function onUpdateGameClick() {
    if (dbCompleted) {
      setStatusAndSubmit(game.status);
      return;
    }
    setCompleteOpen(true);
  }

  function onCompleteConfirm(yes: boolean) {
    setCompleteOpen(false);
    if (yes) {
      setStatusAndSubmit(GameStatus.FINAL);
    } else {
      setStatusAndSubmit(game.status);
    }
  }

  const bothTeams = Boolean(game.homeTeamId && game.awayTeamId);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="presentation"
      {...{ [DIVISION_SWIPE_IGNORE]: "" }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 sm:rounded-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="quick-game-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 id="quick-game-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Game Results
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4 px-4 py-4">
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <input type="hidden" name="id" value={game.id} />
          <input type="hidden" name="gameKind" value={game.gameKind} />
          <input type="hidden" name="resultType" value={game.resultType} />
          <input type="hidden" name="homeOffensiveInnings" value="" />
          <input type="hidden" name="awayOffensiveInnings" value="" />
          <input ref={statusInputRef} type="hidden" name="status" />
          <input type="hidden" name="fieldId" value={draftFieldId} />
          <input type="hidden" name="scheduledAt" value={draftWhenLocal} />

          {!isPool ? (
            <>
              <input type="hidden" name="homeDefensiveInnings" value={game.homeDefensiveInnings ?? ""} />
              <input type="hidden" name="awayDefensiveInnings" value={game.awayDefensiveInnings ?? ""} />
            </>
          ) : null}

          {!state.ok && state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
          ) : null}
          {!resetState.ok && resetState.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{resetState.error}</p>
          ) : null}

          <p className="text-center text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isOba13SitOutGameNumber(game.gameNumber) ? (
              <>
                {game.homeTeamName !== "TBD" ? game.homeTeamName : game.awayTeamName !== "TBD" ? game.awayTeamName : "Unassigned"}{" "}
                <span className="font-normal text-zinc-500">sits out</span>
              </>
            ) : (
              <>
                {game.awayTeamName}{" "}
                <span className="font-normal text-accent dark:text-accent-light">vs</span> {game.homeTeamName}
              </>
            )}
          </p>

          <div className="flex items-start justify-between gap-3 text-xs text-sky-600 dark:text-sky-400">
            <div className="min-w-0 space-y-0.5">
              <p>
                <span className="font-semibold">Field:</span> {fieldLabel}
              </p>
              <p>
                <span className="font-semibold">Time:</span> {timeLabel}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 font-semibold underline decoration-sky-600/80 underline-offset-2 hover:text-sky-700 dark:hover:text-sky-300"
              onClick={() => setScheduleOpen(true)}
            >
              Edit location/time
            </button>
          </div>

          <p
            className={
              dbCompleted
                ? "text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                : "text-center text-sm font-semibold text-red-600 dark:text-red-400"
            }
          >
            Game status: {completionLine}
          </p>

          {bothTeams ? <input type="hidden" name="fieldHomeTeamId" value={fieldHomeTeamId ?? ""} /> : (
            <input type="hidden" name="fieldHomeTeamId" value="" />
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Away (left) */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-center text-sm font-bold text-zinc-900 dark:text-zinc-100">{game.awayTeamName}</p>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Runs</p>
                  <StatWheel
                    name="awayRuns"
                    min={0}
                    max={40}
                    defaultValue={game.awayRuns}
                    emptyOption
                    ariaLabel={`Runs for ${game.awayTeamName}`}
                  />
                </div>
                {isPool ? (
                  <div>
                    <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Def. innings
                    </p>
                    <StatWheel
                      name="awayDefensiveInnings"
                      min={0}
                      max={12}
                      defaultValue={
                        game.awayDefensiveInnings != null
                          ? Math.round(game.awayDefensiveInnings)
                          : null
                      }
                      emptyOption
                      ariaLabel={`Defensive innings for ${game.awayTeamName}`}
                    />
                  </div>
                ) : null}
              </div>
              {bothTeams ? (
                <button
                  type="button"
                  onClick={() => setFieldHomeTeamId(game.awayTeamId!)}
                  className={
                    fieldHomeTeamId === game.awayTeamId
                      ? "mt-3 w-full rounded-lg border-2 border-yellow-400 bg-yellow-200 py-2 text-sm font-bold text-zinc-900 shadow-sm dark:bg-yellow-300/90"
                      : "mt-3 w-full rounded-lg border-2 border-zinc-200 bg-white py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }
                >
                  {fieldHomeTeamId === game.awayTeamId ? "Home" : "Away"}
                </button>
              ) : null}
            </div>

            {/* Home (right) */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-center text-sm font-bold text-zinc-900 dark:text-zinc-100">{game.homeTeamName}</p>
              <div className="mt-2 space-y-2">
                <div>
                  <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Runs</p>
                  <StatWheel
                    name="homeRuns"
                    min={0}
                    max={40}
                    defaultValue={game.homeRuns}
                    emptyOption
                    ariaLabel={`Runs for ${game.homeTeamName}`}
                  />
                </div>
                {isPool ? (
                  <div>
                    <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Def. innings
                    </p>
                    <StatWheel
                      name="homeDefensiveInnings"
                      min={0}
                      max={12}
                      defaultValue={
                        game.homeDefensiveInnings != null
                          ? Math.round(game.homeDefensiveInnings)
                          : null
                      }
                      emptyOption
                      ariaLabel={`Defensive innings for ${game.homeTeamName}`}
                    />
                  </div>
                ) : null}
              </div>
              {bothTeams ? (
                <button
                  type="button"
                  onClick={() => setFieldHomeTeamId(game.homeTeamId!)}
                  className={
                    fieldHomeTeamId === game.homeTeamId
                      ? "mt-3 w-full rounded-lg border-2 border-yellow-400 bg-yellow-200 py-2 text-sm font-bold text-zinc-900 shadow-sm dark:bg-yellow-300/90"
                      : "mt-3 w-full rounded-lg border-2 border-zinc-200 bg-white py-2 text-sm font-bold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }
                >
                  {fieldHomeTeamId === game.homeTeamId ? "Home" : "Away"}
                </button>
              ) : null}
            </div>
          </div>

          {showPoolScoreReset && isPool ? (
            <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Wrong pool score? You can clear scoring in one step (after confirming).
              </p>
              <button
                type="button"
                disabled={pending || resetPending}
                onClick={() => {
                  if (!window.confirm(RESET_POOL_SCORING_CONFIRM)) return;
                  const fd = new FormData();
                  fd.set("tournamentSlug", tournamentSlug);
                  fd.set("id", game.id);
                  fd.set("gameKind", GameKind.POOL);
                  resetFormAction(fd);
                }}
                className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
              >
                {resetPending ? "Resetting…" : "Reset game scoring"}
              </button>
            </div>
          ) : null}

          {dbCompleted ? (
            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Change status without clearing scores (Scorekeeper also supports this).
              </p>
              <div className="flex flex-wrap gap-2">
                {game.status !== GameStatus.LIVE ? (
                  <button
                    type="button"
                    disabled={pending || resetPending}
                    onClick={() => setStatusAndSubmit(GameStatus.LIVE)}
                    className="min-h-10 flex-1 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100"
                  >
                    Mark in progress
                  </button>
                ) : null}
                {game.status !== GameStatus.CANCELLED ? (
                  <button
                    type="button"
                    disabled={pending || resetPending}
                    onClick={() => {
                      if (!window.confirm("Mark this game as cancelled?")) return;
                      setStatusAndSubmit(GameStatus.CANCELLED);
                    }}
                    className="min-h-10 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    Cancel game
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={onUpdateGameClick}
              className="min-h-11 flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-700 disabled:opacity-50 dark:hover:bg-accent-light"
            >
              {pending ? "Updating…" : "Update Game"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {scheduleOpen ? (
        <QuickGameScheduleModal
          game={game}
          tournamentSlug={tournamentSlug}
          timezone={timezone}
          fieldOptions={fieldOptions}
          initialFieldId={draftFieldId}
          initialWhenLocal={draftWhenLocal}
          onClose={() => setScheduleOpen(false)}
          onSaved={(fieldId, whenLocal) => {
            setScheduleDraft({ fieldId, whenLocal });
          }}
        />
      ) : null}

      {completeOpen ? (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center p-4"
          role="presentation"
          {...{ [DIVISION_SWIPE_IGNORE]: "" }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Dismiss"
            onClick={() => setCompleteOpen(false)}
          />
          <div
            className="relative z-[116] w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
            role="dialog"
            aria-modal
            aria-labelledby="complete-confirm-title"
          >
            <p id="complete-confirm-title" className="text-center text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Is the game completed?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onCompleteConfirm(true)}
                className="min-h-10 flex-1 rounded-xl bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-800"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => onCompleteConfirm(false)}
                className="min-h-10 flex-1 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PublicQuickGameProvider({
  isAdmin,
  showPoolScoreReset,
  tournamentSlug,
  timezone,
  fieldOptions,
  children,
}: {
  isAdmin: boolean;
  /** ADMIN / POWER_USER: quick reset pool scoring in the game modal. */
  showPoolScoreReset: boolean;
  tournamentSlug: string;
  timezone: string;
  fieldOptions: QuickEditFieldOption[];
  children: ReactNode;
}) {
  const [active, setActive] = useState<QuickEditGamePayload | null>(null);

  const open = useCallback((game: QuickEditGamePayload) => {
    setActive(game);
  }, []);

  const close = useCallback(() => setActive(null), []);

  const ctx = useMemo<Ctx>(() => ({ enabled: isAdmin, open }), [isAdmin, open]);

  return (
    <PublicQuickGameContext.Provider value={ctx}>
      {children}
      {active ? (
        <QuickGameModal
          key={active.id}
          game={active}
          tournamentSlug={tournamentSlug}
          timezone={timezone}
          fieldOptions={fieldOptions}
          showPoolScoreReset={showPoolScoreReset}
          onClose={close}
        />
      ) : null}
    </PublicQuickGameContext.Provider>
  );
}
