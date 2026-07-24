// Metro config that lets the example consume the library from the parent folder
// (source, not a published tarball) while keeping ONE copy of React & friends.
//
// The library is linked in as `file:..`, so Metro follows the symlink and would
// otherwise resolve `react`, `react-native`, `reanimated` and `gesture-handler`
// from the LIBRARY's own node_modules (they're devDependencies there) — two React
// copies, and every hook throws "Cannot read properties of null (reading
// 'useState')". Blocking the library's node_modules forces every import to land on
// the example's single copy. This mirrors what a published install does naturally
// (peer deps are never bundled), so it only matters for local development.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const libRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [libRoot];

const escaped = path
  .resolve(libRoot, 'node_modules')
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${escaped}${path.sep === '\\' ? '\\\\' : '/'}.*$`)];

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
