import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Player } from './player.js';
import { World } from './world.js';
import { UI } from './ui.js';
import { NetworkManager } from './network.js';
import { AssetManager } from './assets.js';

class Game {
    constructor() {
        this.state = {
            screen: 'loading', // loading, mainMenu, playing
            playerData: {
                health: 100,
                maxHealth: 100,
                hunger: 100,
                maxHunger: 100,
                inventory: [],
                gold: 0,
                position: new THREE.Vector3(0, 0, 0),
                rotation: 0,
                skills: {
                    scavenging: 1,
                    stealth: 1,
                    combat: 1,
                    survival: 1
                }
            },
            debug: false
        };

        // Initialize systems
        this.initRenderer();
        this.ui = new UI(this);
        this.assetManager = new AssetManager(this);
        this.networkManager = new NetworkManager(this);
        
        // Load game assets
        this.loadGame();
        
        // Set up event handlers
        this.setupEventListeners();
        
        // Start game loop
        this.lastTime = 0;
        this.animate();
    }
    
    initRenderer() {
        // Set up Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.5, 5);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        
        // Add basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sunLight.position.set(50, 50, 50);
        sunLight.castShadow = true;
        this.scene.add(sunLight);
        
        // Initialize controls (will be replaced with custom controls when game starts)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    loadGame() {
        // Simulate loading progress
        let progress = 0;
        const progressBar = document.querySelector('.progress-fill');
        
        const loadingInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(loadingInterval);
                
                // Loading complete, show main menu
                setTimeout(() => {
                    this.changeGameState('mainMenu');
                }, 500);
            }
            
            progressBar.style.width = `${progress}%`;
        }, 300);
        
        // Preload assets
        this.assetManager.preloadAssets();
    }
    
    setupEventListeners() {
        // Main menu buttons
        document.getElementById('play-button').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('options-button').addEventListener('click', () => {
            // TODO: Show options panel
            console.log('Options clicked');
        });
        
        document.getElementById('credits-button').addEventListener('click', () => {
            // TODO: Show credits panel
            console.log('Credits clicked');
        });
        
        // Game UI buttons
        document.getElementById('inventory-button').addEventListener('click', () => {
            this.ui.togglePanel('inventory');
        });
        
        document.getElementById('map-button').addEventListener('click', () => {
            this.ui.togglePanel('worldMap');
        });
        
        // Close buttons for panels
        document.querySelectorAll('.close-button').forEach(button => {
            button.addEventListener('click', () => {
                button.closest('.game-panel').classList.add('hidden');
            });
        });
        
        // Debug toggle
        document.addEventListener('keydown', (e) => {
            if (e.key === '`') {
                this.state.debug = !this.state.debug;
                document.getElementById('debug-panel').classList.toggle('hidden', !this.state.debug);
            }
        });
    }
    
    startGame() {
        this.changeGameState('playing');
        
        // Initialize world and player
        this.world = new World(this);
        this.player = new Player(this);
        
        // Remove orbit controls and set up player controls
        this.controls.dispose();
        
        // Generate initial world
        this.world.generateWorld();
        
        // Spawn player
        this.player.spawn();
        
        // Start game systems
        this.startGameSystems();
    }
    
    startGameSystems() {
        // Start hunger depletion
        this.hungerInterval = setInterval(() => {
            this.state.playerData.hunger = Math.max(0, this.state.playerData.hunger - 0.5);
            this.ui.updateHungerBar();
            
            // Apply hunger effects
            if (this.state.playerData.hunger === 0) {
                this.state.playerData.health -= 1;
                this.ui.updateHealthBar();
                this.ui.showNotification('You are starving!');
                
                if (this.state.playerData.health <= 0) {
                    this.playerDeath();
                }
            }
        }, 10000);
    }
    
    playerDeath() {
        this.ui.showNotification('You died!', 'error');
        // TODO: Implement death mechanics
        
        // For now, just respawn with half health
        this.state.playerData.health = this.state.playerData.maxHealth / 2;
        this.state.playerData.hunger = this.state.playerData.maxHunger / 2;
        this.ui.updateHealthBar();
        this.ui.updateHungerBar();
        
        // Teleport to a safe location
        this.player.teleport(0, 0.5, 0);
    }
    
    changeGameState(newState) {
        this.state.screen = newState;
        
        // Hide all screens
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('game-ui').classList.add('hidden');
        
        // Show the appropriate screen
        switch (newState) {
            case 'loading':
                document.getElementById('loading-screen').classList.remove('hidden');
                break;
            case 'mainMenu':
                document.getElementById('main-menu').classList.remove('hidden');
                break;
            case 'playing':
                document.getElementById('game-ui').classList.remove('hidden');
                break;
        }
    }
    
    animate(time = 0) {
        requestAnimationFrame((t) => this.animate(t));
        
        const deltaTime = (time - this.lastTime) / 1000;
        this.lastTime = time;
        
        // Skip first frame deltaTime which can be very large
        if (deltaTime > 0.1) return;
        
        // Update FPS counter if debug mode is on
        if (this.state.debug && time % 10 < 1) {
            document.getElementById('fps').textContent = Math.round(1 / deltaTime);
        }
        
        // Update game systems
        if (this.state.screen === 'playing') {
            if (this.player) this.player.update(deltaTime);
            if (this.world) this.world.update(deltaTime);
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the game when the page is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

export { Game };

