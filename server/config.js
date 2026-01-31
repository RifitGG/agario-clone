module.exports = {
    MAP_SIZE: 9000, // Увеличена в 3 раза
    
    // Обычная еда
    FOOD_COUNT: 500, 
    FOOD_VALUE: 3,
    FOOD_RADIUS: 8,
    
    // Большие шарики массы
    MASS_ORB_SPAWN_INTERVAL: 12000,
    MASS_ORB_SPAWN_MIN: 8,
    MASS_ORB_SPAWN_MAX: 15,
    MASS_ORB_VALUE: 15,
    MASS_ORB_RADIUS: 18,
    MAX_MASS_ORBS: 100,
    
    // Игрок
    START_MASS: 50,
    MIN_SPLIT_MASS: 100,
    MAX_CELLS: 16,
    MIN_EJECT_MASS: 40,
    EJECT_MASS_LOSS: 16,
    EJECT_MASS_VALUE: 12,
    
    // Слияние
    MERGE_SPEED: 3,
    MERGE_DISTANCE: 0.5,
    
    // Физика
    SPLIT_FORCE: 25,
    EJECT_FORCE: 30,
    FRICTION: 0.92,
    BASE_SPEED: 5,
    
    // Радиус
    RADIUS_MULTIPLIER: 4,
    
    // Баффы
    BUFF_SPAWN_INTERVAL: 60000, // 1 минута
    BUFFS_PER_TYPE: 2, // По 2 каждого типа
    BUFF_RADIUS: 25,
    
    // Длительность баффов (мс)
    SPEED_BUFF_DURATION: 5000,      // 5 сек
    MASS_BUFF_DURATION: 10000,      // 10 сек
    VAMPIRE_BUFF_DURATION: 5000,   // 60 сек
    INVINCIBILITY_DURATION: 5000,   // 5 сек
    
    // Множители баффов
    SPEED_BUFF_MULTIPLIER: 1.6,
    MASS_BUFF_MULTIPLIER: 2,
    VAMPIRE_DAMAGE: 3, // Урон и получаемая масса
    
    // Снаряды вампира
    VAMPIRE_PROJECTILE_SPEED: 15,
    VAMPIRE_PROJECTILE_RADIUS: 10,
    VAMPIRE_PROJECTILE_LIFETIME: 3000, // 3 сек
    
    // Сеть
    TICK_RATE: 60,
    BROADCAST_RATE: 30
};
