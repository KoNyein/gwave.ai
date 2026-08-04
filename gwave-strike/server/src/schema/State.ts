import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/// Authoritative match state (blueprint §4.2). Colyseus diffs this and
/// streams patches at SNAPSHOT_RATE.

export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "Player";
  @type("uint8") team = 0;
  @type("boolean") bot = false;
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("float32") yaw = 0;
  @type("float32") pitch = 0;
  @type("int16") hp = 100;
  @type("string") weapon = "rifle";
  @type("string") anim = "idle";
  @type("uint16") kills = 0;
  @type("uint16") deaths = 0;
  /// Last input sequence the sim consumed — client reconciliation anchor
  @type("uint32") lastSeq = 0;
}

export class MatchState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("uint16") scoreBlue = 0;
  @type("uint16") scoreRed = 0;
  @type(["string"]) killfeed = new ArraySchema<string>();
  @type("boolean") over = false;
}
