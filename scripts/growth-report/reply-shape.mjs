// A shape is 'number', 'string', [itemShape] or { field: shape }.
// Problems name field paths and expected types, never the values themselves.
export function replyShapeProblems(value, shape, path = 'reply') {
  if (typeof shape === 'string') {
    return typeof value === shape ? [] : [`${path}: expected ${shape}`];
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value)) {
      return [`${path}: expected array`];
    }
    return value.flatMap((item, index) => replyShapeProblems(item, shape[0], `${path}[${index}]`));
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path}: expected object`];
  }
  return Object.entries(shape).flatMap(([field, fieldShape]) =>
    replyShapeProblems(value[field], fieldShape, `${path}.${field}`)
  );
}
