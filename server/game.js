const C = require('./config');
const U = require('./utils');
const Player = require('./player');

class Game {
    constructor() {
        this.players = {};
        this.food = [];
        this.massOrbs = [];
        this.ejectedMass = [];
        this.vampireProjectiles = [];
        this.buffs = [];
        this.nextBuffSpawn = Date.now() + C.BUFF_SPAWN_INTERVAL;
        
        this.initFood();
        this.startMassOrbSpawner();
        this.startBuffSpawner();
    }

    initFood() {
        while (this.food.length < C.FOOD_COUNT) this.addFood();
    }

    addFood() {
        this.food.push({
            id: Math.random().toString(36).slice(2),
            x: U.randomPos(C.MAP_SIZE),
            y: U.randomPos(C.MAP_SIZE),
            color: U.randomColor(),
            radius: C.FOOD_RADIUS,
            value: C.FOOD_VALUE
        });
    }

    startMassOrbSpawner() {
        setTimeout(() => this.spawnMassOrbs(), 5000);
        setInterval(() => this.spawnMassOrbs(), C.MASS_ORB_SPAWN_INTERVAL);
    }

    spawnMassOrbs() {
        if (this.massOrbs.length >= C.MAX_MASS_ORBS) return;
        
        const count = C.MASS_ORB_SPAWN_MIN + Math.floor(Math.random() * (C.MASS_ORB_SPAWN_MAX - C.MASS_ORB_SPAWN_MIN + 1));
        const actualCount = Math.min(count, C.MAX_MASS_ORBS - this.massOrbs.length);
        
        for (let i = 0; i < actualCount; i++) {
            const margin = 100;
            this.massOrbs.push({
                id: Math.random().toString(36).slice(2),
                x: margin + Math.random() * (C.MAP_SIZE - margin * 2),
                y: margin + Math.random() * (C.MAP_SIZE - margin * 2),
                color: this.getMassOrbColor(),
                radius: C.MASS_ORB_RADIUS,
                value: C.MASS_ORB_VALUE
            });
        }
    }

    getMassOrbColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    startBuffSpawner() {
        // Спавним начальные баффы через 10 секунд
        setTimeout(() => this.spawnAllBuffs(), 10000);
        
        // Затем каждую минуту
        setInterval(() => {
            this.spawnAllBuffs();
            this.nextBuffSpawn = Date.now() + C.BUFF_SPAWN_INTERVAL;
        }, C.BUFF_SPAWN_INTERVAL);
    }

    spawnAllBuffs() {
        // Удаляем старые баффы
        this.buffs = [];
        
        const buffTypes = ['speed', 'mass', 'vampire', 'invincibility'];
        
        // Спавним 2 баффа каждого типа
        for (const type of buffTypes) {
            for (let i = 0; i < C.BUFFS_PER_TYPE; i++) {
                this.spawnBuff(type);
            }
        }
        
        console.log(`Spawned ${this.buffs.length} buffs (2 of each type)`);
    }

    spawnBuff(type) {
        const margin = 300;
        const x = margin + Math.random() * (C.MAP_SIZE - margin * 2);
        const y = margin + Math.random() * (C.MAP_SIZE - margin * 2);
        
        // Больший радиус для заметности
        const radii = {
            speed: 40,
            mass: 40,
            vampire: 40,
            invincibility: 40
        };
        
        this.buffs.push({
            id: Math.random().toString(36).slice(2),
            x: x,
            y: y,
            type: type,
            radius: radii[type] || 40,
            name: this.getBuffName(type)
        });
    }

    getBuffName(type) {
        const names = {
            speed: 'SPEED',
            mass: 'x2 MASS',
            vampire: 'VAMPIRE',
            invincibility: 'INVINCIBLE'
        };
        return names[type] || type.toUpperCase();
    }

    addPlayer(id, username, color) {
        this.players[id] = new Player(id, username, color);
    }

