// One Euro filter: removes keypoint jitter while still following fast moves.
// Casiez, Roussel, Vogel (CHI 2012). https://gery.casiez.net/1euro/
//
// Low speed  -> strong smoothing (no jitter while holding a balance).
// High speed -> light smoothing (little lag during a leap).

function smoothingFactor(dtSeconds, cutoffHz) {
  const r = 2 * Math.PI * cutoffHz * dtSeconds;
  return r / (r + 1);
}

export class OneEuroFilter {
  constructor({ minCutoff = 1.5, beta = 0.01, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.prevValue = null;
    this.prevDeriv = 0;
    this.prevTime = null;
  }

  /** @param value number, @param timeSeconds number (must increase) */
  filter(value, timeSeconds) {
    if (this.prevValue === null || timeSeconds <= this.prevTime) {
      this.prevValue = value;
      this.prevTime = timeSeconds;
      return value;
    }
    const dt = timeSeconds - this.prevTime;
    const deriv = (value - this.prevValue) / dt;
    const aD = smoothingFactor(dt, this.dCutoff);
    const smoothDeriv = aD * deriv + (1 - aD) * this.prevDeriv;

    const cutoff = this.minCutoff + this.beta * Math.abs(smoothDeriv);
    const a = smoothingFactor(dt, cutoff);
    const smoothValue = a * value + (1 - a) * this.prevValue;

    this.prevValue = smoothValue;
    this.prevDeriv = smoothDeriv;
    this.prevTime = timeSeconds;
    return smoothValue;
  }
}

/** Smooths x and y of every landmark with its own pair of One Euro filters. */
export class LandmarkSmoother {
  constructor(options) {
    this.options = options;
    this.filters = [];
  }

  reset() {
    this.filters = [];
  }

  /** @param landmarks array of {x, y, visibility} in pixels */
  smooth(landmarks, timeSeconds) {
    return landmarks.map((p, i) => {
      if (!this.filters[i]) {
        this.filters[i] = {
          x: new OneEuroFilter(this.options),
          y: new OneEuroFilter(this.options),
        };
      }
      return {
        x: this.filters[i].x.filter(p.x, timeSeconds),
        y: this.filters[i].y.filter(p.y, timeSeconds),
        visibility: p.visibility,
      };
    });
  }
}
