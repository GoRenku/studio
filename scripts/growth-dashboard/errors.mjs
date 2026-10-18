export class GrowthDashboardError extends Error {
  constructor(code, message, suggestion) {
    super(`${code} ${message}`);
    this.name = 'GrowthDashboardError';
    this.code = code;
    this.suggestion = suggestion;
  }
}
