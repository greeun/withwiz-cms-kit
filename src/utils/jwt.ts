import { JWTManager } from '@withwiz/toolkit/core/auth/jwt';
import { logInfo, logError } from '@withwiz/toolkit/core/logger/logger';
import { resolveJwtConfig } from '../config';

let _jwtManager: JWTManager | null = null;

/**
 * JWT 매니저 싱글턴 (spec.md §4.6 / §4.3 / Sprint 1 S3).
 *
 * secret/expiry/algorithm 은 §5 config boundary (`resolveJwtConfig`) 를 통해
 * 해석된다: 명시적 주입 > `process.env.JWT_SECRET` 레거시 fallback > (서명
 * 비밀에는 안전한 기본값이 없음 → point-of-use fail-fast).
 *
 * - 비밀 누락: `@withwiz/pms:` 네임스페이스 에러로 즉시 throw (undefined 로
 *   조용히 JWTManager 를 만들지 않는다).
 * - 비밀 취약(<32자, 문서화 정책): `@withwiz/pms:` 네임스페이스 에러로 거부
 *   (forgeable 서명 키는 unsafe-no-safe-default).
 * - import 만으로는 절대 throw 하지 않는다 (lazy / point-of-use).
 *   기존의 JWT_SECRET non-null 단정(bang) 직접 접근은 제거되었다.
 */
export function getJWTManager(): JWTManager {
  if (!_jwtManager) {
    const { secret, accessTokenExpiry, refreshTokenExpiry, algorithm } =
      resolveJwtConfig();
    _jwtManager = new JWTManager(
      {
        secret,
        accessTokenExpiry,
        refreshTokenExpiry,
        algorithm,
      },
      {
        debug: () => {},
        info: (msg: string, meta?: any) => logInfo(`[JWT] ${msg}`, meta),
        warn: (msg: string, meta?: any) => logInfo(`[JWT] ${msg}`, meta),
        error: (msg: string, meta?: any) => logError(`[JWT] ${msg}`, meta),
      },
    );
  }
  return _jwtManager;
}
