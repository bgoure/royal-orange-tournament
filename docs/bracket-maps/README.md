# Elimination bracket maps (review packet)

Generated with:

```bash
npm run bracket-maps:generate
```

## Files (poster style)

| File | Contents |
|------|----------|
| [double-elimination-6-to-50-poster.pdf](./double-elimination-6-to-50-poster.pdf) | **Use this** — center Round 1, winners right, losers left (like the 27-team reference) |
| [triple-elimination-6-to-50-poster.pdf](./triple-elimination-6-to-50-poster.pdf) | Same layout + L2 lane (proposed) |
| [reference-27-team-double-elim.png](./reference-27-team-double-elim.png) | Your reference poster |

If `double-elimination-6-to-50.pdf` is open in a viewer, regenerate writes `*-poster.pdf` first so generation still succeeds.

## Layout

- **Center:** Round 1 games (Seed vs Seed) + bye callout
- **Right:** Winners-bracket rounds (blue feed lines)
- **Left:** Losers-bracket rounds (grey drop lines; red “eliminated” notes)
- **Late rounds:** `RE-DRAW` cards when ≤6 teams remain (avoid rematches where possible)
- Each card: **G#**, two slots, score boxes, fate note
