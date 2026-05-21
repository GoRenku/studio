export interface Episode {
  id: string;
  title: string;
  shortTitle?: string;
  summary?: string;
  sequences: Sequence[];
}

export interface Sequence {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  summary?: string;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  title: string;
  summary?: string;
  clips: Clip[];
}

export interface Clip {
  id: string;
  title: string;
  summary?: string;
  visualIntent?: string;
}
