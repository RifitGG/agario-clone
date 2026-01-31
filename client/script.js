const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const socket = io();

const BUFF_ICONS = {
    speed: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    mass: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
    vampire: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2v-2zm0-10h2v6h-2V6z"/></svg>`,
    invincibility: `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`
};

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.onresize = resize;

let meId = null;
let mapSize = 3000;
let selectedColor = 'random';
let savedUsername = 'Blob';
let savedColor = 'random';
let nextBuffSpawn = 60;


let gameState = {
    players: [],
    food: [],
    massOrbs: [],
    ejectedMass: [],
    vampireProjectiles: [],
    buffs: []
};

let prevState = null;
let currentState = null;
let lastUpdateTime = 0;
const INTERPOLATION_TIME = 50;

// Камера
let camX = 0, camY = 0, scale = 1;
let targetCamX = 0, targetCamY = 0, targetScale = 1;

const mouse = { x: 0, y: 0 };

let animTime = 0;


document.querySelectorAll('.color-option').forEach(el => {
    el.onclick = () => {
        document.querySelectorAll('.color-option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedColor = el.dataset.color;
    };
});


document.getElementById('play').onclick = () => {
    const name = document.getElementById('name').value.trim() || 'Blob';
    savedUsername = name;
    savedColor = selectedColor;
    socket.emit('join', { name, color: savedColor === 'random' ? null : savedColor });
    document.getElementById('login').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('buff-timer').style.display = 'flex';
};


document.getElementById('respawn-btn').onclick = () => {
    socket.emit('respawn', { 
        name: savedUsername, 
        color: savedColor === 'random' ? null : savedColor 
    });
    document.getElementById('death-screen').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('buff-timer').style.display = 'flex';
};


document.getElementById('name').onkeydown = (e) => {
    if (e.key === 'Enter') {
        document.getElementById('play').click();
    }
};

window.onmousemove = e => {
    mouse.x = e.clientX - canvas.width / 2;
    mouse.y = e.clientY - canvas.height / 2;
};

window.onkeydown = e => {
    if (e.code === 'Space') {
        e.preventDefault();
        socket.emit('space');
    }
    if (e.code === 'KeyW') {
        socket.emit('eject');
    }
};

socket.on('init', data => {
    mapSize = data.mapSize;
    meId = data.playerId;
});

socket.on('state', state => {
    prevState = currentState;
    currentState = state;
    lastUpdateTime = performance.now();
    nextBuffSpawn = state.nextBuffSpawn || 60;
    
    const me = state.players.find(p => p.id === meId);
    if (me) {
        let totalMass = me.cells.reduce((acc, c) => acc + c.mass, 0);
        document.getElementById('score').innerText = Math.floor(totalMass);
        
        const buffsPanel = document.getElementById('buffs-panel');
        buffsPanel.innerHTML = '';
        
        if (me.buffs) {
            if (me.buffs.speed && me.buffs.speedTimeLeft > 0) {
                buffsPanel.innerHTML += createBuffHTML('speed', me.buffs.speedTimeLeft);
            }
            if (me.buffs.mass && me.buffs.massTimeLeft > 0) {
                buffsPanel.innerHTML += createBuffHTML('mass', me.buffs.massTimeLeft);
            }
            if (me.buffs.vampire && me.buffs.vampireTimeLeft > 0) {
                buffsPanel.innerHTML += createBuffHTML('vampire', me.buffs.vampireTimeLeft);
            }
            if (me.buffs.invincibility && me.buffs.invincibilityTimeLeft > 0) {
                buffsPanel.innerHTML += createBuffHTML('invincibility', me.buffs.invincibilityTimeLeft);
            }
        }
        
        updateSpaceHint(me.cellCount, me.merging);
    }
    
    // Обновление таймера баффов
    if (state.nextBuffSpawn !== undefined) {
        document.getElementById('buff-timer-value').textContent = state.nextBuffSpawn;
    }
});

function createBuffHTML(type, timeLeft) {
    const names = {
        speed: 'Скорость',
        mass: 'x2 Масса',
        vampire: 'Вампир',
        invincibility: 'Неуязвимость'
    };
    return `
        <div class="buff-indicator buff-${type}">
            <span>${BUFF_ICONS[type]} ${names[type]}</span>
            <span class="buff-time">${timeLeft}с</span>
        </div>
    `;
}

function updateSpaceHint(cellCount, merging) {
    let hint = document.getElementById('space-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'space-hint';
        hint.style.cssText = 'position:fixed;top:70px;left:20px;background:rgba(0,0,0,0.7);padding:10px 15px;border-radius:8px;color:#aaa;font-size:14px;z-index:10;';
        document.body.appendChild(hint);
    }
    
    if (cellCount === 1) {
        hint.innerHTML = '<kbd style="background:#333;padding:2px 8px;border-radius:4px;color:#fff;">Пробел</kbd> - Разделиться';
    } else if (merging) {
        hint.innerHTML = '<kbd style="background:#333;padding:2px 8px;border-radius:4px;color:#fff;">Пробел</kbd> - <span style="color:#00ff64;">Соединение...</span>';
    } else {
        hint.innerHTML = '<kbd style="background:#333;padding:2px 8px;border-radius:4px;color:#fff;">Пробел</kbd> - Соединиться';
    }
}

socket.on('leaderboard', leaders => {
    const list = document.getElementById('leaders');
    list.innerHTML = '';
    
    leaders.forEach((leader, index) => {
        const li = document.createElement('li');
        if (leader.id === meId) {
            li.className = 'me';
        }
        li.innerHTML = `
            <span class="leader-name">${index + 1}. ${escapeHtml(leader.username)}</span>
            <div class="leader-stats">
                <span>☠ ${leader.kills || 0}</span>
                <span>⚖ ${Math.floor(leader.mass)}</span>
            </div>
        `;
        list.appendChild(li);
    });
});

socket.on('death', data => {
    document.getElementById('ui').style.display = 'none';
    document.getElementById('death-screen').style.display = 'flex';
    document.getElementById('buff-timer').style.display = 'none';
    
    document.getElementById('death-name').textContent = data.username || savedUsername;
    document.getElementById('death-kills').textContent = data.kills || 0;
    
    meId = null;
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

setInterval(() => {
    if (!meId) return;
    socket.emit('input', { type: 'move', x: mouse.x, y: mouse.y });
}, 33);

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getInterpolatedState() {
    if (!currentState) return null;
    if (!prevState) return currentState;
    
    const now = performance.now();
    const elapsed = now - lastUpdateTime;
    const t = Math.min(1, elapsed / INTERPOLATION_TIME);
    
    const interpolated = {
        players: [],
        food: currentState.food,
        massOrbs: currentState.massOrbs || [],
        ejectedMass: currentState.ejectedMass,
        vampireProjectiles: currentState.vampireProjectiles || [],
        buffs: currentState.buffs,
        nextBuffSpawn: currentState.nextBuffSpawn,
        timestamp: currentState.timestamp
    };
    
    currentState.players.forEach(player => {
        const prevPlayer = prevState.players.find(p => p.id === player.id);
        
        if (prevPlayer) {
            const interpolatedCells = player.cells.map(cell => {
                const prevCell = prevPlayer.cells.find(c => c.id === cell.id);
                if (prevCell) {
                    return {
                        ...cell,
                        x: lerp(prevCell.x, cell.x, t),
                        y: lerp(prevCell.y, cell.y, t),
                        radius: lerp(prevCell.radius, cell.radius, t)
                    };
                }
                return cell;
            });
            
            interpolated.players.push({
                ...player,
                cells: interpolatedCells
            });
        } else {
            interpolated.players.push(player);
        }
    });
    
    return interpolated;
}

function draw() {
    const now = performance.now();
    animTime = now / 1000;
    
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!meId || !currentState) {
        requestAnimationFrame(draw);
        return;
    }

    const state = getInterpolatedState();
    if (!state) {
        requestAnimationFrame(draw);
        return;
    }

    const me = state.players.find(p => p.id === meId);
    
    if (me && me.cells.length > 0) {
        let totalX = 0, totalY = 0, count = 0;
        let maxRad = 0;
        
        me.cells.forEach(c => {
            totalX += c.x;
            totalY += c.y;
            count++;
            if (c.radius > maxRad) maxRad = c.radius;
        });
        
        if (count > 0) {
            targetCamX = totalX / count;
            targetCamY = totalY / count;
            
            camX = lerp(camX, targetCamX, 0.08);
            camY = lerp(camY, targetCamY, 0.08);
            
            targetScale = Math.max(0.15, Math.min(1.2, 100 / maxRad));
            scale = lerp(scale, targetScale, 0.04);
        }
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    drawGrid();

    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, mapSize, mapSize);

    state.food.forEach(f => {
        ctx.beginPath();
        ctx.fillStyle = f.color;
        ctx.arc(f.x, f.y, f.radius || 8, 0, Math.PI * 2);
        ctx.fill();
    });

    if (state.massOrbs) {
        state.massOrbs.forEach(m => drawMassOrb(m));
    }

    state.buffs.forEach(b => drawBuff(b));

    state.ejectedMass.forEach(m => {
        ctx.beginPath();
        ctx.fillStyle = m.color;
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Снаряды вампира
    if (state.vampireProjectiles) {
        state.vampireProjectiles.forEach(p => {
            ctx.beginPath();
            ctx.fillStyle = p.color || '#ff0064';
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Хвост снаряда
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
            ctx.strokeStyle = p.color || '#ff0064';
            ctx.lineWidth = p.radius / 2;
            ctx.stroke();
        });
    }

    const allCells = [];
    state.players.forEach(p => {
        p.cells.forEach(c => {
            allCells.push({ 
                ...c, 
                color: p.color, 
                name: p.username,
                isMe: p.id === meId,
                merging: p.merging,
                hasSpeedBuff: p.buffs && p.buffs.speed,
                hasMassBuff: p.buffs && p.buffs.mass,
                hasVampireBuff: p.buffs && p.buffs.vampire,
                hasInvincibilityBuff: p.buffs && p.buffs.invincibility
            });
        });
    });
    
    allCells.sort((a, b) => a.radius - b.radius);

    allCells.forEach(c => {
        drawCell(c);
    });

    ctx.restore();
    
    drawMinimap(state);
    
    requestAnimationFrame(draw);
}

function drawMassOrb(m) {
    ctx.save();
    
    const pulse = Math.sin(animTime * 4 + m.x * 0.01) * 0.15 + 1;
    
    const gradient = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius * 2);
    gradient.addColorStop(0, m.color);
    gradient.addColorStop(0.5, m.color + '80');
    gradient.addColorStop(1, m.color + '00');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 1.8 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.fillStyle = m.color;
    ctx.arc(m.x, m.y, m.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.arc(m.x - m.radius * 0.3, m.y - m.radius * 0.3, m.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

function drawBuff(b) {
    ctx.save();
    
    const pulse = Math.sin(animTime * 3) * 0.2 + 1;
    const rotation = animTime * 2;
    
    const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.5);
    
    const colors = {
        speed: { main: '#00ff64', light: 'rgba(0, 255, 100, 0.5)' },
        mass: { main: '#ffd700', light: 'rgba(255, 215, 0, 0.5)' },
        vampire: { main: '#ff0064', light: 'rgba(255, 0, 100, 0.5)' },
        invincibility: { main: '#ffffff', light: 'rgba(255, 255, 255, 0.5)' }
    };
    
    const c = colors[b.type] || colors.speed;
    
    gradient.addColorStop(0, c.light + '0.9)');
    gradient.addColorStop(0.4, c.light + '0.4)');
    gradient.addColorStop(1, c.light + '0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.fillStyle = c.main;
    ctx.strokeStyle = c.main;
    ctx.arc(b.x, b.y, b.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
    
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(rotation);
    
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const px = Math.cos(angle) * b.radius * 1.8;
        const py = Math.sin(angle) * b.radius * 1.8;
        
        ctx.beginPath();
        ctx.fillStyle = c.main;
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    
    // Иконка
    ctx.fillStyle = '#000';
    ctx.font = `bold ${b.radius * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const icons = { speed: '❯❯❯❯', mass: '+', vampire: '⛧', invincibility: '⛨' };
    ctx.fillText(icons[b.type] || '?', b.x, b.y);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    
    const names = { speed: 'SPEED', mass: 'x2 MASS', vampire: 'VAMPIRE', invincibility: 'INVINCIBLE' };
    ctx.fillText(names[b.type] || '', b.x, b.y + b.radius + 25);
    
    const times = { speed: '5 сек', mass: '10 сек', vampire: '5 сек', invincibility: '5 сек' };
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText(times[b.type] || '', b.x, b.y + b.radius + 42);
    
    ctx.restore();
}

function drawCell(c) {
    ctx.save();
    
    // Эффект неуязвимости 
    if (c.hasInvincibilityBuff) {
        const hue = (animTime * 180) % 360;
        const gradient = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius * 1.5);
        gradient.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 100%, 50%, 0.4)`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Мерцающая обводка
        ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.lineWidth = 4 + Math.sin(animTime * 10) * 2;
    }
    // Эффект слияния
    else if (c.merging && c.isMe) {
        const glowSize = c.radius * 1.4;
        const gradient = ctx.createRadialGradient(c.x, c.y, c.radius * 0.7, c.x, c.y, glowSize);
        gradient.addColorStop(0, 'rgba(0, 255, 100, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(c.x, c.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#00ff64';
        ctx.lineWidth = 6;
    }
    // Эффект вампира
    else if (c.hasVampireBuff) {
        const glowSize = c.radius * 1.3;
        const gradient = ctx.createRadialGradient(c.x, c.y, c.radius * 0.8, c.x, c.y, glowSize);
        gradient.addColorStop(0, 'rgba(255, 0, 100, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 0, 100, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(c.x, c.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff0064';
        ctx.lineWidth = 4;
    }
    // Другие баффы
    else if (c.hasSpeedBuff || c.hasMassBuff) {
        const glowSize = c.radius * 1.3;
        const gradient = ctx.createRadialGradient(c.x, c.y, c.radius * 0.8, c.x, c.y, glowSize);
        
        if (c.hasSpeedBuff && c.hasMassBuff) {
            gradient.addColorStop(0, 'rgba(128, 255, 128, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        } else if (c.hasSpeedBuff) {
            gradient.addColorStop(0, 'rgba(0, 255, 100, 0.5)');
            gradient.addColorStop(1, 'rgba(0, 255, 100, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(c.x, c.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.hasSpeedBuff ? '#00ff64' : '#ffd700';
        ctx.lineWidth = 4;
    }
    // Обычная обводка
    else {
        ctx.strokeStyle = c.isMe ? '#fff' : 'rgba(0,0,0,0.4)';
        ctx.lineWidth = c.isMe ? 5 : 3;
    }
    
    // Основной круг
    ctx.beginPath();
    ctx.fillStyle = c.color;
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
    
    if (c.radius > 20) {
        const fontSize = Math.max(14, Math.min(c.radius * 0.35, 50));
        const massSize = Math.max(11, fontSize * 0.65);
        
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.name, c.x, c.y - massSize * 0.4);
        
        ctx.font = `${massSize}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(Math.floor(c.mass), c.x, c.y + fontSize * 0.35);
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
}

function drawGrid() {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    const gridSize = 100;
    
    ctx.beginPath();
    for (let x = 0; x <= mapSize; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapSize);
    }
    for (let y = 0; y <= mapSize; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapSize, y);
    }
    ctx.stroke();
}

function drawMinimap(state) {
    const size = Math.min(200, canvas.width * 0.2);
    const padding = 10;
    const x = canvas.width - size - padding;
    const y = canvas.height - size - padding;
    
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
    
    const scaleM = size / mapSize;
    
    ctx.fillStyle = 'rgba(100,100,100,0.4)';
    state.food.forEach(f => {
        ctx.fillRect(x + f.x * scaleM - 1, y + f.y * scaleM - 1, 2, 2);
    });
    
    if (state.massOrbs) {
        state.massOrbs.forEach(m => {
            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.arc(x + m.x * scaleM, y + m.y * scaleM, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    state.buffs.forEach(b => {
        const colors = { speed: '#00ff64', mass: '#ffd700', vampire: '#ff0064', invincibility: '#fff' };
        ctx.fillStyle = colors[b.type] || '#fff';
        ctx.beginPath();
        ctx.arc(x + b.x * scaleM, y + b.y * scaleM, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    state.players.forEach(p => {
        ctx.fillStyle = p.id === meId ? '#e74c3c' : p.color;
        p.cells.forEach(c => {
            const r = Math.max(2, c.radius * scaleM * 0.5);
            ctx.beginPath();
            ctx.arc(x + c.x * scaleM, y + c.y * scaleM, r, 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

draw();
