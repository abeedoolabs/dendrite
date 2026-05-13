export class DendriteNode {
  constructor(x, y, color, parent, label) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.parent = parent;
    this.children = [];
    this.label = label || '';
    this.isRight = true;
    this.isRoot = parent === null;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.children.forEach(c => c.move(dx, dy));
  }

  flipDirection(colors) {
    this.isRight = !this.isRight;
    this.color = this.isRight ? colors.primary : colors.secondary;
    this.children.forEach(c => c.flipDirection(colors));
  }

  setDirection(isRight, colors) {
    if (this.isRight !== isRight) {
      // Mirror x position around parent
      if (this.parent) {
        const dx = this.x - this.parent.x;
        this.x = this.parent.x - dx;
        // Move children by the same delta
        const shift = -2 * dx;
        this.children.forEach(c => c._shiftX(shift));
      }
      this.isRight = isRight;
      this.color = isRight ? colors.primary : colors.secondary;
    }
    this.children.forEach(c => c.setDirection(isRight, colors));
  }

  _shiftX(dx) {
    this.x += dx;
    this.children.forEach(c => c._shiftX(dx));
  }
}
