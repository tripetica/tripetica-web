export function parseBaselineThrough(argv: string[]) {
  const argument = argv.find((value) => value.startsWith("--baseline-through="));
  if (!argument) {
    return null;
  }
  const version = Number(argument.slice("--baseline-through=".length));
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("--baseline-through must be a positive integer");
  }
  return version;
}

export function parseBaselineExcept(argv: string[]) {
  const argument = argv.find((value) => value.startsWith("--baseline-except="));
  if (!argument) {
    return [];
  }
  const versions = argument
    .slice("--baseline-except=".length)
    .split(",")
    .map((value) => Number(value))
    .filter((value) => value !== 0);
  if (versions.some((value) => !Number.isInteger(value) || value < 1)) {
    throw new Error("--baseline-except must be a comma-separated list of positive integers");
  }
  return versions;
}
