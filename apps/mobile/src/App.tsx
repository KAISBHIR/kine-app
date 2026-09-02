import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Locale, SessionSummary } from '@kine/shared';
import { getExercise } from '@kine/exercise-library';
import { HomeScreen } from './screens/HomeScreen';
import { SessionScreen } from './screens/SessionScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import type { PoseSourceKind } from './poseSource';

const LOCALE: Locale = 'fr';
const TARGET_REPS = 10;

/**
 * Pose input for this build.
 *
 * 'mock' replays a synthetic patient so every screen works today. Flip to
 * 'camera' once the VisionCamera frame processor is wired — see poseSource.ts.
 */
const POSE_SOURCE: PoseSourceKind = 'mock';

/**
 * Screen switching is a plain state machine on purpose.
 *
 * With three screens, react-navigation is more setup than it is worth and one
 * more thing to break on a first `expo start`. Introduce it when the clinician
 * connection, profile and history screens land and back-stack behaviour starts
 * to matter.
 */
type Route =
  | { name: 'home' }
  | { name: 'session' }
  | { name: 'summary'; summary: SessionSummary };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  // The prescribed program. Comes from the clinician via the API from Day 4;
  // hardcoded to one exercise until then.
  const program = [getExercise('seated_knee_extension')];
  const current = program[0]!;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {route.name === 'home' && (
        <HomeScreen
          patientName="Ahmed"
          locale={LOCALE}
          program={program}
          targetReps={TARGET_REPS}
          onStart={() => setRoute({ name: 'session' })}
        />
      )}

      {route.name === 'session' && (
        <SessionScreen
          def={current}
          targetReps={TARGET_REPS}
          locale={LOCALE}
          sourceKind={POSE_SOURCE}
          onFinish={(summary) => setRoute({ name: 'summary', summary })}
        />
      )}

      {route.name === 'summary' && (
        <SummaryScreen
          summary={route.summary}
          locale={LOCALE}
          onDone={() => setRoute({ name: 'home' })}
        />
      )}
    </SafeAreaProvider>
  );
}
