import * as THREE from 'three';

// This is a simple mock for network functionality
// In a real MMORPG, this would connect to a server

class NetworkManager {
    constructor(game) {
        this.game = game;
        this.connected = false;
        this.players = new Map(); // Other players in the game
        this.npcs = new Map(); // NPCs in the game
        
        // Initialize with some mock data
        this.initialize();
    }
    
    initialize() {
        // Simulate connecting to a server
        setTimeout(() => {
            this.connected = true;
            this.game.ui.showNotification('Connected to server');
            
            // Spawn some NPCs
            this.spawnNPCs();
            
            // Start simulating other players after a delay
            setTimeout(() => {
                this.simulateOtherPlayers();
            }, 5000);
        }, 2000);
    }
    
    spawnNPCs() {
        // Spawn several NPCs around the world when game starts
        const npcCount = 10;
        const npcTypes = ['merchant', 'quest_giver', 'guard', 'citizen'];
        
        for (let i = 0; i < npcCount; i++) {
            const npcId = `npc-${i}`;
            const npcType = npcTypes[Math.floor(Math.random() * npcTypes.length)];
            
            // Random position within the world
            const x = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            
            // Create NPC data
            const npc = {
                id: npcId,
                type: npcType,
                name: this.generateNPCName(npcType),
                position: { x, y: 0.25, z },
                rotation: Math.random() * Math.PI * 2,
                model: null
            };
            
            // Create NPC model if player is nearby
            if (this.game.state.screen === 'playing') {
                this.createNPCModel(npc);
            }
            
            this.npcs.set(npcId, npc);
        }
    }
    
    generateNPCName(type) {
        const namesByType = {
            merchant: ['Whiskers', 'Nibbles', 'Cheesy', 'Scurry', 'Swiftail'],
            quest_giver: ['Elder Squeaks', 'Captain Rattail', 'Professor Whiskers', 'Lady Fur'],
            guard: ['Sgt. Bite', 'Officer Squeak', 'Guardian Claw', 'Watcher Tail'],
            citizen: ['Tiny', 'Scamper', 'Dusty', 'Crumbs', 'Shadow', 'Squeak']
        };
        
        const names = namesByType[type] || namesByType.citizen;
        return names[Math.floor(Math.random() * names.length)];
    }
    
    createNPCModel(npc) {
        // Only create models when game is playing and world is loaded
        if (!this.game.world) return;
        
        // Simple placeholder for NPC model
        const group = new THREE.Group();
        
        let color;
        switch (npc.type) {
            case 'merchant': color = 0xFFD700; break; // Gold
            case 'quest_giver': color = 0x4169E1; break; // Royal blue
            case 'guard': color = 0xA52A2A; break; // Brown
            case 'citizen': color = 0x808080; break; // Gray
            default: color = 0xAAAAAA;
        }
        
        // Create a simple rat model (similar to player but different color)
        const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.z = Math.PI / 2;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.2, 16, 12);
        const headMaterial = new THREE.MeshStandardMaterial({ color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0.4, 0.1, 0);
        group.add(head);
        
        // Add to the scene
        group.position.set(npc.position.x, npc.position.y, npc.position.z);
        group.rotation.y = npc.rotation;
        
        // Scale the NPC
        group.scale.set(0.5, 0.5, 0.5);
        
        // Add to scene
        this.game.scene.add(group);
        
        // Make NPCs interactable
        group.userData = {
            interactable: true,
            type: 'npc',
            npcId: npc.id,
            interact: (player) => {
                this.interactWithNPC(npc.id);
            }
        };
        
        this.game.world.interactables.push(group);
        
        // Store reference to the model
        npc.model = group;
    }
    
    interactWithNPC(npcId) {
        const npc = this.npcs.get(npcId);
        if (!npc) return;
        
        switch (npc.type) {
            case 'merchant':
                this.game.ui.showNotification(`${npc.name} says: "Want to trade some cheese?"`);
                // TODO: Open trading UI
                break;
                
            case 'quest_giver':
                this.game.ui.showNotification(`${npc.name} says: "I have a task for a brave rat like you!"`);
                // TODO: Open quest UI
                break;
                
            case 'guard':
                this.game.ui.showNotification(`${npc.name} says: "Move along, citizen. Stay out of trouble."`);
                break;
                
            case 'citizen':
                this.game.ui.showNotification(`${npc.name} says: "Hello there! Nice day for scavenging!"`);
                break;
        }
    }
    
