/// Terrain height — THE function. Client renders/collides with it and the
/// server sim grounds players with it; they must be bit-identical, which is
/// why it lives in shared/.

export function terrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.045) * Math.cos(z * 0.038) * 2.2 +
    Math.sin(x * 0.012 + 1.7) * 3.5 +
    Math.cos(z * 0.017 + 0.4) * 2.6
  );
}
