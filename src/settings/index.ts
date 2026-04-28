/**
 * Settings barrel — single import point.
 *
 *   import { useSettings, SettingsModal } from '../settings';
 *
 * See store.ts and types.ts for the design rationale.
 */
export { useSettings } from './useSettings';
export { SettingsModal } from './SettingsModal';
export {
  getSettings,
  updateSetting,
  resetSettings,
  subscribe,
} from './store';
export { DEFAULT_SETTINGS, SETTINGS_SCHEMA_VERSION } from './types';
export type { Settings } from './types';
