const C = require('./config');
const U = require('./utils');

class Player {
    constructor(id, username, color) {
        this.id = id;
        this.username = username;
        this.color = color || U.randomColor();
        this.target = { x: 0, y: 0 };
        this.kills = 0; // Счётчик убийств
        this.score = 0; // Счётчик очков
        
        // Баффы
        this.buffs = {
            speed: { active: false, endTime: 0 },
            mass: { active: false, endTime: 0 },
            vampire: { active: false, endTime: 0 },
            invincibility: { active: false, endTime: 0 }
        };
        
        // Режим слияния
        this.merging = false;
        
        // Игрок состоит из клеток
        const startX = U.randomPos(C.MAP_SIZE);
        const startY = U.randomPos(C.MAP_SIZE);
        
        this.cells = [{
            id: this.generateCellId(),
            x: startX,
            y: startY,
            mass: C.START_MASS,
            radius: U.getRadius(C.START_MASS),
            vx: 0,
            vy: 0
        }];
    }

    generateCellId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // Проверка и обновление баффов
    updateBuffs() {
        const now = Date.now();
        const buffTypes = ['speed', 'mass', 'vampire', 'invincibility'];
        
        buffTypes.forEach(type => {
            if (this.buffs[type].active && now > this.buffs[type].endTime) {
                this.buffs[type].active = false;
            }
        });
    }

    // Применить бафф
    applyBuff(type) {
        const now = Date.now();
        const durations = {
            speed: C.SPEED_BUFF_DURATION,
            mass: C.MASS_BUFF_DURATION,
            vampire: C.VAMPIRE_BUFF_DURATION,
            invincibility: C.INVINCIBILITY_DURATION
        };
        
        if (durations[type]) {
            this.buffs[type].active = true;
            this.buffs[type].endTime = now + durations[type];
        }
    }

    // Проверка неуязвимости
    isInvincible() {
        return this.buffs.invincibility.active;
    }

    // Проверка вампира
    isVampire() {
        return this.buffs.vampire.active;
    }

    // Получить множитель скорости
    getSpeedMultiplier() {
        return this.buffs.speed.active ? C.SPEED_BUFF_MULTIPLIER : 1;
    }

    // Получить множитель массы
    getMassMultiplier() {
        return this.buffs.mass.active ? C.MASS_BUFF_MULTIPLIER : 1;
    }

    // Обработка пробела - сплит или слияние
    handleSpace() {
        if (this.cells.length === 1) {
            this.split();
        } else {
            this.merging = true;
        }
    }

    // Логика разделения
    split() {
        if (this.cells.length >= C.MAX_CELLS) return;
        if (this.cells[0].mass < C.MIN_SPLIT_MASS) return;

        this.merging = false;

        const cell = this.cells[0];
        const splitMass = cell.mass / 2;
        cell.mass = splitMass;
        cell.radius = U.getRadius(splitMass);

        const velocityX = this.target.x * C.SPLIT_FORCE;
        const velocityY = this.target.y * C.SPLIT_FORCE;

        this.cells.push({
            id: this.generateCellId(),
            x: cell.x + this.target.x * cell.radius,
            y: cell.y + this.target.y * cell.radius,
            mass: splitMass,
            radius: U.getRadius(splitMass),
            vx: velocityX,
            vy: velocityY
        });
    }

    // Выброс массы или снаряд вампира
    eject() {
        const ejectedMass = [];
        const vampireProjectiles = [];
        
        this.cells.forEach(cell => {
            if (cell.mass >= C.MIN_EJECT_MASS) {
                if (this.isVampire()) {
                    // Снаряд вампира - не теряем массу
                    vampireProjectiles.push({
                        id: this.generateCellId(),
                        x: cell.x + this.target.x * cell.radius,
                        y: cell.y + this.target.y * cell.radius,
                        vx: this.target.x * C.VAMPIRE_PROJECTILE_SPEED,
                        vy: this.target.y * C.VAMPIRE_PROJECTILE_SPEED,
                        radius: C.VAMPIRE_PROJECTILE_RADIUS,
                        ownerId: this.id,
                        ownerColor: this.color,
                        createdAt: Date.now()
                    });
                } else {
                    // Обычный выброс массы
                    cell.mass -= C.EJECT_MASS_LOSS;
                    cell.radius = U.getRadius(cell.mass);

                    ejectedMass.push({
                        id: this.generateCellId(),
                        x: cell.x + this.target.x * cell.radius,
                        y: cell.y + this.target.y * cell.radius,
                        mass: C.EJECT_MASS_VALUE,
                        radius: U.getRadius(C.EJECT_MASS_VALUE),
                        vx: this.target.x * C.EJECT_FORCE,
                        vy: this.target.y * C.EJECT_FORCE,
                        color: this.color,
                        ownerId: this.id,
                        createdAt: Date.now()
                    });
                }
            }
        });

        return { ejectedMass, vampireProjectiles };
    }

    // Добавить массу (от вампирского урона)
    addMass(amount) {
        if (this.cells.length > 0) {
            this.cells[0].mass += amount;
            this.cells[0].radius = U.getRadius(this.cells[0].mass);
        }
    }

