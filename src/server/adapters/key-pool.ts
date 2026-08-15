export class AllKeysExhaustedError extends Error {
  constructor(
    public readonly provider: string,
    message = `All API keys for ${provider} are exhausted or cooling down`,
  ) {
    super(message);
    this.name = "AllKeysExhaustedError";
  }
}

type FailureKind = "quota" | "auth" | "network";

interface KeyState {
  key: string;
  exhaustedUntil: number | null; // epoch ms; null = available
  disabled: boolean; // auth failures are permanent
  remaining?: number;
}

const QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1h default when reset unknown

export class KeyPool {
  private states: KeyState[];
  private cursor = 0;

  constructor(
    keys: string[],
    private opts: { now?: () => number } = {},
  ) {
    this.states = keys
      .map((k) => k.trim())
      .filter(Boolean)
      .map((key) => ({ key, exhaustedUntil: null, disabled: false }));
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  next(): string {
    const n = this.states.length;
    for (let i = 0; i < n; i++) {
      const state = this.states[(this.cursor + i) % n];
      if (this.isAvailable(state)) {
        this.cursor = (this.cursor + i + 1) % n;
        return state.key;
      }
    }
    throw new AllKeysExhaustedError("provider");
  }

  private isAvailable(state: KeyState): boolean {
    if (state.disabled) return false;
    if (state.exhaustedUntil === null) return true;
    if (this.now() >= state.exhaustedUntil) {
      state.exhaustedUntil = null;
      return true;
    }
    return false;
  }

  reportFailure(key: string, kind: FailureKind, cooldownMs?: number): void {
    const state = this.states.find((s) => s.key === key);
    if (!state) return;
    if (kind === "auth") {
      state.disabled = true;
    } else if (kind === "quota") {
      // Per-minute rate limits should recover in seconds; daily quotas need
      // the long cooldown. Callers pass the right window via cooldownMs.
      state.exhaustedUntil = this.now() + (cooldownMs ?? QUOTA_COOLDOWN_MS);
    }
    // network: transient, keep the key in rotation
  }

  reportRemaining(key: string, remaining: number, resetEpochMs: number): void {
    const state = this.states.find((s) => s.key === key);
    if (!state) return;
    state.remaining = remaining;
    if (remaining <= 0) {
      state.exhaustedUntil = Math.max(resetEpochMs, this.now() + 1000);
    }
  }

  remaining(key: string): number | undefined {
    return this.states.find((s) => s.key === key)?.remaining;
  }

  get size(): number {
    return this.states.length;
  }
}
