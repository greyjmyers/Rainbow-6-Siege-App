# PrepPhase

A between-rounds lineup optimizer for a Rainbow Six Siege squad. Pick the map and side,
tap who's playing, and it recommends the operator for each player, an estimated round
win chance, and (on attack) where the defenders probably are. Tap **Won / Lost** after
each round and the estimates sharpen from your own results.

Live: https://greyjmyers.github.io/Rainbow-6-Siege-App/ (after Pages is enabled — see below)

## How the recommendation works

- **Player × operator edge.** Each player rates operators 1–5 (or ✕ = won't play). That
  rating is a prior; logged rounds on that operator gradually override it.
- **Base rate.** Your win rate for map → side → site, each level shrunk toward the one
  above it so a handful of rounds can't swing it wildly.
- **Composition rules.** Missing a hard breacher on attack or anti-breach on defense
  costs win chance. Minimums and penalties are editable in **Setup**, including per-site
  overrides (e.g. "this site needs two hard breachers").
- **Site prediction (attack).** You pick operators before you know the site, so the
  attack lineup is optimized against the *probability* of each site: how often you've
  seen each site on that map, plus whether defenders tend to stay after winning.
- **Search.** Exhaustive search over each player's best candidates with branch-and-bound
  pruning; no two players get the same operator; bans and locks respected.

The win % is an estimate from your own logged rounds and ratings — with no history it's
almost entirely driven by comfort ratings, and the app says so.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # engine unit tests
npm run build    # typecheck + production build
```

Data is stored in the browser (localStorage). Use **Setup → Export JSON** to back up or
share with squadmates.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to
`main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
