import { createHash } from 'node:crypto';
import { FDX_IMPORTER_VERSION } from './contracts.js';

export class FdxIdentityFactory {
  constructor(private readonly sourceSha256: string) {}

  id(prefix: string, semanticPath: string): string {
    const digest = createHash('sha256')
      .update(`${this.sourceSha256}\0${FDX_IMPORTER_VERSION}\0${semanticPath}`)
      .digest('hex')
      .slice(0, 24);
    return `${prefix}_${digest}`;
  }
}
