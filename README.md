# AI Home Rehab

Clinician-prescribed, AI-coached home rehabilitation.

A physiotherapist prescribes a program. The patient performs it at home while the
phone camera tracks their movement, counts repetitions, flags predefined form
deviations, coaches by voice, and reports results back to the clinician.

**This is not an "AI physiotherapist" and must never be described as one.** The
clinician decides what the patient does. The software helps them do it correctly.
That distinction is the safety story, the regulatory story, and the sales story.

---

## Run it

```
npm install
```

```
npm run fetch:model -w @kine/demo-web
```

```
npm run dev:web
```

Vite prints a Network URL. Open it on a phone on the same wifi — camera access
needs HTTPS or localhost, so for a physical device use the Network URL over a
tunnel, or run `npx vite preview --host` behind https.

### Mobile (Expo, Android)

```
npm start -w @kine/mobile
```

Scan the QR with Expo Go. It runs today against `MockPoseSource`, which replays
a synthetic patient — every screen, the voice coaching and the summary work
before the camera exists. Flip `POSE_SOURCE` in `src/App.tsx` to `'camera'`
once the frame processor lands; wiring steps are in `src/poseSource.ts`.

```
npm test
```

```
npm run typecheck
```

### Two config landmines already cleared — do not undo these

**1. Relative imports inside `packages/` carry no file extension.** Vite and
Vitest resolve `'./foo.js'` to `foo.ts`; Metro does not, and every `@kine/*`
import fails at bundle time. Write `from './foo'`.

**2. Dependency versions are pinned by `npx expo install`, not by npm `latest`.**
Expo SDK 57 bundles React Native 0.86.3. Installing 0.87 from npm breaks the
bundler in a way whose error message points nowhere near the cause. Add
packages with `npx expo install <pkg>` inside `apps/mobile`, and run
`npx expo install --check` when something inexplicable breaks.

Verified: `npx expo export --platform android` bundles 744 modules cleanly.

---

## Layout

```
packages/
  shared/            landmark layout, session types, THE CUE CATALOGUE
  movement-engine/   pure TS. landmarks in, coaching events out. no DOM, no RN.
  exercise-library/  versioned exercise definitions + validation + approval gate
  pose-source/       PoseSource interface, fixture recorder, mock + web adapters
apps/
  demo-web/          Vite + MediaPipe Web. Runs on any phone browser.
  mobile/            Expo + React Native. Runs on mock pose today.
  clinician/         Dashboard.                                        [Day 5]
services/
  api/               FastAPI + Postgres.                               [Day 4]
```

`@kine/pose-source` deliberately does **not** re-export the web adapter — it
pulls in `@mediapipe/tasks-vision`, which Metro cannot bundle. Import it as
`@kine/pose-source/web`.

### The seam

```
        camera (platform-specific)
                 |
          PoseSource  <-- the only thing that differs per platform
                 |
        Frame { t, landmarks[33] }
                 |
         ExerciseSession  <-- shared, tested, platform-free
                 |
        EngineEvent: rep | partialRep | formCue | visibility | phase
```

`WebPoseSource` (MediaPipe Tasks Vision) and `NativePoseSource` (VisionCamera
frame processor) are interchangeable. Everything above the seam is written once.

If you want to add a method to `PoseSource` that only one platform can
implement, the logic belongs in the engine instead.

---

## Engine pipeline

Each stage exists for a specific failure it prevents. Removing one brings that
failure back.

| Stage | Prevents |
|---|---|
| One Euro smoothing | Phantom reps from landmark jitter |
| Visibility gating | Inventing numbers when the leg is out of frame |
| Joint angles (2D only) | False precision from monocular depth |
| Hysteresis rep machine | Double-counting at the threshold |
| Accumulated hold time | Dropping a rep held right at the threshold |
| Debounced form rules | Nagging the patient until they quit |
| Calibration | Thresholds that fit nobody's actual body |

Tests live in `packages/*/test`. They run against **synthetic** landmark
sequences with known ground truth, which is what lets us assert "this is exactly
ten repetitions peaking at 165°". Recorded clips are added on Day 1 and become
regression fixtures via the recorder in the demo app (● Enregistrer → JSON).

---

## Non-negotiables

