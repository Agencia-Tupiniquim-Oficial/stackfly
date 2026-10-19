'use strict';

// Cache simples em memória com TTL. Suficiente pra uso interno de baixo
// volume; se o tráfego crescer muito, trocar por Redis é o próximo passo
// natural (a interface get/set abaixo já facilita essa troca).

class TtlCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

module.exports = { TtlCache };