    // Получить урон (от вампирского снаряда)
    takeDamage(amount) {
        if (this.isInvincible()) return false;
        
        // Распределяем урон по клеткам
        const damagePerCell = amount / this.cells.length;
        
        for (let i = this.cells.length - 1; i >= 0; i--) {
            this.cells[i].mass -= damagePerCell;
            if (this.cells[i].mass <= 10) {
                this.cells.splice(i, 1);
            } else {
                this.cells[i].radius = U.getRadius(this.cells[i].mass);
            }
        }
        
        return true;
    }

    // Добавить убийство
    addKill() {
        this.kills++;
        this.score += 100; // Начисляем очки за убийство
    }

    update() {
        this.updateBuffs();
        const speedMultiplier = this.getSpeedMultiplier();
        
        this.cells.forEach(cell => {
            const speed = C.BASE_SPEED * Math.pow(cell.mass, -0.12) * speedMultiplier;
            
            cell.x += this.target.x * speed;
            cell.y += this.target.y * speed;

            cell.x += cell.vx;
            cell.y += cell.vy;

            cell.vx *= C.FRICTION;
            cell.vy *= C.FRICTION;
            
            if (Math.abs(cell.vx) < 0.05) cell.vx = 0;
            if (Math.abs(cell.vy) < 0.05) cell.vy = 0;

            cell.x = Math.max(cell.radius, Math.min(C.MAP_SIZE - cell.radius, cell.x));
            cell.y = Math.max(cell.radius, Math.min(C.MAP_SIZE - cell.radius, cell.y));
        });
        
        if (this.cells.length > 1) {
            if (this.merging) {
                this.handleMerging();
            } else {
                this.handleCellPhysics();
            }
        }
    }

    handleMerging() {
        let totalMass = 0;
        let centerX = 0;
        let centerY = 0;

        this.cells.forEach(cell => {
            totalMass += cell.mass;
            centerX += cell.x * cell.mass;
            centerY += cell.y * cell.mass;
        });

        centerX /= totalMass;
        centerY /= totalMass;

        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const dx = centerX - cell.x;
            const dy = centerY - cell.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > cell.radius * C.MERGE_DISTANCE) {
                const moveSpeed = C.MERGE_SPEED;
                if (dist > 0) {
                    cell.x += (dx / dist) * moveSpeed;
                    cell.y += (dy / dist) * moveSpeed;
                }
            }
        }

        for (let i = 0; i < this.cells.length; i++) {
            for (let j = i + 1; j < this.cells.length; j++) {
                const c1 = this.cells[i];
                const c2 = this.cells[j];
                
                if (!c1 || !c2) continue;
                
                const d = U.dist(c1.x, c1.y, c2.x, c2.y);
                const mergeThreshold = (c1.radius + c2.radius) * C.MERGE_DISTANCE;
                
                if (d < mergeThreshold) {
                    if (c1.mass >= c2.mass) {
                        c1.mass += c2.mass;
                        c1.radius = U.getRadius(c1.mass);
                        this.cells.splice(j, 1);
                        j--;
                    } else {
                        c2.mass += c1.mass;
                        c2.radius = U.getRadius(c2.mass);
                        this.cells.splice(i, 1);
                        i--;
                        break;
                    }
                }
            }
        }

        if (this.cells.length === 1) {
            this.merging = false;
        }
    }

    handleCellPhysics() {
        for (let i = 0; i < this.cells.length; i++) {
            for (let j = i + 1; j < this.cells.length; j++) {
                const c1 = this.cells[i];
                const c2 = this.cells[j];
                
                if (!c1 || !c2) continue;
                
                const d = U.dist(c1.x, c1.y, c2.x, c2.y);
                const minDist = c1.radius + c2.radius;
                
                if (d < minDist && d > 0) {
                    const overlap = minDist - d;
                    const dx = (c1.x - c2.x) / d;
                    const dy = (c1.y - c2.y) / d;
                    
                    const force = overlap * 0.2;
                    c1.x += dx * force;
                    c1.y += dy * force;
                    c2.x -= dx * force;
                    c2.y -= dy * force;
                }
            }
        }
    }

    getTotalMass() {
        return this.cells.reduce((sum, cell) => sum + cell.mass, 0);
    }

    getClientData() {
        const now = Date.now();
        const score = Math.floor(Math.pow(this.getTotalMass(), 0.5) * 10);
        return {
            id: this.id,
            username: this.username,
            color: this.color,
            score: score,
            kills: this.kills,
            cellCount: this.cells.length,
            merging: this.merging,
            buffs: {
                speed: this.buffs.speed.active,
                mass: this.buffs.mass.active,
                vampire: this.buffs.vampire.active,
                invincibility: this.buffs.invincibility.active,
                speedTimeLeft: this.buffs.speed.active ? Math.max(0, Math.ceil((this.buffs.speed.endTime - now) / 1000)) : 0,
                massTimeLeft: this.buffs.mass.active ? Math.max(0, Math.ceil((this.buffs.mass.endTime - now) / 1000)) : 0,
                vampireTimeLeft: this.buffs.vampire.active ? Math.max(0, Math.ceil((this.buffs.vampire.endTime - now) / 1000)) : 0,
                invincibilityTimeLeft: this.buffs.invincibility.active ? Math.max(0, Math.ceil((this.buffs.invincibility.endTime - now) / 1000)) : 0
            },
            cells: this.cells.map(c => ({
                id: c.id,
                x: Math.round(c.x * 10) / 10,
                y: Math.round(c.y * 10) / 10,
                radius: Math.round(c.radius * 10) / 10,
                mass: Math.round(c.mass)
            }))
        };
    }
}

module.exports = Player;
