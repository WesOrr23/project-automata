/**
 * Telemetry barrel — single import point.
 *
 *   import { logEvent } from '../telemetry';
 *   logEvent('state.added', { stateId: 0 });
 *
 * See `logger.ts` for the design rationale.
 */
export {
  logEvent,
  getLog,
  clearLog,
  downloadLog,
  setLoggingEnabled,
  isLoggingEnabled,
} from './logger';
export type { TelemetryEvent } from './logger';
