# Playtest Routine

Use this routine after each feature implementation so the game gets validated with:
- input/action logs
- console + network debugging logs
- UI screenshots
- short gameplay video
- auto-generated analysis summary

## Commands

- Default (starts Expo web automatically):
```bash
npm run playtest
```

- Headed mode (visual browser while recording):
```bash
npm run playtest:headed
```

- Reuse an already running local web server:
```bash
npm run playtest:reuse
```

- Custom label and port:
```bash
bash ./scripts/playtest/run-playtest.sh --label enemy-ambush --port 8081
```

## Artifacts

Each run creates:

`output/playwright/<timestamp>-<label>/`

Inside each run folder:
- `screenshots/01-start-screen.png`
- `screenshots/02-after-menu-flow.png`
- `screenshots/03-after-gameplay-inputs.png`
- `screenshots/04-final-state.png`
- `video/*.webm`
- `logs/actions.log`
- `logs/console.log`
- `logs/network.log`
- `logs/errors.log`
- `summary.json`
- `analysis.md`

## What gets checked

The routine currently validates:
- menu flow is reachable
- in-game UI appears
- skill buttons render and are clickable
- belt overlay slots render on the room viewport
- movement/skill/belt interactions run without fatal script errors

## Recommended usage policy

Run this routine:
1. after every feature implementation
2. before opening or merging a PR
3. when debugging regressions reported by gameplay tests

