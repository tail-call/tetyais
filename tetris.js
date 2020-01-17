const canvas = document.body.querySelector('canvas');
const context = canvas.getContext('2d');

const SHAPE_DIMENSION = 4;

const TILE_WIDTH = 20;
const TILE_HEIGHT = 20;

const LEVEL_WIDTH = 8;
const LEVEL_HEIGHT = 18;

const Shape = {
    defaultShapes: {
        T: [
            0, 0, 0, 0,
            1, 2, 1, 0,
            0, 1, 0, 0,
            0, 0, 0, 0,
        ],
        S: [
            0, 0, 0, 0,
            0, 2, 1, 0,
            1, 1, 0, 0,
            0, 0, 0, 0,
        ],
        Z: [
            0, 0, 0, 0,
            1, 2, 0, 0,
            0, 1, 1, 0,
            0, 0, 0, 0,
        ],
        O: [
            0, 0, 0, 0,
            0, 2, 1, 0,
            0, 1, 1, 0,
            0, 0, 0, 0,
        ],
        L: [
            0, 1, 0, 0,
            0, 2, 0, 0,
            0, 1, 1, 0,
            0, 0, 0, 0,
        ],
        R: [
            0, 1, 0, 0,
            0, 2, 0, 0,
            1, 1, 0, 0,
            0, 0, 0, 0,
        ],
    },

    pick() {
        const shapes = Object.values(this.defaultShapes);
        const index = Math.floor(Math.random() * shapes.length);
        return shapes[index];
    },

    indexToCoords(i) {
        const x = i % SHAPE_DIMENSION;
        const y = (i - x) / SHAPE_DIMENSION;
        return { x, y };
    },

    coordsToIndex(x, y) {
        return y * SHAPE_DIMENSION + x;
    },

    hotSpot(shape) {
        const i = shape.findIndex(x => x > 1);
        if (i < 0) return { x: 1, y: 1 };

        return this.indexToCoords(i);
    },

    rotate(shape) {
        return shape.map((_, i) => {
            const { x, y } = this.indexToCoords(i);

            return shape[this.coordsToIndex(y, SHAPE_DIMENSION - x - 1)];
        });
    },

    forEachBlock(shape, cb) {
        shape.forEach((cell, i) => {
            const coords = this.indexToCoords(i);
            const hotSpot = this.hotSpot(shape);
            if (!cell) return;
            cb({
                x: coords.x - hotSpot.x,
                y: coords.y - hotSpot.y,
            }, cell);
        });
    },
};

const level = {
    width: LEVEL_WIDTH,
    height: LEVEL_HEIGHT,
    blocks: {},

    getBlockAt(x, y) {
        return this.blocks[`${x}:${y}`];
    },

    setBlockAt(x, y, block) {
        this.blocks[`${x}:${y}`] = block;
    },

    draw() {
        for (y = 0; y < this.height; y++) {
            for (x = 0; x < this.width; x++) {
                context.strokeRect(x * TILE_WIDTH, y * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
                if (this.getBlockAt(x, y)) {
                    context.fillRect(x * TILE_WIDTH, y * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
                }
            }
        }
    }
}


const figure = {
    x: SHAPE_DIMENSION,
    y: -1,
    shape: Shape.defaultShapes.T,

    reset() {
        this.x = SHAPE_DIMENSION;
        this.y = -1;
        this.shape = Shape.pick();
    },

    draw() {
        context.save();
        context.translate(this.x * TILE_WIDTH, this.y * TILE_HEIGHT);
        for (let i = 0; i < this.shape.length; i++) {
            const { x, y } = Shape.indexToCoords(i);
            const { x: hx, y: hy } = Shape.hotSpot(this.shape);

            if (!this.shape[i]) continue;

            context.fillRect((x - hx) * TILE_WIDTH, (y - hy) * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
        }
        context.restore();
    },

    isColliding(collider) {
        let result = null;
        Shape.forEachBlock(this.shape, ({ x, y }, block) => {
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
        this.shape = Shape.rotate(this.shape);
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
    lastTimestamp: 0,
    tickTimer: 0,
    tickDuration: 150,
    levelHeight: LEVEL_HEIGHT,
    levelWidth: LEVEL_WIDTH,
    collider: null,

    onTick() {
        const fallResult = figure.fall(this.collider);
        if (fallResult === 'hitFloor') {
            Shape.forEachBlock(figure.shape, ({ x: blockX, y: blockY }, block) => {
                const x = blockX + figure.x;
                const y = blockY + figure.y;
                level.setBlockAt(x, y, block || level.getBlockAt(x, y));
            });
            figure.reset();
        }
    },

    hasBlock(x, y) {
        return y >= this.levelHeight || level.getBlockAt(x, y);
    },

    draw() {
        context.save();
        context.translate(10 + 0.5, 10 + 0.5);
        level.draw();
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
            this.startAccelerate();
            return;
        case 'ArrowDown_up':
            this.stopAccelerate();
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