    simulateOtherPlayers() {
        // Simulate 5 other players moving around
        const playerCount = 5;
        
        for (let i = 0; i < playerCount; i++) {
            const playerId = `player-${i}`;
            const playerName = `Rat${Math.floor(Math.random() * 1000)}`;
            
            // Random position within 100 units of the player
            const playerPos = this.game.state.playerData.position;
            const x = playerPos.x + (Math.random() - 0.5) * 200;
            const z = playerPos.z + (Math.random() - 0.5) * 200;
            
            // Create player data
            const player = {
                id: playerId,
                name: playerName,
                position: { x, y: 0.25, z },
                rotation: Math.random() * Math.PI * 2,
                model: null,
                moveTarget: null,
                moveSpeed: 2 + Math.random() * 2
            };
            
            // Create player model
            if (this.game.state.screen === 'playing') {
                this.createPlayerModel(player);
            }
            
            this.players.set(playerId, player);
        }
        
        // Start movement simulation
        this.simulatePlayerMovements();
    }
    
    createPlayerModel(player) {
        // Only create models when game is playing and world is loaded
        if (!this.game.world) return;
        
        // Similar to player model but with random color
        const group = new THREE.Group();
        
        // Use random color for other players
        const color = Math.random() * 0xFFFFFF;
        
        const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.z = Math.PI / 2;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.2, 16, 12);
        const headMaterial = new THREE.MeshStandardMaterial({ color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0.4, 0.1, 0);
        group.add(head);
        
        // Add name tag
        const nameDiv = document.createElement('div');
        nameDiv.className = 'nametag';
        nameDiv.textContent = player.name;
        nameDiv.style.color = 'white';
        nameDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        nameDiv.style.padding = '2px 5px';
        nameDiv.style.borderRadius = '3px';
        nameDiv.style.fontFamily = 'Arial, sans-serif';
        nameDiv.style.fontSize = '12px';
        nameDiv.style.pointerEvents = 'none';
        
        const nameObj = new CSS2DObject(nameDiv);
        nameObj.position.set(0, 1, 0);
        group.add(nameObj);
        
        // Position and add to scene
        group.position.set(player.position.x, player.position.y, player.position.z);
        group.rotation.y = player.rotation;
        
        // Scale the player
        group.scale.set(0.5, 0.5, 0.5);
        
        this.game.scene.add(group);
        
        // Store reference to the model
        player.model = group;
    }
    
    simulatePlayerMovements() {
        // Update every 5 seconds
        setInterval(() => {
            if (this.game.state.screen !== 'playing') return;
            
            this.players.forEach(player => {
                // Set a new target position
                const currentPos = player.model ? player.model.position : player.position;
                
                // Move to random position within 50 units
                const targetX = currentPos.x + (Math.random() - 0.5) * 100;
                const targetZ = currentPos.z + (Math.random() - 0.5) * 100;
                
                player.moveTarget = { x: targetX, z: targetZ };
                
                // Set rotation to face target
                const angle = Math.atan2(targetX - currentPos.x, targetZ - currentPos.z);
                player.rotation = angle;
                
                if (player.model) {
                    player.model.rotation.y = angle;
                }
            });
        }, 5000);
        
        // Apply movement in the game loop
        const updateMovements = (deltaTime) => {
            if (this.game.state.screen !== 'playing') return;
            
            this.players.forEach(player => {
                if (!player.model || !player.moveTarget) return;
                
                const currentPos = player.model.position;
                const target = player.moveTarget;
                
                // Calculate direction and distance
                const dx = target.x - currentPos.x;
                const dz = target.z - currentPos.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                if (distance > 0.1) {
                    // Move towards target
                    const speed = player.moveSpeed * deltaTime;
                    const moveStep = Math.min(speed, distance);
                    
                    const nx = dx / distance;
                    const nz = dz / distance;
                    
                    currentPos.x += nx * moveStep;
                    currentPos.z += nz * moveStep;
                    
                    // Update Y position based on terrain
                    if (this.game.world) {
                        currentPos.y = this.game.world.getHeightAt(currentPos.x, currentPos.z);
                        currentPos.y += 0.25; // Offset to stand on ground
                    }
                }
            });
            
            requestAnimationFrame(() => updateMovements(1/60));
        };
        
        updateMovements(1/60);
    }
}

class CSS2DObject extends THREE.Object3D {
    constructor(element) {
        super();
        this.element = element || document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.userSelect = 'none';
        
        this.addEventListener('removed', () => {
            this.element.parentNode?.removeChild(this.element);
        });
    }
}

export { NetworkManager };