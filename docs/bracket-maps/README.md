# Elimination bracket maps (review packet)

Generated with:

```bash
npm run bracket-maps:generate
```

## Files

| File | Contents |
|------|----------|
| [double-elimination-6-to-50.pdf](./double-elimination-6-to-50.pdf) | Cover, index table, one landscape page per team count 6–50 |
| [triple-elimination-6-to-50.pdf](./triple-elimination-6-to-50.pdf) | Same for **proposed** triple-elim (not shipped in the app) |

## Conventions

- Field size pads to the next power of 2 with **BYE**s (same as Tournament Hub).
- Seeds use classic single-elim order (`S1`…); top seeds receive byes first.
- **Double:** winners + losers + one grand final (no IF necessary rematch series).
- **Triple:** review-only W / L1 / L2 model — validate before implementing.
