const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const Game = require('./game');
const C = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(path.join(__dirname, '../client')));

const game = new Game();

io.on('connection', socket => {
    console.log('Player connected:', socket.id);

    socket.on('join', (data) => {
        const name = data.name || 'Blob';
        const color = data.color || null;
        game.addPlayer(socket.id, name, color);
        socket.emit('init', { mapSize: C.MAP_SIZE, playerId: socket.id });
    });

    socket.on('input', (data) => {
        game.handleInput(socket.id, data);
    });
    
    socket.on('space', () => {
        game.handleInput(socket.id, { type: 'space' });
    });
    
    socket.on('eject', () => {
        game.handleInput(socket.id, { type: 'eject' });
    });

    socket.on('disconnect', () => {
        game.removePlayer(socket.id);
        console.log('Player disconnected:', socket.id);
    });
    
    socket.on('respawn', (data) => {
        // Респаун игрока с сохранёнными данными
        const name = data.name || 'Blob';
        const color = data.color || null;
        game.addPlayer(socket.id, name, color);
        socket.emit('init', { mapSize: C.MAP_SIZE, playerId: socket.id });
    });
});

// Игровой цикл
setInterval(() => {
    game.update();
    
    const deadPlayers = game.checkDeaths();
    deadPlayers.forEach(dead => {
        // Отправляем данные для экрана смерти
        io.to(dead.id).emit('death', {
            username: dead.username,
            color: dead.color,
            kills: dead.kills,
            mass: 0
        });
    });

}, 1000 / C.TICK_RATE);

// Рассылка состояния
setInterval(() => {
    io.emit('state', game.getState());
}, 1000 / C.BROADCAST_RATE);

// Рассылка лидерборда
setInterval(() => {
    io.emit('leaderboard', game.getLeaderboard());
}, 1000);

server.listen(3000, () => console.log('Server running on http://localhost:3000 (Map size: ' + C.MAP_SIZE + ')'));
