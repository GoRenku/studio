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
}
