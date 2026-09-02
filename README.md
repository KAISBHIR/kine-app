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

```
npm test
```

```
npm run typecheck
```

---

## Layout

```
packages/
  shared/            landmark layout, session types, THE CUE CATALOGUE
  movement-engine/   pure TS. landmarks in, coaching events out. no DOM, no RN.
  exercise-library/  versioned exercise definitions + validation + approval gate
  pose-source/       PoseSource interface + the Web adapter
apps/
  demo-web/          Vite + MediaPipe Web. Runs on any phone browser.
  mobile/            Expo + React Native (Android native).            [Day 1]
  clinician/         Dashboard.                                        [Day 5]
services/
  api/               FastAPI + Postgres.                               [Day 4]
```

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
draft — **their thresholds are numbers an engineer guessed**, and they need a
clinician plus real recordings before they mean anything.

---

## Day 1

**Workshop first, 2 hours, clinicians in the room.** Output documents:
product name; first condition (knee); **the five exercises**; **the cue
catalogue** in French and Arabic; what the app may never say; the safety flow.

| Owner | Work | Gate |
|---|---|---|
| AI dev | Record fixtures with the demo app. Calibrate the five definitions against real angles. | Real recordings in `test/fixtures` |
| Mobile dev | Expo app booting on Android, design system, camera permissions. Not pose yet. | App on a real handset |
| Designer | Type scale, contrast, 64px targets. Home / camera setup / active exercise. | Screens agreed |
| Kais | Run the workshop. Own the cue catalogue. **Verify getUserMedia in an installed iOS PWA.** | Answers, and the iOS verdict |

End of day: live skeleton overlay in a phone browser. That already works — the
real Day 1 deliverable is replacing guessed thresholds with measured ones.

---

## Known risks

1. **Native frame processor slips.** Mitigated by design: the web track carries
   the demo.
2. **2D form detection is error-prone.** Ship few rules, heavily debounced,
   biased toward silence. A missed cue costs nothing; a wrong cue costs trust.
3. **iOS standalone-PWA camera access.** Verify Day 1. Fallback is a Safari link.
4. **`heel_raises` may not be viable.** Ankle angle from foot landmarks is noisy
   and shoes change it. Drop the exercise rather than ship a bad rep count.
5. **MediaPipe Web visibility values.** The web build has been inconsistent about
   populating them; `WebPoseSource` falls back to an in-frame heuristic and logs
   which path is active. Check the debug panel on Day 1.
