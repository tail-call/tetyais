const canvas = document.body.querySelector('canvas');
const context = canvas.getContext('2d');

const SHAPE_DIMENSION = 4;

const TILE_WIDTH = 20;
const TILE_HEIGHT = 20;

const LEVEL_WIDTH = 8;
const LEVEL_HEIGHT = 18;

function inRange(x, bottom, top) {
    return (x >= bottom) && (x < top);
}

class Shape {
    constructor(props = {}) {
        Object.assign(this, {
            canRotate: true,
            blocks: Array(SHAPE_DIMENSION * SHAPE_DIMENSION).fill(2),
        }, props);
    }

    static defaultShapes() {
        return {
            T: new Shape({
                blocks: [0, 0, 0, 0,
                         1, 2, 1, 0,
                         0, 1, 0, 0,
                         0, 0, 0, 0],
            }),
            S: new Shape({
                blocks: [0, 0, 0, 0,
                         0, 2, 1, 0,
                         1, 1, 0, 0,
                         0, 0, 0, 0],
            }),
            Z: new Shape({
                blocks: [0, 0, 0, 0,
                         1, 2, 0, 0,
                         0, 1, 1, 0,
                         0, 0, 0, 0],
            }),
            O: new Shape({
                blocks: [0, 0, 0, 0,
                         0, 2, 1, 0,
                         0, 1, 1, 0,
                         0, 0, 0, 0],
                canRotate: false,
            }),
            L: new Shape({
                blocks: [0, 1, 0, 0,
                         0, 2, 0, 0,
                         0, 1, 1, 0,
                         0, 0, 0, 0],
            }),
            R: new Shape({
                blocks: [0, 1, 0, 0,
                         0, 2, 0, 0,
                         1, 1, 0, 0,
                         0, 0, 0, 0],
            }),
        };
    }

    static pick() {
        const shapes = Object.values(Shape.defaultShapes());
        const index = Math.floor(Math.random() * shapes.length);
        return shapes[index];
    }

    static indexToCoords(i) {
        const x = i % SHAPE_DIMENSION;
        const y = (i - x) / SHAPE_DIMENSION;
        return { x, y };
    }

    static coordsToIndex(x, y) {
        return y * SHAPE_DIMENSION + x;
    }

    hotSpot() {
        const i = this.blocks.findIndex(x => x > 1);
        if (i < 0) return { x: 1, y: 1 };

        return Shape.indexToCoords(i);
    }

    rotate() {
        if (!this.canRotate) return this;

        return new Shape({
            blocks: this.blocks.map((_, i) => {
                const { x, y } = Shape.indexToCoords(i);
                return this.blocks[Shape.coordsToIndex(y, SHAPE_DIMENSION - x - 1)];
            }),
        });
    }

    forEachBlock(cb) {
        this.blocks.forEach((block, i) => {
            const coords = Shape.indexToCoords(i);
            const hotSpot = this.hotSpot();
            if (!block) return;

            cb({
                x: coords.x - hotSpot.x,
                y: coords.y - hotSpot.y,
            }, block);
        });
    }
};

class Level {
    constructor({ width, height }) {
        this.width = width;
        this.height = height;
        this.blocks = Array(height).fill(null).map(_ => {
            return Array(width).fill(0);
        });
    }

    getBlockAt(x, y) {
        if (inRange(x, 0, this.width) && inRange(y, 0, this.height)) {
            return this.blocks[y][x];
        }
        return 0;
    }

    setBlockAt(x, y, block) {
        if (inRange(x, 0, this.width) && inRange(y, 0, this.height)) {
            this.blocks[y][x] = block;
        }
    }

    draw() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Grid
                context.strokeRect(x * TILE_WIDTH, y * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);

                if (this.getBlockAt(x, y)) {
                    // Block
                    context.fillRect(x * TILE_WIDTH, y * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
                }
            }
        }
    }

    isLineFilled(number) {
        return this.blocks[number].every(x => x !== 0);
    }

    eraseLine(number) {
        this.blocks.splice(number, 1);
        this.blocks.unshift(Array(this.width).fill(0));
    }
}


