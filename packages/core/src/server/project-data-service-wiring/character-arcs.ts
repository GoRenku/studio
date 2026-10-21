import {
  listCharacterArcs,
  readCharacterArc,
  validateCharacterArcs,
  writeCharacterArcs,
} from '../character-arcs/commands.js';
import { readCastMemberCharacterArcResource } from '../character-arcs/resource.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createCharacterArcServiceWiring(): Pick<
  ProjectDataService,
  | 'validateCharacterArcs' | 'writeCharacterArcs' | 'listCharacterArcs' | 'readCharacterArc'
  | 'readCastMemberCharacterArcResource'
> {
  return {
    validateCharacterArcs,
    writeCharacterArcs,
    listCharacterArcs,
    readCharacterArc,
    readCastMemberCharacterArcResource,
  };
}
