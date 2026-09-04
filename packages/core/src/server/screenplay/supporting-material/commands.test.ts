import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../../project-data-service.js';
import { createBlankMovieProject, writeConfig } from '../../testing/project-data-fixtures.js';

describe('Screenplay supporting material import', () => {
  let homeDir: string;
  let service = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-supporting-material-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    service = createProjectDataService();
    await createBlankMovieProject({
      homeDir,
      projectData: service,
      projectName: 'source-context',
      title: 'Source Context',
    });
  });

  it('retains arbitrary and empty source files as exact opaque Project assets', async () => {
    const sources = [
      ['notes.pdf', Buffer.from('%PDF illustrative bytes')],
      ['outline.md', Buffer.from('# Story notes')],
      ['research.docx', Buffer.from([0x50, 0x4b, 0x03, 0x04])],
      ['scan.png', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
      ['future.unknown', Buffer.from('unknown format')],
      ['extensionless', Buffer.from('extensionless source')],
      ['empty.txt', Buffer.alloc(0)],
      ['large.bin', Buffer.alloc(2 * 1024 * 1024, 0x5a)],
    ] as const;

    for (const [filename, bytes] of sources) {
      const sourcePath = path.join(homeDir, filename);
      await fs.writeFile(sourcePath, bytes);
      const imported = await service.importScreenplaySupportingMaterial({
        projectName: 'source-context',
        sourcePath,
        homeDir,
      });

      expect(imported.status).toBe('imported');
      expect(imported.material).toMatchObject({
        owner: { kind: 'project' },
        type: 'screenplay_supporting_material',
        mediaKind: 'file',
        origin: 'imported',
        title: filename,
        files: [{ role: 'source', mediaKind: 'file', mimeType: 'application/octet-stream' }],
      });
      const retained = path.join(
        imported.project.projectFolder,
        imported.material.files[0]!.projectRelativePath,
      );
      await expect(fs.readFile(retained)).resolves.toEqual(bytes);
      expect(imported.material.files[0]!.projectRelativePath).toBe(
        filename === 'extensionless' ? 'screenplay/extensionless.bin' : `screenplay/${filename}`,
      );
    }
  });

  it('returns the existing Asset for byte-identical material', async () => {
    const sourcePath = path.join(homeDir, 'notes.md');
    await fs.writeFile(sourcePath, 'same bytes');
    const first = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context',
      sourcePath,
      homeDir,
    });
    const second = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context',
      sourcePath,
      homeDir,
    });

    expect(second.status).toBe('unchanged');
    expect(second.material.id).toBe(first.material.id);
    await expect(service.listAssets({
      projectName: 'source-context',
      owner: { kind: 'project' },
      type: 'screenplay_supporting_material',
      homeDir,
    })).resolves.toHaveLength(1);
  });

  it('keeps changed material with the same basename as a new collision-safe Asset', async () => {
    const firstFolder = path.join(homeDir, 'first');
    const secondFolder = path.join(homeDir, 'second');
    await fs.mkdir(firstFolder);
    await fs.mkdir(secondFolder);
    const firstPath = path.join(firstFolder, 'notes.md');
    const secondPath = path.join(secondFolder, 'notes.md');
    await fs.writeFile(firstPath, 'first edition');
    await fs.writeFile(secondPath, 'second edition');

    const first = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath: firstPath, homeDir,
    });
    const second = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath: secondPath, homeDir,
    });

    expect(first.material.files[0]!.projectRelativePath).toBe('screenplay/notes.md');
    expect(second.material.files[0]!.projectRelativePath).toBe('screenplay/notes-2.md');
    expect(second.material.id).not.toBe(first.material.id);
  });

  it('does not require or mutate screenplay content', async () => {
    await service.createScreenplay({
      projectName: 'source-context',
      homeDir,
      screenplay: {
        opening: [],
        scenes: [{ key: 'room', heading: 'INT. ROOM - DAY', blocks: [] }],
        sections: [],
        structure: [{
          key: 'room-placement',
          content: { type: 'scene', scene: { key: 'room' } },
          position: 0,
        }],
        references: [],
      },
    });
    const before = await service.readScreenplayStructure({
      projectName: 'source-context', homeDir,
    });
    const revisionsBefore = await service.listScreenplayRevisions({
      projectName: 'source-context', homeDir,
    });
    const sourcePath = path.join(homeDir, 'context.anything');
    await fs.writeFile(sourcePath, 'supporting context');

    await service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath, homeDir,
    });

    await expect(service.readScreenplayStructure({
      projectName: 'source-context', homeDir,
    })).resolves.toEqual(before);
    await expect(service.listScreenplayRevisions({
      projectName: 'source-context', homeDir,
    })).resolves.toEqual(revisionsBefore);
  });

  it('imports independently into an FDX-backed Project', async () => {
    const fdxPath = path.join(homeDir, 'script.fdx');
    await fs.writeFile(
      fdxPath,
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>EXT. FIELD - DAY</Text></Paragraph>'
      + '</Content></FinalDraft>',
      'utf8',
    );
    await service.importFdxScreenplay({
      projectName: 'source-context',
      sourcePath: fdxPath,
      homeDir,
    });
    const sourcePath = path.join(homeDir, 'field-notes.pdf');
    await fs.writeFile(sourcePath, 'field context');

    const imported = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath, homeDir,
    });

    expect(imported.status).toBe('imported');
    expect(imported.material.files[0]!.projectRelativePath).toBe('screenplay/field-notes.pdf');
    await expect(service.readScreenplayStructure({
      projectName: 'source-context', homeDir,
    })).resolves.toMatchObject({ orderedSceneIds: [expect.any(String)] });
  });

  it('keeps raw supporting material out of downstream media generation context', async () => {
    await service.openCurrentProject({
      projectName: 'source-context', homeDir,
    });
    await service.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [{
          operation: 'castMember.add',
          castMember: {
            key: 'mara',
            handle: 'mara',
            name: 'Mara',
            role: 'protagonist',
            description: 'Durable accepted description.',
          },
        }],
      },
    });
    const [castMember] = await service.listCastMembers({ homeDir });
    const sourcePath = path.join(homeDir, 'private-source-notes.txt');
    await fs.writeFile(sourcePath, 'raw source wording must not travel downstream');
    const imported = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath, homeDir,
    });

    const context = await service.readMediaGenerationContext({
      homeDir,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: castMember!.id },
    });
    const serialized = JSON.stringify(context);

    expect(serialized).toContain('Durable accepted description.');
    expect(serialized).not.toContain('private-source-notes.txt');
    expect(serialized).not.toContain('raw source wording must not travel downstream');
    expect(serialized).not.toContain(imported.material.id);
  });

  it('rejects missing and non-regular sources without creating an Asset', async () => {
    await expect(service.importScreenplaySupportingMaterial({
      projectName: 'source-context',
      sourcePath: path.join(homeDir, 'missing.pdf'),
      homeDir,
    })).rejects.toMatchObject({ code: 'SCREENPLAY_SUPPORTING_MATERIAL_INVALID_SOURCE' });
    await expect(service.importScreenplaySupportingMaterial({
      projectName: 'source-context',
      sourcePath: homeDir,
      homeDir,
    })).rejects.toMatchObject({ code: 'SCREENPLAY_SUPPORTING_MATERIAL_INVALID_SOURCE' });
    await expect(service.listAssets({
      projectName: 'source-context',
      owner: { kind: 'project' },
      type: 'screenplay_supporting_material',
      homeDir,
    })).resolves.toEqual([]);
  });

  it('fails clearly when a recorded duplicate no longer matches retained bytes', async () => {
    const sourcePath = path.join(homeDir, 'notes.md');
    await fs.writeFile(sourcePath, 'original');
    const imported = await service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath, homeDir,
    });
    await fs.writeFile(
      path.join(imported.project.projectFolder, imported.material.files[0]!.projectRelativePath),
      'tampered',
    );

    await expect(service.importScreenplaySupportingMaterial({
      projectName: 'source-context', sourcePath, homeDir,
    })).rejects.toMatchObject({
      code: 'SCREENPLAY_SUPPORTING_MATERIAL_DESTINATION_CONFLICT',
    });
  });
});
