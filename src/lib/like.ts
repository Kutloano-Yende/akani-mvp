// ilike treats % and _ as wildcards and \ as the escape character; user
// input must match literally and never widen a query.
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
