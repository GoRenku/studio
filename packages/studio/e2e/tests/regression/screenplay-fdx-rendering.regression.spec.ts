import { expect, test } from '../../fixtures/studio-e2e-test';

test('renders Brick and Steel Dual Dialogue as independent side-by-side turns', async ({
  page,
  brickAndSteelProject,
}) => {
  await page.goto(sceneRoute(
    brickAndSteelProject.projectName,
    brickAndSteelProject.patioSceneId
  ));
  await expect(page.getByRole('heading', { name: 'Ext. Brick’s patio - day' }))
    .toBeVisible();
  await expect(page.getByText(
    'A gorgeous day.  The sun is shining.  But BRICK BRADDOCK, retired police detective, is sitting quietly, contemplating -- something.',
    { exact: true }
  )).toBeVisible();
  await expect(page.getByText(
    'And then there’s a long beat.\nLonger than is funny.\nLong enough to be depressing.',
    { exact: true }
  )).toBeVisible();

  const dualDialogue = page.getByRole('region', { name: 'Dual Dialogue' });
  await expect(dualDialogue).toBeVisible();
  await expect(dualDialogue.getByRole('group', { name: 'Dialogue by STEEL' }))
    .toContainText('Screw retirement.');
  await expect(dualDialogue.getByRole('group', { name: 'Dialogue by BRICK' }))
    .toContainText('Screw retirement.');
  const boxes = await Promise.all([
    dualDialogue.getByRole('group', { name: 'Dialogue by STEEL' }).boundingBox(),
    dualDialogue.getByRole('group', { name: 'Dialogue by BRICK' }).boundingBox(),
  ]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(2);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x);

  await dualDialogue.getByRole('button', { name: 'STEEL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close dialogue audio panel' }))
    .toBeVisible();
  await page.getByRole('button', { name: 'Close dialogue audio panel' }).click();
  await dualDialogue.getByRole('button', { name: 'BRICK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close dialogue audio panel' }))
    .toBeVisible();
});

test('renders ordered Parenthetical and speech parts in a single complex turn', async ({
  page,
  brickAndSteelProject,
}) => {
  await page.goto(sceneRoute(
    brickAndSteelProject.projectName,
    brickAndSteelProject.poolSceneId
  ));
  await expect(page.getByRole('heading', { name: 'Ext. Brick’s pool - day' }))
    .toBeVisible();
  const steelDialogue = page.getByRole('group', { name: 'Dialogue by STEEL' });
  await expect(steelDialogue.locator('p')).toHaveText([
    'They’re coming out of the woodwork!',
    '(pause)',
    'No, everybody we’ve put away!',
    '(pause)',
    'Point Blank Sniper?',
  ]);
});

test('renders multiline opening-title Action and its following Transition', async ({
  page,
  brickAndSteelProject,
}) => {
  await page.goto(sceneRoute(
    brickAndSteelProject.projectName,
    brickAndSteelProject.openingTitlesSceneId
  ));
  await expect(page.getByRole('heading', { name: 'OPENING Titles' })).toBeVisible();
  await expect(page.getByText('BRICK BRADDOCK\n& DICK STEEL IN', { exact: true }))
    .toBeVisible();
  await expect(page.getByText('BRICK & STEEL\nFULL RETIRED', { exact: true }))
    .toBeVisible();
  await expect(page.getByText('SmaSH CUT TO:', { exact: true })).toBeVisible();
});

function sceneRoute(projectName: string, sceneId: string): string {
  return `/projects/${encodeURIComponent(projectName)}/scenes/${encodeURIComponent(sceneId)}`;
}
