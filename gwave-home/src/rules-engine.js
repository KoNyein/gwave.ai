/**
 * ============================================================
 * RULES ENGINE (L5 - Automation)
 * ------------------------------------------------------------
 * Rule format (gh_rules.definition):
 * {
 *   "trigger": { "device":"dev_farm01_soil1", "trait":"sensor.soil_moisture",
 *                "condition":"lt", "value":30 }
 *          — ဒါမှမဟုတ် —
 *   "trigger": { "type":"schedule", "time":"06:00" }
 *          — ဒါမှမဟုတ် —
 *   "trigger": { "type":"event", "device":"dev_farm01_cam_gate",
 *                "event":"motion" }
 *
 *   "conditions": [ {"type":"time_between","from":"06:00","to":"18:00"} ],
 *   "actions": [
 *     {"device":"dev_farm01_pump1","command":"setOn","params":{"on":true}},
 *     {"type":"delay","seconds":600},
 *     {"device":"dev_farm01_pump1","command":"setOn","params":{"on":false}},
 *     {"type":"notify","message":"Zone 1 ရေပေးပြီးပါပြီ"}
 *   ],
 *   "cooldown_seconds": 3600
 * }
 * ============================================================
 */

const OPS = {
  lt:  (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt:  (a, b) => a > b,
  gte: (a, b) => a >= b,
  eq:  (a, b) => a === b,
};

class RulesEngine {
  constructor(pool, registry, notifier) {
    this.pool = pool;
    this.registry = registry;
    this.notifier = notifier;
    this.rules = [];
    this._running = new Set();      // တစ်ပြိုင်နက် နှစ်ခါမ run အောင်
  }

  async start() {
    await this.reload();
    setInterval(() => this.reload().catch(console.error), 60000);
    setInterval(() => this._tickSchedules().catch(console.error), 60000);
    console.log(`⚙️  Rules Engine စတင်ပြီ — rule ${this.rules.length} ခု`);
  }

  async reload() {
    const { rows } = await this.pool.query(
      `SELECT * FROM gh_rules WHERE enabled=true`
    );
    this.rules = rows;
  }

  // ---------- MQTT connector ကနေခေါ်တဲ့ entry point ----------
  async onStateChange(deviceId, values) {
    for (const rule of this.rules) {
      const t = rule.definition.trigger || {};
      try {
        if (t.type === "event" && values.__event) {
          if (t.device === deviceId && values.__event.type === t.event) {
            await this._fire(rule, { event: values.__event });
          }
        } else if (
          // Sensor-condition triggers: both the typed ("state") and the
          // untyped legacy shape must match — the docs and migrations use
          // "state" while early rules omitted type entirely.
          (!t.type || t.type === "state") &&
          t.device === deviceId &&
          t.trait in values
        ) {
          const v = values[t.trait];
          if (OPS[t.condition] && OPS[t.condition](v, t.value)) {
            await this._fire(rule, { trait: t.trait, value: v });
          }
        }
      } catch (e) {
        console.error(`[rules] ${rule.id}: ${e.message}`);
      }
    }
  }

  // ---------- Schedule rules: မိနစ်တိုင်းစစ် ----------
  async _tickSchedules() {
    const now = new Date();
    const hhmm =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0");
    for (const rule of this.rules) {
      const t = rule.definition.trigger || {};
      if (t.type === "schedule" && t.time === hhmm) {
        await this._fire(rule, { schedule: hhmm }).catch((e) =>
          console.error(`[rules] ${rule.id}: ${e.message}`)
        );
      }
    }
  }

  // ---------- Fire: cooldown + conditions + actions ----------
  async _fire(rule, context) {
    if (this._running.has(rule.id)) return;

    // Cooldown စစ်
    const cd = rule.definition.cooldown_seconds || 0;
    if (cd && rule.last_fired) {
      const since = (Date.now() - new Date(rule.last_fired).getTime()) / 1000;
      if (since < cd) return;
    }

    // Conditions စစ်
    for (const c of rule.definition.conditions || []) {
      if (c.type === "time_between" && !this._timeBetween(c.from, c.to)) return;
    }

    this._running.add(rule.id);
    rule.last_fired = new Date();
    await this.pool.query(`UPDATE gh_rules SET last_fired=now() WHERE id=$1`, [
      rule.id,
    ]);
    console.log(`🔥 [rules] "${rule.name}" fired`, context);

    try {
      for (const action of rule.definition.actions || []) {
        if (action.type === "delay") {
          await new Promise((r) => setTimeout(r, action.seconds * 1000));
        } else if (action.type === "notify") {
          await this.notifier.send(rule.site_id, action.message, context);
        } else if (action.device && action.command) {
          await this.registry.executeInternal(
            action.device,
            action.command,
            action.params || {}
          );
        }
      }
    } finally {
      this._running.delete(rule.id);
    }
  }

  _timeBetween(from, to) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [fh, fm] = from.split(":").map(Number);
    const [th, tm] = to.split(":").map(Number);
    const f = fh * 60 + fm, t = th * 60 + tm;
    return f <= t ? cur >= f && cur <= t : cur >= f || cur <= t; // ညကျော်လည်းရ
  }
}

module.exports = { RulesEngine };
