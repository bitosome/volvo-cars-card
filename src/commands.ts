import type { EntityState, Hass } from './types';

export type LockTarget = 'locked' | 'unlocked';
export interface PendingCommand {
  entity: string;
  target?: LockTarget;
  label: string;
}
export interface CommandFeedback {
  kind: 'pending' | 'success' | 'error' | 'info';
  message: string;
}
export interface VehicleCommandOptions {
  /** Includes service response time and, for locks, the car's acknowledgement. */
  timeoutMs?: number;
  openMoreInfo?: (entityId: string) => void;
  /** Return a cancellation function. Allows deterministic tests without real timers. */
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}

interface Operation {
  command: PendingCommand;
  accepted: boolean;
  cancelTimeout: () => void;
}

const schedule = (callback: () => void, milliseconds: number) => {
  const timer = setTimeout(callback, milliseconds);
  return () => clearTimeout(timer);
};

export function requiresLockCode(entity?: EntityState): boolean {
  const format = entity?.attributes?.code_format;
  return (
    entity?.attributes?.code_required === true ||
    (format !== undefined && format !== null && format !== '')
  );
}

/** A missing services catalogue is allowed for older HA clients and previews. */
export function hasVehicleService(
  hass: Hass | undefined,
  domain: string,
  service: string,
): boolean {
  return (
    !!hass &&
    (hass.services === undefined ||
      Object.prototype.hasOwnProperty.call(
        hass.services[domain] ?? {},
        service,
      ))
  );
}

/**
 * Explicit commands only: creating the controller and receiving telemetry never
 * sends anything. Operation identity keeps delayed replies out of a new car.
 */
export class VehicleCommands {
  pending?: PendingCommand;
  feedback?: CommandFeedback;
  private operation?: Operation;

  constructor(
    private readonly getHass: () => Hass | undefined,
    private readonly changed: () => void,
    private readonly options: VehicleCommandOptions = {},
  ) {}

  /**
   * The optional target lets a confirmation dialog bind to the action the user
   * actually confirmed. Re-reading telemetry must not reverse that action.
   */
  async lock(entityId: string, expectedTarget?: LockTarget): Promise<void> {
    if (this.operation) return;
    const hass = this.getHass();
    const entity = hass?.states[entityId];
    if (
      !/^lock\.[a-z0-9_]+$/.test(entityId) ||
      !entity ||
      !['locked', 'unlocked'].includes(entity.state)
    ) {
      this.note(
        'error',
        'The car lock is unavailable or is already changing state.',
      );
      return;
    }
    const target: LockTarget =
      entity.state === 'locked' ? 'unlocked' : 'locked';
    if (expectedTarget && target !== expectedTarget) {
      this.note('info', `The car is already ${expectedTarget}.`);
      return;
    }
    if (requiresLockCode(entity)) {
      this.note(
        'info',
        'Use the Home Assistant lock controls to enter the required code.',
      );
      this.options.openMoreInfo?.(entityId);
      return;
    }
    const service = target === 'locked' ? 'lock' : 'unlock';
    if (!hasVehicleService(hass, 'lock', service)) {
      this.note('error', `The ${service} service is unavailable.`);
      return;
    }
    const label = target === 'locked' ? 'Lock' : 'Unlock';
    const operation = this.begin({ entity: entityId, target, label });
    try {
      await hass!.callService('lock', service, { entity_id: entityId });
      if (!this.isCurrent(operation)) return;
      operation.accepted = true;
      // A state update may have arrived before the service response.
      this.update();
    } catch (error) {
      if (this.isCurrent(operation))
        this.finish('error', this.errorMessage(label, error));
    }
  }

  async press(entityId: string, label: string): Promise<void> {
    if (this.operation) return;
    const hass = this.getHass();
    const entity = hass?.states[entityId];
    // A button is legitimately "unknown" before its first press.
    if (
      !/^button\.[a-z0-9_]+$/.test(entityId) ||
      !entity ||
      entity.state === 'unavailable'
    ) {
      this.note('error', `${label} is unavailable.`);
      return;
    }
    if (!hasVehicleService(hass, 'button', 'press')) {
      this.note('error', 'The button service is unavailable.');
      return;
    }
    const operation = this.begin({ entity: entityId, label });
    try {
      await hass!.callService('button', 'press', { entity_id: entityId });
      if (this.isCurrent(operation)) {
        // Acceptance of a momentary action does not confirm its physical result.
        this.finish('info', `${label} request sent.`);
      }
    } catch (error) {
      if (this.isCurrent(operation))
        this.finish('error', this.errorMessage(label, error));
    }
  }

  update(): void {
    const operation = this.operation;
    if (!operation?.accepted || !operation.command.target) return;
    const state = this.getHass()?.states[operation.command.entity]?.state;
    if (state !== operation.command.target) return;
    this.finish(
      'success',
      operation.command.target === 'locked' ? 'Car locked.' : 'Car unlocked.',
    );
  }

  /** Call on car identity changes or disconnect, before accepting new commands. */
  reset(): void {
    this.operation?.cancelTimeout();
    this.operation = undefined;
    this.pending = undefined;
    this.feedback = undefined;
    this.changed();
  }

  clearFeedback(): void {
    if (!this.feedback) return;
    this.feedback = undefined;
    this.changed();
  }

  private isCurrent(operation: Operation): boolean {
    return this.operation === operation;
  }

  private begin(command: PendingCommand): Operation {
    const operation: Operation = {
      command,
      accepted: false,
      cancelTimeout: () => {},
    };
    this.operation = operation;
    this.pending = command;
    this.feedback = {
      kind: 'pending',
      message: command.target
        ? `${command.target === 'locked' ? 'Locking' : 'Unlocking'} car…`
        : `Sending ${command.label.toLowerCase()} request…`,
    };
    operation.cancelTimeout = (this.options.schedule ?? schedule)(() => {
      if (this.operation !== operation) return;
      this.finish(
        'error',
        command.target
          ? 'The car did not confirm the lock command. Check its current state before trying again.'
          : `${command.label} was not confirmed. Check the car before trying again.`,
      );
    }, this.options.timeoutMs ?? 45_000);
    this.changed();
    return operation;
  }

  private finish(kind: CommandFeedback['kind'], message: string): void {
    this.operation?.cancelTimeout();
    this.operation = undefined;
    this.pending = undefined;
    this.note(kind, message);
  }

  private note(kind: CommandFeedback['kind'], message: string): void {
    this.feedback = { kind, message };
    this.changed();
  }

  private errorMessage(label: string, error: unknown): string {
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof error.message === 'string'
            ? error.message
            : '';
    return detail
      ? `${label} failed: ${detail}`
      : `${label} could not be sent.`;
  }
}
