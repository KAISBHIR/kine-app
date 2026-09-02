/**
 * Metro config for an npm-workspaces monorepo.
 *
 * Without this, Metro cannot see packages/ and every `@kine/*` import fails
 * with "Unable to resolve module". This is the single fiddliest piece of
 * monorepo React Native setup — it is done, do not delete it.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so edits in packages/ trigger a reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Stop Metro walking up past the workspace root looking for duplicates.
config.resolver.disableHierarchicalLookup = true;

// 4. Honour the "exports" map in package.json. Required so that importing
//    `@kine/pose-source` gets the platform-neutral entry and never pulls in
//    the MediaPipe web adapter, which Metro cannot bundle.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
