// Movement Debugging System
// Tracks all movement events and state changes for analysis

export type Direction = 'N' | 'S' | 'E' | 'W';
export type MoveType = 'forward' | 'reverse' | 'turn_L' | 'turn_R';

export interface Position {
  x: number;
  y: number;
}

export interface MovementEvent {
  id: number;
  timestamp: number;
  type: MoveType;
  fromPos: Position;
  toPos: Position;
  fromDir: Direction;
  toDir: Direction;
  tileType: number;
  currentArrPos: number;
  newArrPos: number;
  iniDir: boolean;
  newIniDir: boolean;
  lastTurnDir: string;
  success: boolean;
  notes: string[];
}

export interface DebugState {
  position: Position;
  direction: Direction;
  tileType: number;
  currentArrPos: number;
  iniDir: boolean;
  lastTurnDir: string;
  mapArrayLength: number;
  pathTileCount: number;
}

class MovementDebugger {
  private enabled: boolean = true;
  private history: MovementEvent[] = [];
  private eventId: number = 0;
  private maxHistory: number = 50;
  private currentEvent: Partial<MovementEvent> | null = null;
  private stateSnapshots: DebugState[] = [];
  private onUpdate: (() => void) | null = null;

  // Enable/disable debugging
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[DEBUG] Movement debugging ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Set callback for UI updates
  setOnUpdate(callback: () => void): void {
    this.onUpdate = callback;
  }

  // Start tracking a new movement event
  startMove(type: MoveType, state: {
    posX: number;
    posY: number;
    direction: Direction;
    currentArrPos: number;
    iniDir: boolean;
    lastTurnDir: string;
    tileType?: number;
  }): void {
    if (!this.enabled) return;

    this.currentEvent = {
      id: ++this.eventId,
      timestamp: Date.now(),
      type,
      fromPos: { x: state.posX, y: state.posY },
      fromDir: state.direction,
      currentArrPos: state.currentArrPos,
      iniDir: state.iniDir,
      lastTurnDir: state.lastTurnDir,
      tileType: state.tileType ?? -1,
      notes: [],
    };

    this.log(`START ${type}`, {
      pos: `(${state.posX}, ${state.posY})`,
      dir: state.direction,
      arrPos: state.currentArrPos,
      iniDir: state.iniDir,
    });
  }

  // Add a note to current event
  addNote(note: string): void {
    if (!this.enabled || !this.currentEvent) return;
    this.currentEvent.notes = this.currentEvent.notes || [];
    this.currentEvent.notes.push(note);
    this.log(`NOTE: ${note}`);
  }

  // Complete the current movement event
  endMove(state: {
    posX: number;
    posY: number;
    direction: Direction;
    currentArrPos: number;
    iniDir: boolean;
    success: boolean;
  }): void {
    if (!this.enabled || !this.currentEvent) return;

    const event: MovementEvent = {
      ...this.currentEvent as MovementEvent,
      toPos: { x: state.posX, y: state.posY },
      toDir: state.direction,
      newArrPos: state.currentArrPos,
      newIniDir: state.iniDir,
      success: state.success,
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.log(`END ${event.type}`, {
      result: state.success ? 'SUCCESS' : 'FAILED',
      toPos: `(${state.posX}, ${state.posY})`,
      toDir: state.direction,
      newArrPos: state.currentArrPos,
      iniDirChanged: event.iniDir !== state.iniDir,
    });

    this.currentEvent = null;
    this.onUpdate?.();
  }

  // Take a snapshot of current state
  snapshot(state: DebugState): void {
    if (!this.enabled) return;
    this.stateSnapshots.push({ ...state, });
    if (this.stateSnapshots.length > 20) {
      this.stateSnapshots.shift();
    }
  }

  // Get movement history
  getHistory(): MovementEvent[] {
    return [...this.history];
  }

  // Get last N events
  getRecentHistory(count: number = 10): MovementEvent[] {
    return this.history.slice(-count);
  }

  // Get state snapshots
  getSnapshots(): DebugState[] {
    return [...this.stateSnapshots];
  }

  // Clear all history
  clearHistory(): void {
    this.history = [];
    this.stateSnapshots = [];
    this.eventId = 0;
    this.log('History cleared');
    this.onUpdate?.();
  }

  // Export history as JSON string
  exportHistory(): string {
    return JSON.stringify({
      exported: new Date().toISOString(),
      events: this.history,
      snapshots: this.stateSnapshots,
    }, null, 2);
  }

  // Formatted log output
  private log(message: string, data?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    if (data) {
      console.log(`[MOVE ${timestamp}] ${message}`, data);
    } else {
      console.log(`[MOVE ${timestamp}] ${message}`);
    }
  }

  // Format event for display
  formatEvent(event: MovementEvent): string {
    const typeSymbol = {
      'forward': 'FWD',
      'reverse': 'REV',
      'turn_L': 'TRN-L',
      'turn_R': 'TRN-R',
    }[event.type];

    const posChange = `(${event.fromPos.x},${event.fromPos.y})->(${event.toPos.x},${event.toPos.y})`;
    const dirChange = event.fromDir !== event.toDir
      ? `${event.fromDir}->${event.toDir}`
      : event.fromDir;
    const status = event.success ? 'OK' : 'FAIL';

    return `${typeSymbol} ${dirChange} ${posChange} [${status}]`;
  }

  // Get current tile type name
  getTileTypeName(type: number): string {
    const names: Record<number, string> = {
      0: 'Wall',
      1: 'Corridor',
      2: 'Turn',
      3: '3-Way',
      4: '4-Way',
      5: 'Door',
      6: 'Stairs Up',
      7: 'Stairs Down',
      8: 'Dead End',
    };
    return names[type] ?? `Unknown(${type})`;
  }

  // Get direction full name
  getDirectionName(dir: Direction): string {
    const names: Record<Direction, string> = {
      'N': 'North',
      'S': 'South',
      'E': 'East',
      'W': 'West',
    };
    return names[dir];
  }
}

// Singleton instance
export const movementDebug = new MovementDebugger();

// Convenience functions
export const debugMove = {
  start: (type: MoveType, state: Parameters<MovementDebugger['startMove']>[1]) =>
    movementDebug.startMove(type, state),

  note: (note: string) =>
    movementDebug.addNote(note),

  end: (state: Parameters<MovementDebugger['endMove']>[0]) =>
    movementDebug.endMove(state),

  snapshot: (state: DebugState) =>
    movementDebug.snapshot(state),
};
