# Documentary assets

Fifteen images, all **1920 × 1080** PNG — drop straight into a 1080p timeline.

Regenerate any time with:

```bash
python3 docs/make-video-assets.py
```

---

## Where each one goes

| Time | File | Hold |
|---|---|---|
| 0:20 | `00-title.png` | 3s |
| 0:00 | `10-card-problem.png` | 2s |
| 0:05 | `01-problem-today.png` | 6s |
| 0:45 | `11-card-research.png` | 2s |
| 0:50 | `../erd.png` | 5s |
| 1:20 | `12-card-build.png` | 2s |
| 1:25 | `03-architecture.png` | 6s |
| 1:55 | `13-card-offline.png` | 2s |
| 2:00 | `04-offline-flow.png` | 8s |
| 2:15 | *(screen recording — the offline demo)* | 30s |
| 2:30 | `14-card-testing.png` | 2s |
| 2:40 | `05-testing-found.png` | 8s |
| 3:05 | `02-solution-now.png` | 6s |
| 3:15 | `06-numbers.png` | 5s |
| 3:30 | `15-card-mission.png` | 2s |
| 3:45 | `99-credits.png` | 8s |

---

## The files

**Diagrams**

- `01-problem-today` — the manual reporting chain, with how late each step is
- `02-solution-now` — the same journey through SiteLog
- `03-architecture` — phone → Render → Neon, and why that stack
- `04-offline-flow` — the five-step sequence that makes offline work
- `05-testing-found` — the three faults the tests missed
- `06-numbers` — 228 tests, 11 weeks, 297 hours, compression figures
- `../erd.png` — the entity relationship diagram

**Title cards** (dark green, for transitions)

`00-title` · `10-card-problem` · `11-card-research` · `12-card-build` · `13-card-offline` · `14-card-testing` · `15-card-mission` · `99-credits`

---

## Still needed from you

Screen recordings — these can only come from the live system:

1. The live URL in the address bar
2. A full report submission on a phone
3. **Wifi off → Send → banner → wifi on → syncs** ← record three times
4. The manager dashboard, with real data in it
5. The exported weekly PDF, open
6. `npm run test:all` in a terminal
7. Your GitHub commit history, scrolling
8. You, to camera, for the mission section

---

## Notes

- **Title cards hold 2 seconds.** Longer and the video drags; these are punctuation, not content.
- **Diagrams need 5–8 seconds** — a viewer has to read them. Narrate over the top.
- Every card is `#0f3d2e`, the same green as the app, so cuts between a card and a screenshot feel deliberate.
- `.svg` versions sit alongside each `.png` if you want to edit the wording.
