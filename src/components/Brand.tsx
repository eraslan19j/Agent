import { MyVisionLogo } from './MyVisionLogo';

/** Backwards-compatible brand lockup used by navigation headers. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return <MyVisionLogo variant="wordmark" size={compact ? 31 : 38} className="brand-lockup" />;
}
