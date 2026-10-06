// Author through the genuine source SDK so fixtures contain usable domain documents.
export async function authorDocuments(service, input, idGenerator, scenes, cast, location) {
  const sceneIds = scenes.map(({ id }) => id);
  const scoreByCriterion = { stakes: 80, dramaticEnergy: 75, characterAgency: 90 };
  const scored = (sceneId) => ({ synopsis: "Opaque Ω ' 雪", scoreByCriterion,
    critique: { summary: 'Synthetic saved analysis.', evidence: [{ sceneId, text: 'Synthetic authored evidence Ω.' }],
      suggestions: ['Synthetic authored suggestion.'] } });
  await service.writeScreenplayAnalysis({ ...input, idGenerator: idGenerator(), analysis: {
    structureModel: 'threeAct', title: 'Saved Analysis Ω', summary: 'Synthetic analysis retained across upgrades.',
    criteria: Object.keys(scoreByCriterion).map((key) => ({ key, label: key, description: 'Synthetic criterion description.' })),
    actSegments: ['actOne', 'actTwo', 'actThree'].map((role, index) => ({ role, title: `Saved Act ${index + 1}`,
      sceneIds: [sceneIds[index]], ...scored(sceneIds[index]) })),
    keyBeats: ['hook', 'incitingIncident', 'firstPlotPoint', 'firstPinchPoint', 'midpoint', 'secondPinchPoint', 'secondPlotPoint', 'climax', 'resolution']
      .map((key, index) => { const sceneId = sceneIds[Math.floor(index / 3)]; return { key, label: key, sceneId, ...scored(sceneId) }; }),
    sceneAnalyses: sceneIds.map((sceneId) => ({ sceneId, ...scored(sceneId) })), suggestedScenes: [],
  } });
  await service.createSceneBeatsRevision({ ...input, idGenerator: idGenerator(), document: {
    sceneId: scenes[0].id, beats: [{ title: 'Saved Beat Ω', description: "Opaque ' 雪",
      narrativeDevelopment: 'Synthetic saved development.', narrativePurpose: 'Synthetic saved purpose.',
      castMemberIds: [cast], locationIds: [location], propIds: [],
      screenplayBlockIds: JSON.parse(scenes[0].blocks_json).map(({ id }) => id) }],
  } });
}