**1. Camera data stays on the device.**
Raw frames are discarded after pose extraction. What may leave the device is:

```json
{ "exercise": "seated_knee_extension", "reps": 10, "quality": 91,
  "romDeg": 74, "durationMs": 83000, "cues": ["torso_lean"] }
```

No video recorded, none uploaded, by default. The recorder writes landmarks
only, which is why fixtures are safe to commit.

**2. Range of motion is an estimate, never a measurement.**
A joint angle from one 2D camera moves with camera position, clothing, distance
and lighting. Show a trend, label it estimated. Never present it as a
goniometer reading.

Allowed verbs: guide, coach, count, remind, track, report to your clinician.
Forbidden verbs: diagnose, assess, prescribe, treat, replace, guarantee.

**3. Patient-facing strings come only from the cue catalogue.**
`packages/shared/src/cues.ts`. No component hardcodes copy. Clinicians own that
file; engineers propose, clinicians approve. `assertPatientSafe()` fails the
build if an unreviewed cue could reach a patient.

**4. Draft exercises never reach a patient.**
Every definition carries `clinical.status`. Patient code paths call
`getApprovedExercise()`, which throws on `draft`. All five currently ship as
draft, and **nothing in this repo can promote them.** Calibration fits the
numbers to a real body, which makes the rep counting correct — it says nothing
about whether the exercise is right for the person doing it. Only a
physiotherapist flips that flag.

Until one has, this is a prototype. Demo it, build on it, show it to people —
just don't hand it to a patient as a rehabilitation programme.

---

## Calibration — how the guessed numbers get fixed

Every threshold in an exercise definition describes a specific body doing a
specific movement in front of a specific camera. Shipped defaults are guesses,
and a guessed threshold produces a rep counter that is confidently wrong: a knee
that only extends to 140° never reaches a threshold set at 150°, so the app
counts zero and tells the patient they did nothing.

In the web app: pick an exercise → **Calibrer cet exercice** → do 5–8 reps at
your natural pace → **Terminer**.

You get the resting angle, the range you actually achieved, the movements
detected, and a complete definition JSON to paste over the file in
`packages/exercise-library/definitions/`.

**Read the verdict line before using the numbers.** It re-runs the real engine
over the same recording with the suggested thresholds and checks it counts the
movements that are actually in the recording. If it disagrees, the recording is
too short, too dark, or of the wrong movement — record again rather than
shipping the numbers.

Calibration fits numbers to observed movement. It does not know whether the
movement was correct, safe, or appropriate. It never promotes a definition out
of `draft`.

---

## Working order

1. **Calibrate all five exercises against your own body.** This is the highest
   value hour available, and it removes every invented number in the repo.
2. **Break it on purpose.** Bad lighting, patterned sofa, loose trousers, phone
   too low, someone walking through frame. Record fixtures for each failure
   (● Enregistrer) and add them to the test suite. This is what stops a fix for
   one room breaking another.
3. **Get one physiotherapist to spend an hour on the cue catalogue and the
   exercise list.** Not a hire, not a co-founder — an hour. It is the single
   highest-leverage outside input this project can get, and nothing in the code
   substitutes for it.
4. Then, in whatever order serves the goal: multi-exercise sessions, session
   persistence, the native camera path.

Verify `getUserMedia` inside an installed iOS PWA early — it decides whether
iPhone users get a home-screen app or a Safari link, and it is the one platform
assumption in the whole design that has not been tested.

---

## Known risks

1. **2D form detection is error-prone.** Ship few rules, heavily debounced,
   biased toward silence. A missed cue costs nothing; a wrong cue costs trust.
2. **iOS standalone-PWA camera access.** Unverified. Fallback is a Safari link.
3. **`heel_raises` may not be viable.** Ankle angle from foot landmarks is noisy
   and shoes change it. Drop the exercise rather than ship a bad rep count.
4. **MediaPipe Web visibility values.** The web build has been inconsistent
   about populating them; `WebPoseSource` falls back to an in-frame heuristic
   and logs which path is active. Check the debug panel.
5. **The native camera path is unbuilt.** The Expo app runs on a mock. Until a
   VisionCamera frame processor exists, the browser is the only place real pose
   tracking happens — which is fine, because the browser reaches every phone.