const figure = {
    x: SHAPE_DIMENSION,
    y: -1,
    shape: Shape.pick(),

    reset() {
        this.x = SHAPE_DIMENSION;
        this.y = -1;
        this.shape = Shape.pick();
    },

    draw() {
        context.save();
        context.translate(this.x * TILE_WIDTH, this.y * TILE_HEIGHT);
        for (let i = 0; i < this.shape.blocks.length; i++) {
            const { x, y } = Shape.indexToCoords(i);
            const { x: hx, y: hy } = this.shape.hotSpot();

            if (!this.shape.blocks[i]) continue;

            context.fillRect((x - hx) * TILE_WIDTH, (y - hy) * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
        }
        context.restore();
    },

    isColliding(collider) {
        let result = null;
        this.shape.forEachBlock(({ x, y }, block) => {
            if (block && collider(this.x + x, this.y + y)) {
                result = true;
                return;
            }
        });

        return result;
    },

    goLeft(collider) {
        this.x -= 1;
        if (this.isColliding(collider)) {
            this.x += 1;
        }
    },

    goRight(collider) {
        this.x += 1;
        if (this.isColliding(collider)) {
            this.x -= 1;
        }
    },

    rotate() {
        this.shape = this.shape.rotate();
    },

    fall(collider) {
        this.y += 1;
        if (this.isColliding(collider)) {
            this.y -= 1;
            return 'hitFloor';
        }
    },
};

const game = {
    level: new Level({ width: LEVEL_WIDTH, height: LEVEL_HEIGHT }),
    lastTimestamp: 0,
    tickTimer: 0,
    tickDuration: 500,
    collider: null,

    onTick() {
        const fallResult = figure.fall(this.collider);

        if (fallResult === 'hitFloor') {
            figure.shape.forEachBlock(({ x: blockX, y: blockY }, block) => {
                const x = blockX + figure.x;
                const y = blockY + figure.y;
                this.level.setBlockAt(x, y, block || this.level.getBlockAt(x, y));
            });

            for (let i = 0; i < this.level.height; i++) {
                if (this.level.isLineFilled(i)) {
                    this.level.eraseLine(i);
                }
            }
            figure.reset();
        }
    },

    hasBlock(x, y) {
        return y >= this.level.height || this.level.getBlockAt(x, y);
    },

    draw() {
        context.save();
        context.transform(2, 0, -.2, 2, 80, 0);
        context.translate(10 + 0.5, 10 + 0.5);

        context.font = '50px serif';
        context.fillText('ТЕТЯIS', 200, 50);
        context.font = '12px serif';
        context.fillText('A soviet mind game ☭', 208, 65);
        this.level.draw();
        context.fillStyle = 'rgba(0, 0, 0, 50%)';
        figure.draw();
        context.translate(-6, -6);
        context.fillStyle = 'black';
        figure.draw();
        context.restore();
    },

    advance() {
        const now = performance.now();
        const dt = (now - this.lastTimestamp);

        this.tickTimer += dt;
        this.lastTimestamp = now;

        while (this.tickTimer > this.tickDuration) {
            this.onTick();
            this.tickTimer -= this.tickDuration;
        }
    },

    processInput(name) {
        switch (name) {
        case ' _down':
            figure.rotate(this.collider);
            return;
        case 'ArrowLeft_down':
            figure.goLeft(this.collider);
            return;
        case 'ArrowRight_down':
            figure.goRight(this.collider);
            return;
        case 'ArrowDown_down':
            this.tickDuration = 100;
            return;
        case 'ArrowDown_up':
            this.tickDuration = 500;
            return;
        }
        return true;
    },

    init() {
        this.collider = this.hasBlock.bind(this);

        window.addEventListener('keydown', event => {
            if (!this.processInput(`${event.key}_down`)) event.preventDefault();
        });

        window.addEventListener('keyup', event => {
            if (!this.processInput(`${event.key}_up`)) event.preventDefault();
        });
    },

};

function gameLoop() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    game.advance();
    game.draw();
    window.requestAnimationFrame(gameLoop);
}

game.init();
gameLoop();
