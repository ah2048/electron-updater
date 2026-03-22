/**
 * Tests for directUpdate mode logic
 * Validates 'onLaunch', 'atInstall', 'always', and false modes
 */

import { describe, it, expect, vi } from 'vitest';
import type { StorageManager } from '../src/main/storage';
import type { DirectUpdateMode } from '../src/shared/types';

/**
 * Helper that mirrors the shouldDirectUpdate logic from ElectronUpdater.
 * This isolates the mode-selection logic for focused testing.
 */
function shouldDirectUpdate(
  directUpdate: DirectUpdateMode,
  isLaunchPhase: boolean,
  nativeVersionChanged: boolean
): boolean {
  if (directUpdate === true || directUpdate === 'always') {
    return true;
  }

  if (directUpdate === 'onLaunch') {
    return isLaunchPhase;
  }

  if (directUpdate === 'atInstall') {
    return nativeVersionChanged;
  }

  return false;
}

/**
 * Helper that mirrors shouldTriggerLaunchCheck logic.
 */
function shouldTriggerLaunchCheck(directUpdate: DirectUpdateMode): boolean {
  return directUpdate === 'onLaunch' || directUpdate === 'atInstall';
}

/**
 * Helper that mirrors detectNativeVersionChange logic.
 */
function detectNativeVersionChange(
  currentVersion: string,
  previousVersion: string | null
): boolean {
  if (previousVersion === null) {
    return true;
  }
  return previousVersion !== currentVersion;
}

describe('directUpdate mode logic', () => {
  describe('shouldDirectUpdate', () => {
    describe('false mode (default)', () => {
      it('should return false regardless of launch phase', () => {
        expect(shouldDirectUpdate(false, true, false)).toBe(false);
        expect(shouldDirectUpdate(false, false, false)).toBe(false);
      });

      it('should return false regardless of native version change', () => {
        expect(shouldDirectUpdate(false, false, true)).toBe(false);
        expect(shouldDirectUpdate(false, true, true)).toBe(false);
      });
    });

    describe('true mode', () => {
      it('should always return true', () => {
        expect(shouldDirectUpdate(true, true, false)).toBe(true);
        expect(shouldDirectUpdate(true, false, false)).toBe(true);
        expect(shouldDirectUpdate(true, false, true)).toBe(true);
      });
    });

    describe("'always' mode", () => {
      it('should always return true', () => {
        expect(shouldDirectUpdate('always', true, false)).toBe(true);
        expect(shouldDirectUpdate('always', false, false)).toBe(true);
        expect(shouldDirectUpdate('always', false, true)).toBe(true);
      });
    });

    describe("'onLaunch' mode", () => {
      it('should return true during launch phase', () => {
        expect(shouldDirectUpdate('onLaunch', true, false)).toBe(true);
      });

      it('should return false after launch phase', () => {
        expect(shouldDirectUpdate('onLaunch', false, false)).toBe(false);
      });

      it('should return true during launch phase even without native version change', () => {
        expect(shouldDirectUpdate('onLaunch', true, false)).toBe(true);
      });

      it('should return false after launch phase even with native version change', () => {
        expect(shouldDirectUpdate('onLaunch', false, true)).toBe(false);
      });
    });

    describe("'atInstall' mode", () => {
      it('should return true when native version changed', () => {
        expect(shouldDirectUpdate('atInstall', false, true)).toBe(true);
      });

      it('should return false when native version has not changed', () => {
        expect(shouldDirectUpdate('atInstall', false, false)).toBe(false);
      });

      it('should return true when native version changed regardless of launch phase', () => {
        expect(shouldDirectUpdate('atInstall', true, true)).toBe(true);
        expect(shouldDirectUpdate('atInstall', false, true)).toBe(true);
      });

      it('should return false when version unchanged regardless of launch phase', () => {
        expect(shouldDirectUpdate('atInstall', true, false)).toBe(false);
        expect(shouldDirectUpdate('atInstall', false, false)).toBe(false);
      });
    });
  });

  describe('shouldTriggerLaunchCheck', () => {
    it('should return true for onLaunch mode', () => {
      expect(shouldTriggerLaunchCheck('onLaunch')).toBe(true);
    });

    it('should return true for atInstall mode', () => {
      expect(shouldTriggerLaunchCheck('atInstall')).toBe(true);
    });

    it('should return false for false mode', () => {
      expect(shouldTriggerLaunchCheck(false)).toBe(false);
    });

    it('should return false for true mode', () => {
      expect(shouldTriggerLaunchCheck(true)).toBe(false);
    });

    it('should return false for always mode', () => {
      expect(shouldTriggerLaunchCheck('always')).toBe(false);
    });
  });

  describe('detectNativeVersionChange', () => {
    it('should return true on fresh install (no previous version)', () => {
      expect(detectNativeVersionChange('1.0.0', null)).toBe(true);
    });

    it('should return true when version changed (store update)', () => {
      expect(detectNativeVersionChange('2.0.0', '1.0.0')).toBe(true);
    });

    it('should return false when version is the same', () => {
      expect(detectNativeVersionChange('1.0.0', '1.0.0')).toBe(false);
    });

    it('should detect minor version changes', () => {
      expect(detectNativeVersionChange('1.1.0', '1.0.0')).toBe(true);
    });

    it('should detect patch version changes', () => {
      expect(detectNativeVersionChange('1.0.1', '1.0.0')).toBe(true);
    });

    it('should detect downgrades', () => {
      expect(detectNativeVersionChange('1.0.0', '2.0.0')).toBe(true);
    });
  });

  describe('storage previousNativeVersion integration', () => {
    function createMockStorage(previousVersion: string | null = null): StorageManager {
      let storedVersion: string | null = previousVersion;

      return {
        getPreviousNativeVersion: vi.fn(() => storedVersion),
        setPreviousNativeVersion: vi.fn((version: string | null) => {
          storedVersion = version;
        }),
        save: vi.fn().mockResolvedValue(undefined),
      } as unknown as StorageManager;
    }

    it('should detect fresh install when no version stored', () => {
      const storage = createMockStorage(null);
      const currentVersion = '1.0.0';

      const changed = detectNativeVersionChange(
        currentVersion,
        storage.getPreviousNativeVersion()
      );

      expect(changed).toBe(true);
    });

    it('should detect version change after store update', () => {
      const storage = createMockStorage('1.0.0');
      const currentVersion = '2.0.0';

      const changed = detectNativeVersionChange(
        currentVersion,
        storage.getPreviousNativeVersion()
      );

      expect(changed).toBe(true);
    });

    it('should not detect change when version matches', () => {
      const storage = createMockStorage('1.0.0');
      const currentVersion = '1.0.0';

      const changed = detectNativeVersionChange(
        currentVersion,
        storage.getPreviousNativeVersion()
      );

      expect(changed).toBe(false);
    });
  });
});
