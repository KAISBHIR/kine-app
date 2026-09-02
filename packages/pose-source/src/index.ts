/**
 * Platform-neutral pose plumbing. Safe to import from anywhere, including
 * React Native.
 *
 * The browser adapter is deliberately NOT re-exported here — it pulls in
 * @mediapipe/tasks-vision, which Metro cannot resolve. Import it explicitly:
 *
 *   import { WebPoseSource } from '@kine/pose-source/web';
 */
export * from './base';
export * from './fixture';
export * from './mock';
