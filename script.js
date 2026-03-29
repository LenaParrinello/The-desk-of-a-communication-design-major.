let gameRunning = false;
let paused = false;
let animFrame;
let spawnInterval;

const clutterIDs = [
    'clutter-b0', 'clutter-b1', 'clutter-b2', 'clutter-b3', 'clutter-b4',
    'clutter-p0', 'clutter-p1', 'clutter-p2', 'clutter-p3', 'clutter-p4'
];
let clearedCount = 0;
let fistToggle = false;

const itemImgs = {
    moniter:   'monitor 2.png',
    keys:      'keys.png',
    coster:    'coster.png',
    plant:     'plant.png',
    tablet:    'tablet.png',
    mouse:     'mouse.png',
    spindrift: 'spin drift.png',
};

function switchTab(name, el) {
    // hide all panels
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    // deactivate all tabs
    document.querySelectorAll('.browser-tab').forEach(t => t.classList.remove('active'));
    // show selected
    document.getElementById('tab-' + name).style.display = 'block';
    el.classList.add('active');
    // if switching away from video, pause it
    const vid = document.getElementById('myVideo');
    if (name !== 'video' && vid) vid.pause();
}

function openInfo(key) {
    document.getElementById('infoImg').src = itemImgs[key];
    const descEl = document.getElementById('desc-' + key);
    document.getElementById('infoDescription').textContent = descEl ? descEl.textContent.trim() : '';
    document.getElementById('infoOverlay').classList.add('open');
}

function closeInfo() {
    document.getElementById('infoOverlay').classList.remove('open');
}

function toggleFists() {
    fistToggle = !fistToggle;
    document.getElementById('right1').style.display = fistToggle ? 'none' : 'block';
    document.getElementById('left1').style.display = fistToggle ? 'none' : 'block';
    document.getElementById('rightfist').style.display = fistToggle ? 'block' : 'none';
    document.getElementById('leftfist').style.display = fistToggle ? 'block' : 'none';
}

function openGuardSpeech() {
    document.getElementById('guardPopup').style.display = 'flex';
    document.getElementById('guardSpeechBubble').style.display = 'block';
}

// Clicking the guard image hides him entirely
function closeGuardSpeech() {
    document.getElementById('guardPopup').style.display = 'none';
    document.getElementById('guardSpeechBubble').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    clutterIDs.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', () => {
            if (el.style.display === 'none') return;
            el.style.display = 'none';
            toggleFists();
            clearedCount++;
            if (clearedCount >= clutterIDs.length) {
                const p = document.getElementById('messText');
                if (p) p.textContent = 'WOW! check out your new clean desk, click to inspect each item.';
            }
        });
    });
});

// ── Game logic ──
function openGame() {
    const screen = document.getElementById('gameScreen');
    screen.style.display = 'flex';
    openGuardSpeech();
    const canvas = document.getElementById('gameCanvas');
    canvas.width = 700;
    canvas.height = 460;
    if (!gameRunning) startGame();
}

function closeGame() {
    document.getElementById('gameScreen').style.display = 'none';
    gameRunning = false;
    paused = false;
    cancelAnimationFrame(animFrame);
    clearInterval(spawnInterval);
}

function togglePause() {
    paused = !paused;
    const overlay = document.getElementById('pauseOverlay');
    const btn = document.getElementById('pauseBtn');
    if (paused) {
        overlay.style.display = 'flex';
        btn.innerText = 'Resume';
        cancelAnimationFrame(animFrame);
    } else {
        overlay.style.display = 'none';
        btn.innerText = 'Pause';
        loop();
    }
}

