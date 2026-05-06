let selectedProjectName: string | null = null;

export function getSelectedProjectName(): string | null {
  return selectedProjectName;
}

export function setSelectedProjectName(projectName: string): void {
  selectedProjectName = projectName;
}
