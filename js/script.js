// Game Constants
const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 900;
const GRAVITY = 0.25;
const FLAP_STRENGTH = -8;
const PIPE_WIDTH = 80;
const PIPE_GAP = 320;
const PIPE_SPEED = 5;

// Difficulty Settings
const DIFFICULTIES = {
    easy: { pipeSeparation: 250, pipeSpeed: 2.5, gravity: 0.2 },
    medium: { pipeSeparation: 200, pipeSpeed: 3.5, gravity: 0.25 },
    hard: { pipeSeparation: 160, pipeSpeed: 5, gravity: 0.35 }
};

// Game Object
const game = {
    canvas: null,
    ctx: null,
    birdImage: null,
    bird: {
        x: 100,
        y: 450,
        radius: 13,
        velocityY: 0,
        color: '#FFD700',
        width: 70,
        height: 70
    },
    pipes: [],
    score: 0,
    highScore: 0,
    gameRunning: false,
    gamePaused: false,
    currentDifficulty: 'easy',
    soundVolume: 50,
    lastPipeTime: 0,
    pipeCounter: 0,
    backgroundTrack: 'none',
    audioContext: null,
    backgroundOscillators: [],
    backgroundGainNodes: [],
    backgroundActive: false,
    musicTracks: [
        { id: 'none', name: 'Off' },
        { id: 'track1', name: 'Super Slow' },
        { id: 'track2', name: 'Never Alone' },
        { id: 'track3', name: 'Light It Up' },
        { id: 'track4', name: 'Xonada' }
    ],
    currentTrackIndex: 0,
    gamesPlayed: 0,
    totalScore: 0,

    // Initialize game
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        // Load bird image
        this.birdImage = new Image();
        this.birdImage.src = '../assets/images/ami.jpeg';

        this.highScore = localStorage.getItem('flappyHighScore') || 0;
        this.soundVolume = localStorage.getItem('flappySoundVolume') || 50;
        this.backgroundTrack = localStorage.getItem('flappyBackgroundTrack') || 'none';
        this.gamesPlayed = parseInt(localStorage.getItem('flappyGamesPlayed')) || 0;
        this.totalScore = parseInt(localStorage.getItem('flappyTotalScore')) || 0;

        document.getElementById('volumeSlider').value = this.soundVolume;
        document.getElementById('volumeValue').textContent = this.soundVolume;
        
        // Update home screen statistics
        this.updateHomeStatistics();
        
        // Set initial track index and display
        this.currentTrackIndex = this.musicTracks.findIndex(t => t.id === this.backgroundTrack);
        if (this.currentTrackIndex === -1) this.currentTrackIndex = 0;
        this.updateTrackDisplay();

        // Event listeners
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameRunning && !this.gamePaused) {
                    this.flapBird();
                }
            } else if (e.code === 'Escape') {
                e.preventDefault();
                if (this.gameRunning) {
                    if (this.gamePaused) {
                        this.resumeGame();
                    } else {
                        this.pauseGame();
                    }
                }
            }
        });

        this.canvas.addEventListener('click', () => {
            if (this.gameRunning && !this.gamePaused) {
                this.flapBird();
            }
        });

        this.gameLoop();
    },

    // Start the game
    startGame() {
        this.hideAllScreens();
        this.gameRunning = true;
        this.gamePaused = false;
        this.score = 0;
        this.pipes = [];
        this.bird.y = 450;
        this.bird.velocityY = 0;
        this.lastPipeTime = 0;
        this.pipeCounter = 0;
        this.playSound('start');
        this.playBackgroundMusic();
    },

    // Flap the bird
    flapBird() {
        this.bird.velocityY = FLAP_STRENGTH;
        this.playSound('flap');
    },

    // Update game state
    update() {
        if (!this.gameRunning || this.gamePaused) return;

        const difficulty = DIFFICULTIES[this.currentDifficulty];
        const progressiveMultiplier = this.getProgressiveDifficulty();

        // Update bird physics with progressive gravity
        this.bird.velocityY += difficulty.gravity * progressiveMultiplier;
        this.bird.y += this.bird.velocityY;

        // Check collision with ground and ceiling
        if (this.bird.y + this.bird.radius > CANVAS_HEIGHT || this.bird.y - this.bird.radius < 0) {
            this.endGame('fall');
            return;
        }

        // Generate pipes with progressive pipe separation
        this.lastPipeTime++;
        const progressiveSeparation = difficulty.pipeSeparation / progressiveMultiplier;
        if (this.lastPipeTime > progressiveSeparation) {
            this.generatePipe();
            this.lastPipeTime = 0;
        }

        // Update pipes with progressive speed
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            this.pipes[i].x -= difficulty.pipeSpeed * progressiveMultiplier;

            // Check collision with pipe
            if (this.isColliding(this.bird, this.pipes[i])) {
                this.endGame('pipe');
                return;
            }

            // Award points
            if (!this.pipes[i].scored && this.pipes[i].x + PIPE_WIDTH < this.bird.x) {
                this.pipes[i].scored = true;
                this.score++;
                this.playSound('score');
            }

            // Remove off-screen pipes
            if (this.pipes[i].x + PIPE_WIDTH < 0) {
                this.pipes.splice(i, 1);
            }
        }
    },

    // Generate a new pipe
    generatePipe() {
        const minHeight = 40;
        const maxHeight = CANVAS_HEIGHT - PIPE_GAP - 40;
        const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;

        this.pipes.push({
            x: CANVAS_WIDTH,
            topHeight: topHeight,
            scored: false
        });
    },

    // Check collision detection
    isColliding(bird, pipe) {
        const birdLeft = bird.x - bird.width / 2;
        const birdRight = bird.x + bird.width / 2;
        const birdTop = bird.y - bird.height / 2;
        const birdBottom = bird.y + bird.height / 2;

        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + PIPE_WIDTH;
        const pipeTopBottom = pipe.topHeight;
        const pipeBottomTop = pipe.topHeight + PIPE_GAP;

        // Simple AABB collision detection
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
            if (birdTop < pipeTopBottom || birdBottom > pipeBottomTop) {
                return true;
            }
        }

        return false;
    },

    // Draw the game
    draw() {
        // Clear canvas with gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#E0F6FF');
        gradient.addColorStop(1, '#90EE90');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw clouds
        this.drawClouds();

        // Draw pipes
        this.drawPipes();

        // Draw bird
        this.drawBird();

        // Draw score
        this.drawScore();
    },

    // Draw the bird
    drawBird() {
        if (this.birdImage && this.birdImage.complete && this.birdImage.naturalHeight !== 0) {
            // Draw bird image centered at bird position
            const offsetX = this.bird.width / 2;
            const offsetY = this.bird.height / 2;
            
            this.ctx.save();
            // Rotate image based on velocity for dynamic effect
            const rotation = Math.min(this.bird.velocityY / 10, 0.5); // Limit rotation
            this.ctx.translate(this.bird.x, this.bird.y);
            this.ctx.rotate(rotation);
            this.ctx.drawImage(this.birdImage, -offsetX, -offsetY, this.bird.width, this.bird.height);
            this.ctx.restore();
        } else {
            // Fallback to circle if image not loaded
            this.ctx.fillStyle = this.bird.color;
            this.ctx.beginPath();
            this.ctx.arc(this.bird.x, this.bird.y, this.bird.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Bird outline
            this.ctx.strokeStyle = '#FFA500';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    },

    // Draw pipes
    drawPipes() {
        this.pipes.forEach(pipe => {
            // Draw top fire pipes
            this.drawFirePipe(pipe.x, 0, pipe.topHeight, true);
            
            // Draw bottom fire pipes
            const bottomY = pipe.topHeight + PIPE_GAP;
            this.drawFirePipe(pipe.x, bottomY, CANVAS_HEIGHT - bottomY, false);
        });
    },

    // Draw fire effect for pipes
    drawFirePipe(x, y, height, isTop) {
        const pipeLength = height;
        
        // Draw base pipe structure with dark color
        const baseGradient = this.ctx.createLinearGradient(x, y, x + PIPE_WIDTH, y);
        baseGradient.addColorStop(0, '#1a1a1a');
        baseGradient.addColorStop(0.5, '#2d2d2d');
        baseGradient.addColorStop(1, '#1a1a1a');
        this.ctx.fillStyle = baseGradient;
        this.ctx.fillRect(x, y, PIPE_WIDTH, pipeLength);

        // Draw multiple fire sections along the pipe
        const fireBlockHeight = 50;
        const fireBlockCount = Math.ceil(pipeLength / fireBlockHeight);
        
        for (let i = 0; i < fireBlockCount; i++) {
            const blockY = y + (i * fireBlockHeight);
            const blockHeight = Math.min(fireBlockHeight, pipeLength - (i * fireBlockHeight));
            
            if (blockHeight > 0) {
                const offsetX = (this.pipeCounter + x + i * 7) % 20;
                this.drawFireBlock(x, blockY, PIPE_WIDTH, blockHeight, offsetX, isTop && i === fireBlockCount - 1);
            }
        }

        // Pipe border outline
        this.ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, PIPE_WIDTH, pipeLength);
    },

    // Draw a block of fire with organic flames
    drawFireBlock(x, y, width, height, timeOffset, isTop) {
        const flameHeight = 40;
        const centerY = y + (isTop ? height : 0);
        const direction = isTop ? -1 : 1;
        
        // Draw 4-5 individual flames along the width
        const flamePositions = [x + width * 0.1, x + width * 0.3, x + width * 0.5, x + width * 0.7, x + width * 0.9];
        
        flamePositions.forEach((flameX, index) => {
            this.drawOrganicFlame(
                flameX, 
                centerY, 
                flameHeight, 
                direction,
                timeOffset + index * 2
            );
        });
    },

    // Draw an organic-looking flame
    drawOrganicFlame(baseX, baseY, height, direction, timeOffset) {
        const flicker1 = Math.sin(this.pipeCounter * 0.08 + timeOffset) * 8;
        const flicker2 = Math.sin(this.pipeCounter * 0.12 + timeOffset + 1) * 6;
        const flicker3 = Math.cos(this.pipeCounter * 0.15 + timeOffset + 2) * 4;
        const flicker = flicker1 + flicker2 + flicker3;
        
        const wobble1 = Math.sin(this.pipeCounter * 0.1 + timeOffset) * 6;
        const wobble2 = Math.cos(this.pipeCounter * 0.18 + timeOffset) * 4;
        const wobble = wobble1 + wobble2;
        
        const tipY = baseY + (flicker + height * 0.8) * direction;
        const tipX = baseX + wobble;
        
        // Draw yellow base (hottest part)
        const yellowGradient = this.ctx.createRadialGradient(baseX, baseY, 3, baseX, baseY, 18);
        yellowGradient.addColorStop(0, 'rgba(255, 255, 100, 0.95)');
        yellowGradient.addColorStop(0.4, 'rgba(255, 200, 50, 0.8)');
        yellowGradient.addColorStop(1, 'rgba(255, 200, 50, 0.3)');
        
        this.ctx.fillStyle = yellowGradient;
        this.ctx.beginPath();
        this.ctx.arc(baseX, baseY, 18, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw main flame body with wavy edges
        this.ctx.fillStyle = 'rgba(255, 200, 50, 0.7)';
        this.ctx.beginPath();
        
        const wave1 = Math.sin(this.pipeCounter * 0.1 + timeOffset) * 6;
        const wave2 = Math.cos(this.pipeCounter * 0.14 + timeOffset) * 5;
        const wave3 = Math.sin(this.pipeCounter * 0.2 + timeOffset) * 4;
        
        // Left side of flame
        this.ctx.moveTo(baseX - 12, baseY);
        this.ctx.quadraticCurveTo(
            baseX - 18 + wave1, 
            baseY + height * 0.3 * direction, 
            tipX - 8 + wave2, 
            tipY
        );
        
        // Tip with jagged edge
        this.ctx.quadraticCurveTo(
            tipX + 3, 
            tipY - 10 * direction, 
            tipX + 8 + wave2, 
            tipY
        );
        
        // Right side of flame
        this.ctx.quadraticCurveTo(
            baseX + 18 + wave1, 
            baseY + height * 0.3 * direction, 
            baseX + 12, 
            baseY
        );
        this.ctx.fill();
        
        // Draw orange middle flame
        this.ctx.fillStyle = 'rgba(255, 140, 0, 0.65)';
        this.ctx.beginPath();
        
        this.ctx.moveTo(baseX - 8, baseY);
        this.ctx.quadraticCurveTo(
            baseX - 12 + wave1 * 0.7, 
            baseY + height * 0.35 * direction, 
            tipX + wave3 * 0.5, 
            tipY + 5 * direction
        );
        this.ctx.quadraticCurveTo(
            baseX + 12 + wave1 * 0.7, 
            baseY + height * 0.35 * direction, 
            baseX + 8, 
            baseY
        );
        this.ctx.fill();
        
        // Draw red hot tip
        const redGradient = this.ctx.createRadialGradient(tipX, tipY, 2, tipX, tipY, 10);
        redGradient.addColorStop(0, 'rgba(255, 80, 0, 0.9)');
        redGradient.addColorStop(0.6, 'rgba(255, 40, 0, 0.5)');
        redGradient.addColorStop(1, 'rgba(255, 40, 0, 0)');
        
        this.ctx.fillStyle = redGradient;
        this.ctx.beginPath();
        this.ctx.arc(tipX, tipY, 10, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw bright hot spot
        const hotGradient = this.ctx.createRadialGradient(baseX, baseY, 2, baseX, baseY, 8);
        hotGradient.addColorStop(0, 'rgba(255, 220, 100, 0.8)');
        hotGradient.addColorStop(1, 'rgba(255, 220, 100, 0)');
        
        this.ctx.fillStyle = hotGradient;
        this.ctx.beginPath();
        this.ctx.arc(baseX, baseY, 8, 0, Math.PI * 2);
        this.ctx.fill();
    },

    // Draw clouds
    drawClouds() {
        // Draw some simple moving clouds for visual appeal
        const cloudY1 = 50 + (this.pipeCounter * 0.5) % 100;
        const cloudY2 = 150 + (this.pipeCounter * 0.3) % 100;

        this.drawCloud(80, cloudY1, 30);
        this.drawCloud(300, cloudY2, 40);
    },

    // Draw a single cloud
    drawCloud(x, y, size) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.8, y - size * 0.3, size * 0.8, 0, Math.PI * 2);
        this.ctx.arc(x - size * 0.8, y - size * 0.3, size * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
    },

    // Draw score
    drawScore() {
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillText(`High: ${this.highScore}`, 10, 55);

        // Draw difficulty indicator
        this.ctx.fillStyle = '#228B22';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${this.currentDifficulty.toUpperCase()}`, CANVAS_WIDTH - 10, 30);
    },

    // End game
    endGame(collisionType = 'pipe') {
        this.gameRunning = false;
        this.stopBackgroundMusic();
        
        // Play different sound based on collision type
        if (collisionType === 'fall') {
            this.playFallSound();
        } else {
            this.playGameOverSound();
        }

        // Update game statistics
        this.gamesPlayed++;
        this.totalScore += this.score;
        localStorage.setItem('flappyGamesPlayed', this.gamesPlayed);
        localStorage.setItem('flappyTotalScore', this.totalScore);

        // Update high score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('flappyHighScore', this.highScore);
        }

        // Show game over screen
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('highScoreDisplay').textContent = this.highScore;
        this.showScreen('gameOverScreen');
    },

    // Play fall sound
    playFallSound() {
        const audio = document.getElementById('audioFall');
        if (!audio) return;
        
        audio.volume = (this.soundVolume / 100);
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.log('Audio playback failed:', err);
        });
    },

    // Play game over sound
    playGameOverSound() {
        const audio = document.getElementById('audioGameOver');
        if (!audio) return;
        
        audio.volume = (this.soundVolume / 100);
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.log('Audio playback failed:', err);
        });
    },

    // Play sound effects
    playSound(type) {
        if (this.soundVolume === 0) return;

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const volume = this.soundVolume / 100;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);

        switch (type) {
            case 'flap':
                oscillator.frequency.value = 400;
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'score':
                oscillator.frequency.value = 600;
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.15);
                break;
            case 'gameover':
                oscillator.frequency.value = 200;
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
                break;
            case 'start':
                oscillator.frequency.value = 500;
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
        }
    },

    // Game loop
    gameLoop() {
        this.update();
        this.draw();
        if (this.gameRunning && !this.gamePaused) {
            this.pipeCounter++;
        }
        requestAnimationFrame(() => this.gameLoop());
    },

    // Navigate to next music track
    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
        this.selectTrack();
    },

    // Navigate to previous music track
    prevTrack() {
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.musicTracks.length) % this.musicTracks.length;
        this.selectTrack();
    },

    // Select track by index
    selectTrack() {
        const track = this.musicTracks[this.currentTrackIndex];
        this.setBackgroundTrack(track.id);
    },

    // Update track display
    updateTrackDisplay() {
        const track = this.musicTracks[this.currentTrackIndex];
        const display = document.getElementById('currentTrackName');
        if (display) {
            display.textContent = track.name;
        }
    },

    // Pause game
    pauseGame() {
        if (!this.gameRunning) return;
        this.gamePaused = true;
        this.showScreen('pauseScreen');
    },

    // Resume game
    resumeGame() {
        if (!this.gameRunning) return;
        this.gamePaused = false;
        this.hideAllScreens();
    },

    // Get progressive difficulty multiplier based on score
    getProgressiveDifficulty() {
        // Start at 1.0x and increase by 0.05 for every 5 points
        // Max multiplier: 2.0x at score 100+
        const multiplier = Math.min(1 + (this.score / 100) * 1, 2);
        return multiplier;
    },

    // Set background music track
    setBackgroundTrack(track) {
        this.backgroundTrack = track;
        localStorage.setItem('flappyBackgroundTrack', track);
        
        this.currentTrackIndex = this.musicTracks.findIndex(t => t.id === track);
        if (this.currentTrackIndex === -1) this.currentTrackIndex = 0;
        this.updateTrackDisplay();
        
        // Stop all audio
        this.stopBackgroundMusic();
        
        // Start playing if game is running
        if (this.gameRunning && !this.gamePaused) {
            this.playBackgroundMusic();
        }
    },

    // Play background music
    playBackgroundMusic() {
        if (this.backgroundTrack === 'none' || this.soundVolume === 0) return;
        
        const audioMap = {
            'track1': 'audioTrack1',
            'track2': 'audioTrack2',
            'track3': 'audioTrack3',
            'track4': 'audioTrack4'
        };
        
        const audioElementId = audioMap[this.backgroundTrack];
        if (!audioElementId) return;
        
        const audio = document.getElementById(audioElementId);
        if (!audio) return;
        
        // Set volume (reduce for background music)
        audio.volume = (this.soundVolume / 100) * 0.3;
        
        // Play audio
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.log('Audio playback failed:', err);
        });
        
        this.backgroundActive = true;
    },

    // Stop background music
    stopBackgroundMusic() {
        this.backgroundActive = false;
        
        // Stop all audio elements
        ['audioTrack1', 'audioTrack2', 'audioTrack3', 'audioTrack4'].forEach(id => {
            const audio = document.getElementById(id);
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
    },

    // Set difficulty
    setDifficulty(difficulty) {
        this.currentDifficulty = difficulty;
        localStorage.setItem('flappyDifficulty', difficulty);

        // Update UI
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-difficulty="${difficulty}"]`).classList.add('active');
    },

    // Set volume
    setVolume(value) {
        this.soundVolume = value;
        localStorage.setItem('flappySoundVolume', value);
        document.getElementById('volumeValue').textContent = value;
    },

    // Show high score screen
    showHighScore() {
        const medal = this.highScore > 50 ? '🏆' : this.highScore > 20 ? '🥈' : '🥉';
        document.getElementById('medal').textContent = medal;
        document.getElementById('hsValue').textContent = this.highScore;
        this.showScreen('highScoreScreen');
    },

    // Show settings screen
    showSettings() {
        this.showScreen('settingsScreen');
    },

    // Show menu screen
    showMenu() {
        this.showScreen('menuScreen');
    },

    // Update home screen statistics
    updateHomeStatistics() {
        const bestScoreEl = document.getElementById('homeBestScore');
        const gamesPlayedEl = document.getElementById('homeGamesPlayed');
        const totalScoreEl = document.getElementById('homeTotalScore');

        if (bestScoreEl) bestScoreEl.textContent = this.highScore;
        if (gamesPlayedEl) gamesPlayedEl.textContent = this.gamesPlayed;
        if (totalScoreEl) totalScoreEl.textContent = this.totalScore;
    },

    // Show specific screen
    showScreen(screenId) {
        this.hideAllScreens();
        document.getElementById(screenId).classList.add('active');
        
        // Update home stats when showing intro screen
        if (screenId === 'introScreen') {
            this.updateHomeStatistics();
        }
    },

    // Hide all screens
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
    }
};

// Initialize game when page loads
window.addEventListener('load', () => {
    game.init();
    game.showScreen('introScreen');
});
