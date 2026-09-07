// Placeholder photography helper. Every call site documents the intended
// real-world subject in a nearby comment so photography can swap in later.
export function picsumUrl(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}
