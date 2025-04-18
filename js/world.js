import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

class World {
    constructor(game) {
        this.game = game;
        this.simplex = new SimplexNoise();
        this.chunkSize = 20;
        this.chunks = new Map();
        this.loadedChunks = [];
        this.renderDistance = 2;
        this.worldSize = 1000; // 1000x1000 world
        
        this.zones = [];
        this.items = [];
        this.interactables = [];
        
        // Texture maps for different terrain types
        this.terrainTypes = {
            grass: { color: 0x4CAF50 },
            dirt: { color: 0x8B4513 },
            sand: { color: 0xF4A460 },
            stone: { color: 0x808080 },
            water: { color: 0x1976D2 }
        };
    }
    
    generateWorld() {
        // Create skybox
        this.createSkybox();
        
        // Create ground
        this.createGround();
        
        // Generate world zones
        this.generateZones();
        
        // Load initial chunks around player
        this.updateChunks();
    }
    
    createSkybox() {
        // Create a simple skybox with gradient
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `;
        
        const uniforms = {
            topColor: { value: new THREE.Color(0x0077FF) },
            bottomColor: { value: new THREE.Color(0xAAAAAA) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };
        
        const skyGeo = new THREE.SphereGeometry(500, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.game.scene.add(sky);
        
        // Add sun
        const sunGeometry = new THREE.SphereGeometry(10, 16, 8);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(100, 100, 100);
        this.game.scene.add(sun);
    }
    
    createGround() {
        // Create a simple flat ground plane
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 128, 128);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4CAF50,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        
        this.game.scene.add(ground);
        
        // Deform ground with simplex noise
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Get height from noise function
            vertices[i + 1] = this.getHeightAt(x, z);
        }
        
        // Update normals for proper lighting
        groundGeometry.computeVertexNormals();
        
        // Add water plane
        const waterGeometry = new THREE.PlaneGeometry(2000, 2000);
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x1976D2,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.3
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -5;
        this.game.scene.add(water);
    }
    
    getHeightAt(x, z) {
        // Large scale terrain variation
        const largeScale = this.simplex.noise(x * 0.001, z * 0.001) * 20;
        
        // Medium scale details
        const mediumScale = this.simplex.noise(x * 0.01, z * 0.01) * 5;
        
        // Small scale details
        const smallScale = this.simplex.noise(x * 0.05, z * 0.05) * 1;
        
        return largeScale + mediumScale + smallScale;
    }
    
    generateZones() {
        // Define zones in the world (cities, farms, forests, etc.)
        const cityCount = 3;
        const farmCount = 8;
        const forestCount = 12;
        
        // Create cities
        for (let i = 0; i < cityCount; i++) {
            const x = (Math.random() - 0.5) * this.worldSize;
            const z = (Math.random() - 0.5) * this.worldSize;
            const size = 30 + Math.random() * 50;
            
            this.zones.push({
                type: 'city',
                name: this.generateCityName(),
                position: new THREE.Vector3(x, this.getHeightAt(x, z), z),
                radius: size,
                buildings: []
            });
        }
        
        // Create farms
        for (let i = 0; i < farmCount; i++) {
            const x = (Math.random() - 0.5) * this.worldSize;
            const z = (Math.random() - 0.5) * this.worldSize;
            const size = 20 + Math.random() * 30;
            
            this.zones.push({
                type: 'farm',
                name: this.generateFarmName(),
                position: new THREE.Vector3(x, this.getHeightAt(x, z), z),
                radius: size,
                crops: []
            });
        }
        
        // Create forests
        for (let i = 0; i < forestCount; i++) {
            const x = (Math.random() - 0.5) * this.worldSize;
            const z = (Math.random() - 0.5) * this.worldSize;
            const size = 40 + Math.random() * 60;
            
            this.zones.push({
                type: 'forest',
                name: this.generateForestName(),
                position: new THREE.Vector3(x, this.getHeightAt(x, z), z),
                radius: size,
                trees: []
            });
        }
        
        // Mark spawn zone
        this.zones.push({
            type: 'spawn',
            name: 'Rat Hole',
            position: new THREE.Vector3(0, 0, 0),
            radius: 10
        });
        
        // Visualize on minimap
        this.drawWorldMap();
    }
    
    generateCityName() {
        const prefixes = ['Rat', 'Whisker', 'Tail', 'Cheese', 'Shadow', 'Nibble', 'Dark', 'Grey', 'Scurry'];
        const suffixes = ['ville', 'town', 'burg', 'field', 'haven', 'port', 'ford', 'bridge', 'market'];
        
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }
    
    generateFarmName() {
        const prefixes = ['Green', 'Sunny', 'Pleasant', 'Fertile', 'Peaceful', 'Harvest', 'Bounty', 'Golden'];
        const suffixes = ['Acres', 'Fields', 'Meadows', 'Valley', 'Ranch', 'Gardens', 'Orchard', 'Pastures'];
        
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }
    
    generateForestName() {
        const prefixes = ['Whispering', 'Ancient', 'Dark', 'Misty', 'Shadow', 'Elder', 'Wild', 'Emerald'];
        const suffixes = ['Woods', 'Forest', 'Grove', 'Thicket', 'Wilds', 'Timberland', 'Copse', 'Woodland'];
        
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }
    
    getZoneAtPosition(position) {
        for (const zone of this.zones) {
            const distance = position.distanceTo(zone.position);
            if (distance < zone.radius) {
                return zone;
            }
        }
        return null;
    }
    
    drawWorldMap() {
        const mapElement = document.getElementById('world-map');
        mapElement.innerHTML = '';
        
        // Create SVG for the map
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", `-${this.worldSize/2} -${this.worldSize/2} ${this.worldSize} ${this.worldSize}`);
        
        // Add zones
        for (const zone of this.zones) {
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("cx", zone.position.x);
            circle.setAttribute("cy", zone.position.z);
            circle.setAttribute("r", zone.radius);
            
            switch(zone.type) {
                case 'city':
                    circle.setAttribute("fill", "#e6b800");
                    break;
                case 'farm':
                    circle.setAttribute("fill", "#55aa55");
                    break;
                case 'forest':
                    circle.setAttribute("fill", "#006622");
                    break;
                case 'spawn':
                    circle.setAttribute("fill", "#aa3939");
                    break;
                default:
                    circle.setAttribute("fill", "#888");
            }
            
            circle.setAttribute("opacity", "0.7");
            
            // Add tooltip
            const title = document.createElementNS(svgNS, "title");
            title.textContent = zone.name;
            circle.appendChild(title);
            
            svg.appendChild(circle);
        }
        
        // Add player marker
        const playerMarker = document.createElementNS(svgNS, "circle");
        playerMarker.setAttribute("id", "player-marker");
        playerMarker.setAttribute("cx", this.game.state.playerData.position.x);
        playerMarker.setAttribute("cy", this.game.state.playerData.position.z);
        playerMarker.setAttribute("r", "5");
        playerMarker.setAttribute("fill", "#ff4d4d");
        svg.appendChild(playerMarker);
        
        // Add map to DOM
        mapElement.appendChild(svg);
    }
    
    updateChunks() {
        // Get current chunk coordinates
        const playerPos = this.game.state.playerData.position;
        const chunkX = Math.floor(playerPos.x / this.chunkSize);
        const chunkZ = Math.floor(playerPos.z / this.chunkSize);
        
        // Determine which chunks should be loaded
        const chunksToLoad = [];
        for (let x = chunkX - this.renderDistance; x <= chunkX + this.renderDistance; x++) {
            for (let z = chunkZ - this.renderDistance; z <= chunkZ + this.renderDistance; z++) {
                const key = `${x},${z}`;
                chunksToLoad.push(key);
                
                // Load chunk if not already loaded
                if (!this.chunks.has(key)) {
                    this.loadChunk(x, z);
                }
            }
        }
        
        // Unload chunks that are too far
        for (const key of this.chunks.keys()) {
            if (!chunksToLoad.includes(key)) {
                this.unloadChunk(key);
            }
        }
        
        // Update loaded chunks array
        this.loadedChunks = chunksToLoad;
        
        // Update minimap
        this.updateMinimap(playerPos);
    }
    
    loadChunk(x, z) {
        const key = `${x},${z}`;
        
        // Create a chunk container
        const chunk = new THREE.Group();
        chunk.position.set(x * this.chunkSize, 0, z * this.chunkSize);
        
        // Populate chunk with objects based on zone
        this.populateChunk(chunk, x, z);
        
        // Add chunk to scene
        this.game.scene.add(chunk);
        this.chunks.set(key, chunk);
    }
    
    unloadChunk(key) {
        const chunk = this.chunks.get(key);
        if (chunk) {
            this.game.scene.remove(chunk);
            this.chunks.delete(key);
        }
    }
    
    populateChunk(chunk, chunkX, chunkZ) {
        // Get world position of chunk center
        const centerX = chunkX * this.chunkSize + this.chunkSize / 2;
        const centerZ = chunkZ * this.chunkSize + this.chunkSize / 2;
        
        // Check if chunk is in a special zone
        const chunkPos = new THREE.Vector3(centerX, 0, centerZ);
        const zone = this.getZoneAtPosition(chunkPos);
        
        if (zone) {
            switch (zone.type) {
                case 'city':
                    this.populateCity(chunk, chunkX, chunkZ, zone);
                    break;
                case 'farm':
                    this.populateFarm(chunk, chunkX, chunkZ, zone);
                    break;
                case 'forest':
                    this.populateForest(chunk, chunkX, chunkZ, zone);
                    break;
                case 'spawn':
                    this.populateSpawn(chunk, chunkX, chunkZ, zone);
                    break;
            }
        } else {
            // Generate wilderness
            this.populateWilderness(chunk, chunkX, chunkZ);
        }
    }
    
    populateCity(chunk, chunkX, chunkZ, zone) {
        // Simple placeholder for city buildings
        for (let i = 0; i < 5; i++) {
            const buildingHeight = 1 + Math.random() * 3;
            const buildingWidth = 1 + Math.random() * 2;
            const buildingDepth = 1 + Math.random() * 2;
            
            const geometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
            const material = new THREE.MeshStandardMaterial({ color: 0xdddddd });
            const building = new THREE.Mesh(geometry, material);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            building.position.set(posX, posY + buildingHeight / 2, posZ);
            building.castShadow = true;
            building.receiveShadow = true;
            
            // Make buildings interactable
            building.userData = {
                interactable: true,
                type: 'building',
                interact: (player) => {
                    this.game.ui.showNotification(`Entered ${zone.name} building`);
                    // TODO: Handle building entry
                }
            };
            
            this.interactables.push(building);
            chunk.add(building);
        }
    }
    
    populateFarm(chunk, chunkX, chunkZ, zone) {
        // Create farmland
        const fieldSize = 10;
        const geometry = new THREE.PlaneGeometry(fieldSize, fieldSize, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const field = new THREE.Mesh(geometry, material);
        
        field.rotation.x = -Math.PI / 2;
        field.position.set(0, 0.01, 0); // Slightly above ground to prevent z-fighting
        field.receiveShadow = true;
        
        chunk.add(field);
        
        // Add crops
        for (let i = 0; i < 30; i++) {
            const cropGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
            const cropMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90 });
            const crop = new THREE.Mesh(cropGeometry, cropMaterial);
            
            const offsetX = (Math.random() - 0.5) * fieldSize;
            const offsetZ = (Math.random() - 0.5) * fieldSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            crop.position.set(posX, posY + 0.25, posZ);
            crop.castShadow = true;
            
            // Make crops interactable (collectible food)
            crop.userData = {
                interactable: true,
                type: 'crop',
                interact: (player) => {
                    this.game.ui.showNotification('Harvested food');
                    this.game.state.playerData.hunger = Math.min(
                        this.game.state.playerData.maxHunger,
                        this.game.state.playerData.hunger + 20
                    );
                    this.game.ui.updateHungerBar();
                    chunk.remove(crop);
                }
            };
            
            this.interactables.push(crop);
            chunk.add(crop);
        }
        
        // Add a farmhouse
        const houseGeometry = new THREE.BoxGeometry(4, 2, 3);
        const houseMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D });
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        
        house.position.set(0, 1, 0);
        house.castShadow = true;
        house.receiveShadow = true;
        
        // Make house interactable
        house.userData = {
            interactable: true,
            type: 'building',
            interact: (player) => {
                this.game.ui.showNotification(`Entered farmhouse at ${zone.name}`);
                // TODO: Handle farmhouse entry
            }
        };
        
        this.interactables.push(house);
        chunk.add(house);
    }
    
    populateForest(chunk, chunkX, chunkZ, zone) {
        // Add trees
        for (let i = 0; i < 15; i++) {
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            
            // Tree leaves
            const leavesGeometry = new THREE.ConeGeometry(1, 2, 8);
            const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 2;
            
            // Create tree group
            const tree = new THREE.Group();
            tree.add(trunk);
            tree.add(leaves);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            tree.position.set(posX, posY, posZ);
            tree.castShadow = true;
            
            chunk.add(tree);
        }
        
        // Add bushes with berries (food source)
        for (let i = 0; i < 8; i++) {
            const bushGeometry = new THREE.SphereGeometry(0.5, 8, 6);
            const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
            const bush = new THREE.Mesh(bushGeometry, bushMaterial);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            bush.position.set(posX, posY + 0.25, posZ);
            bush.castShadow = true;
            
            // Add berries
            const berryGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const berryMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
            
            for (let j = 0; j < 5; j++) {
                const berry = new THREE.Mesh(berryGeometry, berryMaterial);
                const angle = Math.random() * Math.PI * 2;
                const radius = 0.3 + Math.random() * 0.2;
                berry.position.set(
                    Math.cos(angle) * radius,
                    0.3 + Math.random() * 0.2,
                    Math.sin(angle) * radius
                );
                bush.add(berry);
            }
            
            // Make bush interactable (collectible food)
            bush.userData = {
                interactable: true,
                type: 'food',
                interact: (player) => {
                    this.game.ui.showNotification('Collected berries');
                    this.game.state.playerData.hunger = Math.min(
                        this.game.state.playerData.maxHunger,
                        this.game.state.playerData.hunger + 15
                    );
                    this.game.ui.updateHungerBar();
                    chunk.remove(bush);
                }
            };
            
            this.interactables.push(bush);
            chunk.add(bush);
        }
    }
    
    populateSpawn(chunk, chunkX, chunkZ, zone) {
        // Create rat hole entrance
        const holeGeometry = new THREE.CircleGeometry(1, 32);
        const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        
        hole.rotation.x = -Math.PI / 2;
        hole.position.set(0, 0.01, 0);
        
        chunk.add(hole);
        
        // Add some tutorial elements
        const signGeometry = new THREE.BoxGeometry(1, 1, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        
        sign.position.set(2, 0.5, 0);
        sign.rotation.y = -Math.PI / 4;
        sign.castShadow = true;
        
        // Make sign interactable
        sign.userData = {
            interactable: true,
            type: 'sign',
            interact: (player) => {
                this.game.ui.showNotification('Welcome to Rat Quest! Use WASD to move, Space to jump, E to interact.');
            }
        };
        
        this.interactables.push(sign);
        chunk.add(sign);
    }
    
    populateWilderness(chunk, chunkX, chunkZ) {
        // Add some rocks
        for (let i = 0; i < 3; i++) {
            const rockGeometry = new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 6, 6);
            const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            rock.position.set(posX, posY, posZ);
            rock.scale.y = 0.5 + Math.random() * 0.5;
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.castShadow = true;
            rock.receiveShadow = true;
            
            chunk.add(rock);
        }
        
        // Small chance to spawn a treasure or item
        if (Math.random() < 0.2) {
            this.spawnItem(chunk, chunkX, chunkZ);
        }
    }
    
    spawnItem(chunk, chunkX, chunkZ) {
        const itemTypes = [
            { id: 'cheese', name: 'Cheese', type: 'food', value: 5, color: 0xFFD700 },
            { id: 'coin', name: 'Gold Coin', type: 'treasure', value: 1, color: 0xFFD700 },
            { id: 'gem', name: 'Gem', type: 'treasure', value: 10, color: 0x00FFFF }
        ];
        
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        
        let geometry;
        if (itemType.id === 'cheese') {
            geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
        } else if (itemType.id === 'coin') {
            geometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
        } else {
            geometry = new THREE.OctahedronGeometry(0.2, 0);
        }
        
        const material = new THREE.MeshStandardMaterial({ color: itemType.color });
        const item = new THREE.Mesh(geometry, material);
        
        const offsetX = (Math.random() - 0.5) * this.chunkSize;
        const offsetZ = (Math.random() - 0.5) * this.chunkSize;
        
        const posX = offsetX;
        const posZ = offsetZ;
        const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
        
        item.position.set(posX, posY + 0.1, posZ);
        item.castShadow = true;
        
        // Add item properties
        item.id = itemType.id;
        item.name = itemType.name;
        item.type = itemType.type;
        item.value = itemType.value;
        
        // Make it slightly rotate and hover
        item.userData.baseY = posY + 0.1;
        item.userData.hoverOffset = 0;
        item.userData.rotateSpeed = 0.5 + Math.random() * 0.5;
        
        this.items.push(item);
        chunk.add(item);
    }
    
    updateMinimap(playerPos) {
        const minimapCtx = this.getMinimapContext();
        if (!minimapCtx) return;
        
        // Clear minimap
        minimapCtx.clearRect(0, 0, 200, 200);
        
        // Draw background
        minimapCtx.fillStyle = '#111';
        minimapCtx.fillRect(0, 0, 200, 200);
        
        // Set transform to center on player
        minimapCtx.save();
        minimapCtx.translate(100, 100);
        
        // Draw nearby zones
        for (const zone of this.zones) {
            const dx = zone.position.x - playerPos.x;
            const dz = zone.position.z - playerPos.z;
            
            // Only display zones within minimap range (100 units)
            if (Math.abs(dx) < 100 && Math.abs(dz) < 100) {
                minimapCtx.beginPath();
                
                switch(zone.type) {
                    case 'city':
                        minimapCtx.fillStyle = '#e6b800';
                        break;
                    case 'farm':
                        minimapCtx.fillStyle = '#55aa55';
                        break;
                    case 'forest':
                        minimapCtx.fillStyle = '#006622';
                        break;
                    case 'spawn':
                        minimapCtx.fillStyle = '#aa3939';
                        break;
                    default:
                        minimapCtx.fillStyle = '#888';
                }
                
                // Scale radius for minimap
                const radius = zone.radius / 2;
                minimapCtx.arc(dx, dz, radius, 0, Math.PI * 2);
                minimapCtx.fill();
            }
        }
        
        // Draw player
        minimapCtx.fillStyle = '#ff4d4d';
        minimapCtx.beginPath();
        minimapCtx.arc(0, 0, 3, 0, Math.PI * 2);
        minimapCtx.fill();
        
        // Draw player direction
        minimapCtx.strokeStyle = '#ff4d4d';
        minimapCtx.lineWidth = 2;
        minimapCtx.beginPath();
        minimapCtx.moveTo(0, 0);
        
        const dirX = Math.sin(this.game.state.playerData.rotation) * 8;
        const dirZ = Math.cos(this.game.state.playerData.rotation) * 8;
        minimapCtx.lineTo(dirX, dirZ);
        minimapCtx.stroke();
        
        minimapCtx.restore();
    }
    
    getMinimapContext() {
        const minimap = document.getElementById('minimap');
        if (!minimap) return null;
        
        let canvas = minimap.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            minimap.appendChild(canvas);
        }
        
        return canvas.getContext('2d');
    }
    
    update(deltaTime) {
        // Update chunks if player moved enough
        const playerPos = this.game.state.playerData.position;
        const chunkX = Math.floor(playerPos.x / this.chunkSize);
        const chunkZ = Math.floor(playerPos.z / this.chunkSize);
        const chunkKey = `${chunkX},${chunkZ}`;
        
        if (!this.lastChunkKey || this.lastChunkKey !== chunkKey) {
            this.updateChunks();
            this.lastChunkKey = chunkKey;
        }
        
        // Update minimap
        this.updateMinimap(playerPos);
        
        // Update world map player position if open
        const playerMarker = document.getElementById('player-marker');
        if (playerMarker) {
            playerMarker.setAttribute("cx", playerPos.x);
            playerMarker.setAttribute("cy", playerPos.z);
        }
        
        // Animate items
        for (const item of this.items) {
            item.rotation.y += item.userData.rotateSpeed * deltaTime;
            
            item.userData.hoverOffset += deltaTime * 2;
            item.position.y = item.userData.baseY + Math.sin(item.userData.hoverOffset) * 0.1;
        }
    }
}

export { World };

