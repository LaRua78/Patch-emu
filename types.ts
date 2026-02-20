
export interface FixtureType {
  id: string;
  name: string;
  manufacturer: string;
  mode: string;
  channels: number;
}

export interface FixtureInstance {
  id: string;
  fid: number; // Fixture ID in MA3
  name: string;
  typeId: string;
  universe: number;
  address: number;
  color: string;
  location: string;
  isFixed: boolean; // Identifica se pertence à montagem fixa da sala
}

export interface UniverseData {
  number: number;
  occupied: (string | null)[]; // Array of 512, stores fixture instance ID or null
}

export interface PatchState {
  fixtures: FixtureInstance[];
  universes: Record<number, UniverseData>;
  fixtureTypes: FixtureType[];
}

export type ViewMode = 'fixtureList' | 'dmxSheet' | 'patchSummary';