    removePlayer(id) { 
        delete this.players[id]; 
    }

    handleInput(id, data) {
        const p = this.players[id];
        if (!p) return;
        
        if (data.type === 'move') {
            const len = Math.hypot(data.x, data.y) || 1;
            p.target = { x: data.x / len, y: data.y / len };
        }
        
        if (data.type === 'space') {
            p.handleSpace();
        }
        
        if (data.type === 'eject') {
            const result = p.eject();
            this.ejectedMass = this.ejectedMass.concat(result.ejectedMass);
            this.vampireProjectiles = this.vampireProjectiles.concat(result.vampireProjectiles);
        }
    }

    update() {
        // 1. Движение игроков
        Object.values(this.players).forEach(p => p.update());

        // 2. Обновление выброшенной массы
        this.updateEjectedMass();
        
        // 3. Обновление снарядов вампира
        this.updateVampireProjectiles();

        // 4. Коллизии
        this.handleCollisions();
        
        // 5. Респаун еды
        this.initFood();
    }

    updateEjectedMass() {
        const now = Date.now();
        for (let i = this.ejectedMass.length - 1; i >= 0; i--) {
            const m = this.ejectedMass[i];
            m.x += m.vx;
            m.y += m.vy;
            m.vx *= C.FRICTION;
            m.vy *= C.FRICTION;
            
            if (Math.abs(m.vx) < 0.05) m.vx = 0;
            if (Math.abs(m.vy) < 0.05) m.vy = 0;
            
            m.x = Math.max(m.radius, Math.min(C.MAP_SIZE - m.radius, m.x));
            m.y = Math.max(m.radius, Math.min(C.MAP_SIZE - m.radius, m.y));
            
            if (now - m.createdAt > 30000) {
                this.ejectedMass.splice(i, 1);
            }
        }
    }

