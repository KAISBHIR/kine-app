import Svg, { Circle, Line } from 'react-native-svg';
import { POSE_CONNECTIONS, type Landmark } from '@kine/shared';
import { colors } from '../theme';

export interface SkeletonProps {
  landmarks: Landmark[];
  width: number;
  height: number;
  /** Landmark indices to emphasise — normally the limb being tracked. */
  highlight?: readonly number[];
  /** Landmarks below this visibility are not drawn at all. */
  minVisibility?: number;
  /** Greys the whole figure out when tracking has been lost. */
  degraded?: boolean;
}

/**
 * Pose overlay.
 *
 * Landmarks below the visibility threshold are omitted rather than drawn in a
 * guessed position: a skeleton with a missing leg tells the patient exactly
 * what to fix, while a skeleton with a leg in the wrong place tells them the
 * app is broken.
 */
export function Skeleton({
  landmarks,
  width,
  height,
  highlight = [],
  minVisibility = 0.4,
  degraded = false,
}: SkeletonProps) {
  const hot = new Set(highlight);
  const bone = degraded ? colors.border : colors.skeleton;
  const boneHot = degraded ? colors.border : colors.skeletonActive;
  const joint = degraded ? colors.border : colors.text;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      {POSE_CONNECTIONS.map(([a, b]) => {
        const p = landmarks[a];
        const q = landmarks[b];
        if (!p || !q || p.visibility < minVisibility || q.visibility < minVisibility) {
          return null;
        }
        const active = hot.has(a) && hot.has(b);
        return (
          <Line
            key={`${a}-${b}`}
            x1={p.x * width}
            y1={p.y * height}
            x2={q.x * width}
            y2={q.y * height}
            stroke={active ? boneHot : bone}
            strokeWidth={active ? 8 : 5}
            strokeLinecap="round"
          />
        );
      })}

      {landmarks.map((p, i) => {
        // Face landmarks add clutter without adding information.
        if (i > 0 && i <= 10) return null;
        if (!p || p.visibility < minVisibility) return null;
        const active = hot.has(i);
        return (
          <Circle
            key={i}
            cx={p.x * width}
            cy={p.y * height}
            r={active ? 9 : 6}
            fill={active ? boneHot : joint}
          />
        );
      })}
    </Svg>
  );
}
