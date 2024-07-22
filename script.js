// Этот скрипт создает и добавляет скругленные фигуры и иконки к фону
document.addEventListener('DOMContentLoaded', function () {
    const colors = ['color1', 'color2', 'color3', 'color4', 'color5', 'color6', 'color7', 'color8'];
    const background = document.querySelector('.background');
    const icons = [
        'face', 'favorite', 'code', 'build', 'android', 'computer', 'memory', 'mouse',
        'star', 'info', 'cloud', 'settings', 'photo', 'music_note', 'attach_file', 'phone',
        'shopping_cart', 'language', 'check', 'warning', 'home', 'search', 'email', 'lock'
    ];

    function getRandomColorClass() {
        return colors[Math.floor(Math.random() * colors.length)];
    }

    for (let i = 0; i < 20; i++) {
        const icon = document.createElement('span');
        icon.classList.add('icon');
        icon.textContent = icons[Math.floor(Math.random() * icons.length)];
        icon.classList.add(getRandomColorClass()); // Присваиваем случайный цвет

        const posX = Math.random() * 100; // Позиция по X от 0% до 100%
        const posY = Math.random() * 100; // Позиция по Y от 0% до 100%
        icon.style.top = `${posY}%`;
        icon.style.left = `${posX}%`;

        background.appendChild(icon);
    }
});