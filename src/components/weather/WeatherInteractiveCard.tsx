"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import { DIVISION_SWIPE_IGNORE } from "@/lib/division-swipe-ignore";
import type { WeatherWidgetPayload } from "@/lib/services/weather";
import { weatherEmojiForCode, weatherLabelForCode } from "@/lib/weather-display";

type ForecastView = "daily" | "hourly";

function formatHourShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", hour12: true }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function WeatherInteractiveCard({
  locationLabel,
  wx,
}: {
  locationLabel: string;
  wx: WeatherWidgetPayload;
}) {
  const canToggle = wx.hourly.length > 0;
  const [view, setView] = useState<ForecastView>("daily");

  const toggle = useCallback(() => {
    if (!canToggle) return;
    setView((v) => (v === "daily" ? "hourly" : "daily"));
  }, [canToggle]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!canToggle) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [canToggle, toggle],
  );

  const ariaHint =
    view === "daily"
      ? "Weather at tournament headquarters. Five-day high temperatures. Press to show the next six hours."
      : "Weather at tournament headquarters. Next six hours forecast. Press to show five-day highs and lows.";

  return (
    <section
      className={`rounded-2xl border border-royal-200/80 bg-gradient-to-r from-royal-50/90 via-white/85 to-accent-50/90 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md dark:border-royal-700/45 dark:from-royal-950/45 dark:via-zinc-900/70 dark:to-zinc-900/55 ${
        canToggle ? "cursor-pointer transition-[border-color,box-shadow] hover:border-royal-300 hover:shadow-md" : ""
      }`}
      title={locationLabel}
      {...(canToggle
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": ariaHint,
            onClick: toggle,
            onKeyDown,
          }
        : {})}
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl text-royal drop-shadow-sm" aria-hidden>
              {weatherEmojiForCode(wx.current.code)}
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums leading-tight text-royal">{wx.current.tempC}°C</p>
              <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
                {weatherLabelForCode(wx.current.code)}
                {wx.current.windKmh != null ? ` · ${wx.current.windKmh} km/h` : ""}
              </p>
            </div>
          </div>
          {canToggle ? (
            <p className="text-center text-[10px] font-medium text-royal dark:text-royal-100">
              {view === "daily" ? "Tap for hourly" : "Tap for daily"}
            </p>
          ) : null}
        </div>

        <div className="h-10 w-px shrink-0 bg-zinc-200 dark:bg-zinc-600" aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="sr-only" aria-live="polite">
            {view === "daily" ? "Showing five-day forecast." : "Showing next six hours."}
          </p>
          <div
            {...{ [DIVISION_SWIPE_IGNORE]: "" }}
            className="flex min-w-0 gap-1 overflow-x-auto"
          >
            {view === "daily"
              ? wx.daily.slice(0, 5).map((d) => (
                  <div
                    key={d.date}
                    className="flex min-w-[2.75rem] flex-1 flex-col items-center rounded-lg bg-white/60 px-0.5 py-1 text-center text-[10px] dark:bg-zinc-800/50"
                  >
                    <p className="font-semibold leading-none text-royal dark:text-royal-100">
                      {new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
                        new Date(`${d.date}T12:00:00`),
                      )}
                    </p>
                    <span className="my-0.5 text-base leading-none" aria-hidden>
                      {weatherEmojiForCode(d.code)}
                    </span>
                    <p className="tabular-nums font-semibold text-royal dark:text-royal-100">{d.highC}°</p>
                  </div>
                ))
              : wx.hourly.slice(0, 6).map((h) => (
                  <div
                    key={h.time}
                    className="flex min-w-[2.75rem] flex-1 flex-col items-center rounded-lg bg-white/60 px-0.5 py-1 text-center text-[10px] dark:bg-zinc-800/50"
                  >
                    <p className="font-semibold leading-none text-royal dark:text-royal-100">
                      {formatHourShort(h.time)}
                    </p>
                    <span className="my-0.5 text-base leading-none" aria-hidden>
                      {weatherEmojiForCode(h.code)}
                    </span>
                    <p className="tabular-nums font-semibold text-royal dark:text-royal-100">{h.tempC}°</p>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}
