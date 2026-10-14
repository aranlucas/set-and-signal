/** Fail at the missing fixture instead of trusting a non-null assertion. */
export function requireFixture<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("Expected the test fixture to exist.");
  }

  return value;
}