function startGame() {
    gameRunning = true;
    paused = false;

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    let player = {
        x: W / 2, y: H / 2, w: 26, h: 26, speed: 5,
        health: 100, shield: 50, maxHealth: 100, maxShield: 50,
        ammo: 30, maxAmmo: 30
    };

    let bullets = [], enemies = [], particles = [], pickups = [];
    let score = 0, wave = 1;
    let keys = {};
    let gameOver = false;
    let stormRadius = W * 0.75;
    let stormX = W / 2, stormY = H / 2;
    let frameCount = 0;
    let killStreak = 0, killStreakTimer = 0;
    let reloading = false, reloadTimer = 0;

    const enemyTypes = [
        { color: '#ff4655', hp: 1, speed: 1.4, size: 22, points: 10 },
        { color: '#ff8c00', hp: 3, speed: 0.9, size: 30, points: 20 },
        { color: '#9b59b6', hp: 1, speed: 2.8, size: 16, points: 30 },
    ];

    document.addEventListener('keydown', e => {
        keys[e.key] = true;
        if (e.key === 'r' || e.key === 'R') startReload();
        if (e.key === 'p' || e.key === 'P') togglePause();
        if (e.key === 'Escape') togglePause();
    });
    document.addEventListener('keyup', e => keys[e.key] = false);

    canvas.addEventListener('click', (e) => {
        if (paused || gameOver) return;
        if (reloading || player.ammo <= 0) { startReload(); return; }
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = mx - (player.x + 13);
        const dy = my - (player.y + 13);
        const dist = Math.sqrt(dx * dx + dy * dy);
        bullets.push({ x: player.x + 13, y: player.y + 13, vx: (dx / dist) * 11, vy: (dy / dist) * 11, r: 5, life: 80 });
        player.ammo--;
        for (let i = 0; i < 5; i++) {
            particles.push({ x: player.x + 13, y: player.y + 13, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 10, color: '#ffd700', r: 3 });
        }
    });

    function startReload() {
        if (reloading || player.ammo === player.maxAmmo) return;
        reloading = true; reloadTimer = 120;
    }

    function spawnEnemy() {
        const typeIndex = Math.min(Math.floor(Math.random() * (1 + Math.floor(wave / 2))), 2);
        const type = enemyTypes[typeIndex];
        const side = Math.floor(Math.random() * 4);
        let ex, ey;
        if (side === 0) { ex = Math.random() * W; ey = -30; }
        else if (side === 1) { ex = Math.random() * W; ey = H + 30; }
        else if (side === 2) { ex = -30; ey = Math.random() * H; }
        else { ex = W + 30; ey = Math.random() * H; }
        enemies.push({ x: ex, y: ey, w: type.size, h: type.size, speed: type.speed + (wave - 1) * 0.15, hp: type.hp + Math.floor(wave / 3), maxHp: type.hp + Math.floor(wave / 3), color: type.color, points: type.points });
    }

    function spawnPickup(x, y) {
        if (Math.random() < 0.4) {
            const types = ['health', 'shield', 'ammo'];
            pickups.push({ x, y, type: types[Math.floor(Math.random() * types.length)], life: 400 });
        }
    }

    spawnInterval = setInterval(spawnEnemy, Math.max(300, 1200 - wave * 80));

    function loop() {
        if (paused || gameOver) return;
        frameCount++;

        if (frameCount % 700 === 0) {
            wave++;
            stormRadius = Math.max(100, stormRadius - 40);
            clearInterval(spawnInterval);
            spawnInterval = setInterval(spawnEnemy, Math.max(300, 1200 - wave * 80));
        }

        killStreakTimer = Math.max(0, killStreakTimer - 1);
        if (killStreakTimer === 0) killStreak = 0;

        if (reloading) {
            reloadTimer--;
            if (reloadTimer <= 0) { reloading = false; player.ammo = player.maxAmmo; }
        }

        const dxStorm = player.x - stormX;
        const dyStorm = player.y - stormY;
        if (Math.sqrt(dxStorm * dxStorm + dyStorm * dyStorm) > stormRadius && frameCount % 45 === 0) {
            if (player.shield > 0) player.shield = Math.max(0, player.shield - 5);
            else player.health = Math.max(0, player.health - 5);
        }

        if (player.health <= 0) gameOver = true;

        if (keys['ArrowLeft'] || keys['a']) player.x = Math.max(0, player.x - player.speed);
        if (keys['ArrowRight'] || keys['d']) player.x = Math.min(W - player.w, player.x + player.speed);
        if (keys['ArrowUp'] || keys['w']) player.y = Math.max(0, player.y - player.speed);
        if (keys['ArrowDown'] || keys['s']) player.y = Math.min(H - player.h, player.y + player.speed);

        ctx.fillStyle = '#1a2a1a'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
        for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
        for (let i = 0; i < H; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

        ctx.save();
        ctx.beginPath(); ctx.arc(stormX, stormY, stormRadius, 0, Math.PI * 2);
        ctx.rect(W, 0, -W, H); ctx.fillStyle = 'rgba(100, 0, 180, 0.22)'; ctx.fill('evenodd');
        ctx.restore();
        ctx.beginPath(); ctx.arc(stormX, stormY, stormRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(180, 80, 255, 0.8)'; ctx.lineWidth = 3; ctx.stroke();

        pickups = pickups.filter(p => p.life > 0);
        pickups.forEach(p => {
            p.life--;
            ctx.fillStyle = p.type === 'health' ? '#2ecc71' : p.type === 'shield' ? '#3498db' : '#f39c12';
            ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
            ctx.fillStyle = 'white'; ctx.font = 'bold 9px Arial';
            ctx.fillText(p.type === 'health' ? 'HP' : p.type === 'shield' ? 'SH' : 'AM', p.x - 8, p.y + 4);
            if (Math.abs(p.x - player.x) < 22 && Math.abs(p.y - player.y) < 22) {
                if (p.type === 'health') player.health = Math.min(player.maxHealth, player.health + 25);
                else if (p.type === 'shield') player.shield = Math.min(player.maxShield, player.shield + 20);
                else player.ammo = player.maxAmmo;
                p.life = 0;
            }
        });

        ctx.fillStyle = '#00e5ff'; ctx.fillRect(player.x, player.y, player.w, player.h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(player.x + 10, player.y - 10, 7, 12);

        bullets = bullets.filter(b => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H);
        bullets.forEach(b => {
            b.x += b.vx; b.y += b.vy; b.life--;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        });

        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life--;
            ctx.globalAlpha = p.life / 15; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        });

        enemies.forEach((e, ei) => {
            const edx = (player.x + 13) - (e.x + e.w / 2);
            const edy = (player.y + 13) - (e.y + e.h / 2);
            const ed = Math.sqrt(edx * edx + edy * edy);
            e.x += (edx / ed) * e.speed; e.y += (edy / ed) * e.speed;
            ctx.fillStyle = e.color; ctx.fillRect(e.x, e.y, e.w, e.h);
            ctx.fillStyle = 'black';
            const ew = e.w;
            ctx.fillRect(e.x + ew * 0.2, e.y + ew * 0.25, ew * 0.2, ew * 0.2);
            ctx.fillRect(e.x + ew * 0.6, e.y + ew * 0.25, ew * 0.2, ew * 0.2);
            ctx.fillRect(e.x + ew * 0.3, e.y + ew * 0.6, ew * 0.4, ew * 0.15);
            if (e.maxHp > 1) {
                ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 8, e.w, 5);
                ctx.fillStyle = '#2ecc71'; ctx.fillRect(e.x, e.y - 8, e.w * (e.hp / e.maxHp), 5);
            }
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
                const b = bullets[bi];
                if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
                    e.hp--; bullets.splice(bi, 1);
                    for (let i = 0; i < 10; i++) {
                        particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6, life: 18, color: e.color, r: 4 });
                    }
                    if (e.hp <= 0) {
                        score += e.points * (killStreak > 2 ? 2 : 1);
                        killStreak++; killStreakTimer = 180;
                        spawnPickup(e.x + e.w / 2, e.y + e.h / 2);
                        enemies.splice(ei, 1);
                    }
                    break;
                }
            }
            if (e.x + e.w > player.x && e.x < player.x + player.w && e.y + e.h > player.y && e.y < player.y + player.h) {
                if (player.shield > 0) player.shield = Math.max(0, player.shield - 0.8);
                else player.health = Math.max(0, player.health - 0.4);
            }
        });

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, H - 44, 150, 14); ctx.fillRect(10, H - 26, 150, 14);
        ctx.fillStyle = '#3498db'; ctx.fillRect(10, H - 44, 150 * (player.shield / player.maxShield), 14);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(10, H - 26, 150 * (player.health / player.maxHealth), 14);
        ctx.fillStyle = 'white'; ctx.font = 'bold 10px Arial';
        ctx.fillText('SHIELD  ' + Math.round(player.shield), 14, H - 33);
        ctx.fillText('HEALTH  ' + Math.round(player.health), 14, H - 15);
        ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Score: ' + score, W / 2, 24);
        ctx.textAlign = 'left'; ctx.font = 'bold 13px Arial';
        ctx.fillText('Wave ' + wave, W - 70, 24);
        ctx.fillStyle = reloading ? '#ff6b6b' : 'white'; ctx.font = '12px Arial';
        ctx.fillText(reloading ? 'RELOADING... ' + Math.ceil(reloadTimer / 60) + 's' : 'AMMO: ' + player.ammo + '/' + player.maxAmmo, 10, 24);
        if (killStreak >= 3) {
            ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial';
            ctx.fillText('x' + killStreak + ' STREAK!', W - 120, H - 20);
        }

        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = 'white'; ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center';
            ctx.fillText('ELIMINATED', W / 2, H / 2 - 50);
            ctx.font = '20px Arial';
            ctx.fillText('Final Score: ' + score, W / 2, H / 2);
            ctx.fillText('Wave Reached: ' + wave, W / 2, H / 2 + 34);
            ctx.font = '14px Arial';
            ctx.fillText('Click laptop to play again', W / 2, H / 2 + 72);
            ctx.textAlign = 'left';
            gameRunning = false; clearInterval(spawnInterval);
            return;
        }

        animFrame = requestAnimationFrame(loop);
    }

    loop();
}