    updateVampireProjectiles() {
        const now = Date.now();
        for (let i = this.vampireProjectiles.length - 1; i >= 0; i--) {
            const p = this.vampireProjectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > C.MAP_SIZE || p.y < 0 || p.y > C.MAP_SIZE ||
                now - p.createdAt > C.VAMPIRE_PROJECTILE_LIFETIME) {
                this.vampireProjectiles.splice(i, 1);
            }
        }
    }

    handleCollisions() {
        const playerIds = Object.keys(this.players);
        const now = Date.now();
        
        playerIds.forEach(pid => {
            const p = this.players[pid];
            if (!p) return;
            
            const massMultiplier = p.getMassMultiplier();
            
            p.cells.forEach(cell => {
                // Обычная еда
                for (let i = this.food.length - 1; i >= 0; i--) {
                    const f = this.food[i];
                    if (U.dist(cell.x, cell.y, f.x, f.y) < cell.radius) {
                        cell.mass += f.value * massMultiplier;
                        cell.radius = U.getRadius(cell.mass);
                        this.food.splice(i, 1);
                    }
                }
                
                // Большие шарики массы
                for (let i = this.massOrbs.length - 1; i >= 0; i--) {
                    const m = this.massOrbs[i];
                    if (U.dist(cell.x, cell.y, m.x, m.y) < cell.radius) {
                        cell.mass += m.value * massMultiplier;
                        cell.radius = U.getRadius(cell.mass);
                        this.massOrbs.splice(i, 1);
                    }
                }
                
                // Выброшенная масса
                for (let i = this.ejectedMass.length - 1; i >= 0; i--) {
                    const m = this.ejectedMass[i];
                    const canEat = m.ownerId !== pid || (now - m.createdAt > 500);
                    if (canEat && U.dist(cell.x, cell.y, m.x, m.y) < cell.radius) {
                        cell.mass += m.mass * massMultiplier;
                        cell.radius = U.getRadius(cell.mass);
                        this.ejectedMass.splice(i, 1);
                    }
                }
                
                // Баффы - большая зона подбора для заметности
                for (let i = this.buffs.length - 1; i >= 0; i--) {
                    const b = this.buffs[i];
                    // Увеличиваем зону подбора до radius + 50
                    if (U.dist(cell.x, cell.y, b.x, b.y) < cell.radius + b.radius) {
                        p.applyBuff(b.type);
                        this.buffs.splice(i, 1);
                        console.log(`Player ${p.username} picked up ${b.type} buff`);
                    }
                }
            });
        });

        // Снаряды вампира
        for (let i = this.vampireProjectiles.length - 1; i >= 0; i--) {
            const proj = this.vampireProjectiles[i];
            
            playerIds.forEach(pid => {
                if (pid === proj.ownerId) return;
                
                const target = this.players[pid];
                if (!target) return;
                
                target.cells.forEach(cell => {
                    if (U.dist(cell.x, cell.y, proj.x, proj.y) < cell.radius) {
                        if (target.takeDamage(C.VAMPIRE_DAMAGE)) {
                            const owner = this.players[proj.ownerId];
                            if (owner) {
                                owner.addMass(C.VAMPIRE_DAMAGE);
                            }
                        }
                        this.vampireProjectiles.splice(i, 1);
                    }
                });
            });
        }

        // PvP Коллизии
        playerIds.forEach(huntId => {
            playerIds.forEach(preyId => {
                if (huntId === preyId) return;

                const hunter = this.players[huntId];
                const prey = this.players[preyId];
                
                if (!hunter || !prey) return;
                
                if (prey.isInvincible()) return;

                hunter.cells.forEach(hCell => {
                    for (let i = prey.cells.length - 1; i >= 0; i--) {
                        const pCell = prey.cells[i];
                        if (!pCell) continue;
                        
                        const dist = U.dist(hCell.x, hCell.y, pCell.x, pCell.y);
                        
                        if (dist < hCell.radius * 0.8 && hCell.mass > pCell.mass * 1.2) {
                            hCell.mass += pCell.mass;
                            hCell.radius = U.getRadius(hCell.mass);
                            prey.cells.splice(i, 1);
                            
                            if (prey.cells.length === 0) {
                                hunter.addKill();
                            }
                        }
                    }
                });
            });
        });
    }
    
    checkDeaths() {
        const dead = [];
        Object.keys(this.players).forEach(id => {
            if (this.players[id] && this.players[id].cells.length === 0) {
                dead.push({
                    id: id,
                    username: this.players[id].username,
                    color: this.players[id].color,
                    kills: this.players[id].kills
                });
                delete this.players[id];
            }
        });
        return dead;
    }

    getState() {
        return {
            players: Object.values(this.players).map(p => p.getClientData()),
            food: this.food,
            massOrbs: this.massOrbs,
            ejectedMass: this.ejectedMass.map(m => ({
                id: m.id,
                x: Math.round(m.x * 10) / 10,
                y: Math.round(m.y * 10) / 10,
                radius: Math.round(m.radius * 10) / 10,
                color: m.color
            })),
            vampireProjectiles: this.vampireProjectiles.map(p => ({
                id: p.id,
                x: Math.round(p.x),
                y: Math.round(p.y),
                radius: p.radius,
                color: p.ownerColor,
                vx: p.vx,
                vy: p.vy
            })),
            buffs: this.buffs.map(b => ({
                id: b.id,
                x: b.x,
                y: b.y,
                type: b.type,
                radius: b.radius,
                name: b.name
            })),
            nextBuffSpawn: Math.max(0, Math.ceil((this.nextBuffSpawn - Date.now()) / 1000)),
            timestamp: Date.now()
        };
    }

    getLeaderboard() {
        return Object.values(this.players)
            .map(p => ({
                id: p.id,
                username: p.username,
                mass: p.getTotalMass(),
                kills: p.kills
            }))
            .sort((a, b) => b.mass - a.mass)
            .slice(0, 10);
    }
}

module.exports = Game;
