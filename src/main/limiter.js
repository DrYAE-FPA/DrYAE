// Limiteur de débit (seau à jetons). rate en octets/s, 0 = illimité.
class Limiter {
  constructor(rate = 0) { this.rate = rate; this.tokens = 0; this.last = Date.now(); }
  setRate(rate) { this.rate = Math.max(0, rate || 0); this.tokens = 0; this.last = Date.now(); }
  take(n) {
    if (!this.rate) return null;
    const now = Date.now();
    this.tokens = Math.min(this.rate / 4, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    this.tokens -= n;
    if (this.tokens >= 0) return null;
    return new Promise(r => setTimeout(r, Math.min(2000, (-this.tokens / this.rate) * 1000)));
  }
}
module.exports = { Limiter };
