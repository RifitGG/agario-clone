const C = require('./config');

module.exports = {
    randomColor: () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
    randomPos: (size) => Math.floor(Math.random() * size),
    
    // Получить радиус из массы (с множителем для лучшей видимости)
    getRadius: (mass) => Math.sqrt(mass) * C.RADIUS_MULTIPLIER,
    
    // Расстояние между точками
    dist: (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2),
    
    // Нормализация вектора
    normalize: (x, y) => {
        const len = Math.hypot(x, y) || 1;
        return { x: x / len, y: y / len };
    }
};
