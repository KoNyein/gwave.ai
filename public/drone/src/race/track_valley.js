// race/track_valley.js — Track file format (task 2.6)
// production: ဒီ format အတိုင်း JSON ကို S3/RDS ကနေ load — track editor ကလည်း ဒီ format ထုတ်
export const TRACK_VALLEY = {
  id: 'valley_1',
  name: 'VALLEY #1',
  laps: 2,
  spawn: { pos: [0, 0.08, 55], yaw: 0 },
  // gates — order = racing line, yaw radians (gate facing)
  gates: Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return {
      pos: [Math.cos(a) * 70, 0, Math.sin(a) * 70],
      yaw: Math.atan2(Math.cos(a + 0.5) * 70 - Math.cos(a) * 70,
                      Math.sin(a + 0.5) * 70 - Math.sin(a) * 70),
      width: 6, height: 5,
    };
  }),
  // static obstacles (collision + visuals) — type: cylinder
  obstacles: [],   // barrels/trees ကို main.js က random spawn ပြီး ဒီ list ထဲ ပေါင်းထည့်
};
