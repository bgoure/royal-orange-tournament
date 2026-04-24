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
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import {
  updatePublicQuickGameAction,
  type PublicQuickGameResult,
} from "@/lib/actions/public-quick-game";
import { formatJsDateAsDatetimeLocalInZone } from "@/lib/datetime-tournament";
import { publicGameStatusLabel } from "@/components/schedule/GameList";

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

const statusOptions: GameStatus[] = [
  GameStatus.SCHEDULED,
  GameStatus.LIVE,
  GameStatus.AWAITING_RESULTS,
  GameStatus.FINAL,
  GameStatus.POSTPONED,
  GameStatus.CANCELLED,
];

function QuickGameModal({
  game,
  tournamentSlug,
  timezone,
  fieldOptions,
  onClose,
}: {
  game: QuickEditGamePayload;
  tournamentSlug: string;
  timezone: string;
  fieldOptions: QuickEditFieldOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePublicQuickGameAction, initialAction);

  useEffect(() => {
    if (state.ok) {
      onClose();
      router.refresh();
    }
  }, [state.ok, onClose, router]);

  const whenLocal = useMemo(
    () => formatJsDateAsDatetimeLocalInZone(game.scheduledAt, timezone),
    [game.scheduledAt, timezone],
  );

  const isPool = game.gameKind === GameKind.POOL;

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
            Edit game
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

        <form action={formAction} className="flex flex-col gap-3 px-4 py-4">
          <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
          <input type="hidden" name="id" value={game.id} />
          <input type="hidden" name="gameKind" value={game.gameKind} />
          <input type="hidden" name="resultType" value={game.resultType} />
          <input type="hidden" name="homeOffensiveInnings" value="" />
          <input type="hidden" name="awayOffensiveInnings" value="" />
          {!isPool ? (
            <>
              <input type="hidden" name="homeDefensiveInnings" value={game.homeDefensiveInnings ?? ""} />
              <input type="hidden" name="awayDefensiveInnings" value={game.awayDefensiveInnings ?? ""} />
            </>
          ) : null}

          {!state.ok && state.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
          ) : null}

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{game.awayTeamName}</span>
            <span className="ml-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">(A)</span>
            <span className="mx-1 text-accent dark:text-accent-light">vs</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{game.homeTeamName}</span>
            <span className="ml-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">(H)</span>
          </p>

          <div>
            <label
              htmlFor="qg-field"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Field
            </label>
            <select
              id="qg-field"
              name="fieldId"
              required
              defaultValue={game.fieldId}
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
              htmlFor="qg-when"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Game time ({timezone})
            </label>
            <input
              id="qg-when"
              name="scheduledAt"
              type="datetime-local"
              required
              defaultValue={whenLocal}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label
              htmlFor="qg-status"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Status
            </label>
            <select
              id="qg-status"
              name="status"
              required
              defaultValue={game.status}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {publicGameStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {game.homeTeamId && game.awayTeamId ? (
            <fieldset className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
              <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Home Team
              </legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="radio"
                    name="fieldHomeTeamId"
                    value={game.awayTeamId}
                    className="size-4 border-zinc-300 text-royal focus:ring-royal/30"
                  />
                  <span className="font-medium">{game.awayTeamName}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="radio"
                    name="fieldHomeTeamId"
                    value={game.homeTeamId}
                    defaultChecked
                    className="size-4 border-zinc-300 text-royal focus:ring-royal/30"
                  />
                  <span className="font-medium">{game.homeTeamName}</span>
                </label>
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="fieldHomeTeamId" value="" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="qg-ar" className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Runs — {game.awayTeamName}
                <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">(A)</span>
              </label>
              <input
                id="qg-ar"
                name="awayRuns"
                type="number"
                min={0}
                defaultValue={game.awayRuns ?? ""}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="qg-hr" className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Runs — {game.homeTeamName}
                <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">(H)</span>
              </label>
              <input
                id="qg-hr"
                name="homeRuns"
                type="number"
                min={0}
                defaultValue={game.homeRuns ?? ""}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            {isPool ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Def. innings — {game.awayTeamName}{" "}
                    <span className="font-normal text-zinc-400 dark:text-zinc-500">(A)</span>
                  </label>
                  <input
                    name="awayDefensiveInnings"
                    type="number"
                    step="any"
                    min={0}
                    defaultValue={game.awayDefensiveInnings ?? ""}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Def. innings — {game.homeTeamName}{" "}
                    <span className="font-normal text-zinc-400 dark:text-zinc-500">(H)</span>
                  </label>
                  <input
                    name="homeDefensiveInnings"
                    type="number"
                    step="any"
                    min={0}
                    defaultValue={game.homeDefensiveInnings ?? ""}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 flex-1 rounded-xl bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-royal-800 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
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
    </div>
  );
}

export function PublicQuickGameProvider({
  isAdmin,
  tournamentSlug,
  timezone,
  fieldOptions,
  children,
}: {
  isAdmin: boolean;
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
          game={active}
          tournamentSlug={tournamentSlug}
          timezone={timezone}
          fieldOptions={fieldOptions}
          onClose={close}
        />
      ) : null}
    </PublicQuickGameContext.Provider>
  );
}
