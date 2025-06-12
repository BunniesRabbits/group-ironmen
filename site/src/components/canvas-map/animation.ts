/**
 * Refactor renaming:
 * 	delete progress
 *
 * 	current -> current()
 *  start -> startPosition
 *  target -> endPosition
 *  time -> endTime
 *  ?? -> elapsedTime (new parameter)
 */

export default class Animation {
  // Interpolated Value
  private startPosition: number;
  private endPosition: number;

  // Time, startTime is implicitly 0
  private endTime: number;
  private elapsedTime: number;

  constructor({
    startPosition,
    endPosition,
    endTime,
  }: {
    startPosition: number;
    endPosition: number;
    endTime: number;
  }) {
    this.startPosition = startPosition;
    this.endPosition = endPosition;
    this.endTime = endTime;
    this.elapsedTime = 0;
  }

  // Values 0 to 1 return the animation at that time.
  // Out of bounds values will be clamped to [0,1].
  at(fraction: number): number {
    const t = Math.max(Math.min(fraction, 1), 0);
    return (1.0 - t) * this.startPosition + t * this.endPosition;
  }

  // Get the position the animation is currently at.
  // The value is clamped to the interval, so for a valid animation no out of bounds value can be returned.
  current(): number {
    return this.at(this.elapsedTime / this.endTime);
  }
  end(): number {
    return this.endPosition;
  }

  // Start a new animation, with a new target.
  // The current end position is used as the new start,
  // so this can be used to chain animations.
  goTo({ endPosition, endTime }: { endPosition: number; endTime: number }): Animation {
    this.startPosition = this.endPosition;
    this.endPosition = endPosition;
    this.endTime = endTime;
    this.elapsedTime = 0;

    return this;
  }

  // Tick the animation, by some delta interval.
  // Returns whether or not the animation is ongoing, e.g. FALSE means this function is idempotent.
  animate(elapsed: number): boolean {
    if (this.elapsedTime >= this.endTime) {
      return false;
    }

    this.elapsedTime += elapsed;

    return true;
  }

  // Finish the animation, and snap to the endPosition.
  // animate will become idempotent e.g. return false.
  // Returns self for chaining
  cancelAnimation(): Animation {
    this.elapsedTime = 1.0;
    this.endTime = 1.0;

    return this;
  }
}
