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
        
        // Define scale factor for the world (rat perspective)
        this.RAT_SCALE = 20; // Everything will be scaled up to make the rat seem small
        
        // Texture maps for different terrain types
        this.terrainTextures = {
            grass: null,
            dirt: null,
            sand: null,
            stone: null,
            water: null
        };
        
        // Initialize terrain textures
        this.initTerrainTextures();
    }
    
    initTerrainTextures() {
        const textureLoader = new THREE.TextureLoader();
        
        // Create procedural textures
        // For grass
        const grassCanvas = document.createElement('canvas');
        grassCanvas.width = 512;
        grassCanvas.height = 512;
        const grassCtx = grassCanvas.getContext('2d');
        grassCtx.fillStyle = '#4CAF50';
        grassCtx.fillRect(0, 0, 512, 512);
        // Add some texture variation
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = 1 + Math.random() * 2;
            grassCtx.fillStyle = Math.random() > 0.5 ? '#3B8F3D' : '#5CBF60';
            grassCtx.fillRect(x, y, size, size);
        }
        this.terrainTextures.grass = new THREE.CanvasTexture(grassCanvas);
        this.terrainTextures.grass.wrapS = THREE.RepeatWrapping;
        this.terrainTextures.grass.wrapT = THREE.RepeatWrapping;
        this.terrainTextures.grass.repeat.set(32, 32);
        
        // For dirt
        const dirtCanvas = document.createElement('canvas');
        dirtCanvas.width = 512;
        dirtCanvas.height = 512;
        const dirtCtx = dirtCanvas.getContext('2d');
        dirtCtx.fillStyle = '#8B4513';
        dirtCtx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = 1 + Math.random() * 3;
            dirtCtx.fillStyle = Math.random() > 0.5 ? '#6B3313' : '#9B5523';
            dirtCtx.fillRect(x, y, size, size);
        }
        this.terrainTextures.dirt = new THREE.CanvasTexture(dirtCanvas);
        this.terrainTextures.dirt.wrapS = THREE.RepeatWrapping;
        this.terrainTextures.dirt.wrapT = THREE.RepeatWrapping;
        this.terrainTextures.dirt.repeat.set(32, 32);
    }
    
    generateWorld() {
        // Create skybox
        this.createSkybox();
        
        // Create terrain
        this.createTerrain();
        
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
    
    createTerrain() {
        // Create a heightmap-based terrain
        const resolution = 256; // Higher resolution for more detailed terrain
        const size = 2000;
        const heightMapResolution = 256;
        
        // Generate heightmap
        const heightMap = this.generateHeightMap(heightMapResolution);
        
        // Create geometry
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        
        // Apply heightmap to geometry
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Get height from noise function
            vertices[i + 1] = this.getHeightAt(x, z);
        }
        
        // Update normals for proper lighting
        geometry.computeVertexNormals();
        
        // Create material with blended textures
        const material = new THREE.MeshStandardMaterial({
            map: this.terrainTextures.grass,
            roughness: 0.8,
            metalness: 0.1,
            vertexColors: true
        });
        
        // Create mesh
        const terrain = new THREE.Mesh(geometry, material);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        this.terrain = terrain;
        
        // Add vertex colors based on height
        if (geometry.hasAttribute('color')) {
            const colors = geometry.attributes.color.array;
            
            for (let i = 0, j = 0; i < vertices.length; i += 3, j += 3) {
                const height = vertices[i + 1];
                
                if (height < -3) {
                    // Water
                    colors[j] = 0.1;
                    colors[j + 1] = 0.5;
                    colors[j + 2] = 0.8;
                } else if (height < 0) {
                    // Sand
                    colors[j] = 0.95;
                    colors[j + 1] = 0.9;
                    colors[j + 2] = 0.6;
                } else if (height < 5) {
                    // Grass
                    colors[j] = 0.3;
                    colors[j + 1] = 0.7;
                    colors[j + 2] = 0.3;
                } else if (height < 12) {
                    // Dirt/Rock
                    colors[j] = 0.5;
                    colors[j + 1] = 0.4;
                    colors[j + 2] = 0.3;
                } else {
                    // Snow
                    const t = Math.min((height - 12) / 8, 1);
                    colors[j] = 0.5 * (1 - t) + 0.9 * t;
                    colors[j + 1] = 0.4 * (1 - t) + 0.9 * t;
                    colors[j + 2] = 0.3 * (1 - t) + 0.9 * t;
                }
            }
        } else {
            // If no color attribute exists, create it
            const colors = new Float32Array(vertices.length);
            
            for (let i = 0, j = 0; i < vertices.length; i += 3, j += 3) {
                const height = vertices[i + 1];
                
                if (height < -3) {
                    // Water
                    colors[j] = 0.1;
                    colors[j + 1] = 0.5;
                    colors[j + 2] = 0.8;
                } else if (height < 0) {
                    // Sand
                    colors[j] = 0.95;
                    colors[j + 1] = 0.9;
                    colors[j + 2] = 0.6;
                } else if (height < 5) {
                    // Grass
                    colors[j] = 0.3;
                    colors[j + 1] = 0.7;
                    colors[j + 2] = 0.3;
                } else if (height < 12) {
                    // Dirt/Rock
                    colors[j] = 0.5;
                    colors[j + 1] = 0.4;
                    colors[j + 2] = 0.3;
                } else {
                    // Snow
                    const t = Math.min((height - 12) / 8, 1);
                    colors[j] = 0.5 * (1 - t) + 0.9 * t;
                    colors[j + 1] = 0.4 * (1 - t) + 0.9 * t;
                    colors[j + 2] = 0.3 * (1 - t) + 0.9 * t;
                }
            }
            
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        
        this.game.scene.add(terrain);
        
        // Add water plane
        const waterGeometry = new THREE.PlaneGeometry(size, size);
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x1976D2,
            transparent: true,
            opacity: 0.7,
            roughness: 0.1,
            metalness: 0.3
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -3;
        this.game.scene.add(water);
    }
    
    generateHeightMap(resolution) {
        const heightMap = new Float32Array(resolution * resolution);
        
        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const index = z * resolution + x;
                const nx = x / resolution - 0.5;
                const nz = z / resolution - 0.5;
                
                heightMap[index] = this.getHeightAt(nx * 2000, nz * 2000);
            }
        }
        
        return heightMap;
    }
    
    getHeightAt(x, z) {
        // Large scale terrain variation - mountains and valleys
        const largeScale = this.simplex.noise(x * 0.0005, z * 0.0005) * 30;
        
        // Medium scale details - hills and dips
        const mediumScale = this.simplex.noise(x * 0.002, z * 0.002) * 10;
        
        // Small scale details - bumps and texture
        const smallScale = this.simplex.noise(x * 0.01, z * 0.01) * 2;
        
        // Micro details - very small bumps for texture
        const microScale = this.simplex.noise(x * 0.05, z * 0.05) * 0.5;
        
        return largeScale + mediumScale + smallScale + microScale;
    }
    
    populateCity(chunk, chunkX, chunkZ, zone) {
        const ratScale = this.RAT_SCALE;
        
        // Rats are small, so buildings should be much larger
        for (let i = 0; i < 5; i++) {
            const buildingHeight = (2 + Math.random() * 5) * ratScale;
            const buildingWidth = (2 + Math.random() * 3) * ratScale;
            const buildingDepth = (2 + Math.random() * 3) * ratScale;
            
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
            
            // Add doors and windows
            this.addBuildingDetails(building, buildingWidth, buildingHeight, buildingDepth);
            
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
        
        // Add roads
        this.addRoads(chunk, chunkX, chunkZ);
    }
    
    addBuildingDetails(building, width, height, depth) {
        // Add door
        const doorWidth = 0.7 * this.RAT_SCALE;
        const doorHeight = 1.2 * this.RAT_SCALE;
        const doorDepth = 0.1 * this.RAT_SCALE;
        
        const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        
        door.position.set(0, -height/2 + doorHeight/2, depth/2 + 0.01);
        building.add(door);
        
        // Add windows
        const windowSize = 0.8 * this.RAT_SCALE;
        const windowDepth = 0.1 * this.RAT_SCALE;
        const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, windowDepth);
        const windowMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x87CEEB,
            transparent: true,
            opacity: 0.7
        });
        
        // Add several windows
        const windowRows = Math.floor(height / (windowSize * 2));
        const windowColsPerSide = Math.floor(width / (windowSize * 2));
        
        for (let row = 0; row < windowRows; row++) {
            const y = -height/2 + (row + 1) * height / (windowRows + 1);
            
            // Front windows
            for (let col = 0; col < windowColsPerSide; col++) {
                const x = -width/2 + (col + 1) * width / (windowColsPerSide + 1);
                
                const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                frontWindow.position.set(x, y, depth/2 + 0.01);
                building.add(frontWindow);
                
                const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                backWindow.position.set(x, y, -depth/2 - 0.01);
                building.add(backWindow);
            }
            
            // Side windows
            const sideWindowCount = Math.floor(depth / (windowSize * 2));
            for (let col = 0; col < sideWindowCount; col++) {
                const z = -depth/2 + (col + 1) * depth / (sideWindowCount + 1);
                
                const leftWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                leftWindow.position.set(-width/2 - 0.01, y, z);
                leftWindow.rotation.y = Math.PI / 2;
                building.add(leftWindow);
                
                const rightWindow = new THREE.Mesh(windowGeometry, windowMaterial);
                rightWindow.position.set(width/2 + 0.01, y, z);
                rightWindow.rotation.y = Math.PI / 2;
                building.add(rightWindow);
            }
        }
    }
    
    addRoads(chunk, chunkX, chunkZ) {
        const roadWidth = 5 * this.RAT_SCALE;
        const roadGeometry = new THREE.PlaneGeometry(this.chunkSize, roadWidth);
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.9
        });
        
        // East-West road
        const eastWestRoad = new THREE.Mesh(roadGeometry, roadMaterial);
        eastWestRoad.rotation.x = -Math.PI / 2;
        eastWestRoad.position.y = 0.05; // Slightly above ground
        chunk.add(eastWestRoad);
        
        // North-South road
        const northSouthRoad = new THREE.Mesh(roadGeometry, roadMaterial);
        northSouthRoad.rotation.x = -Math.PI / 2;
        northSouthRoad.rotation.z = Math.PI / 2;
        northSouthRoad.position.y = 0.05;
        chunk.add(northSouthRoad);
    }
    
    populateFarm(chunk, chunkX, chunkZ, zone) {
        const ratScale = this.RAT_SCALE;
        
        // Create farmland
        const fieldSize = 15 * ratScale;
        const geometry = new THREE.PlaneGeometry(fieldSize, fieldSize, 10, 10);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9
        });
        
        // Create a grid pattern for crops
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Create furrows pattern
            vertices[i + 1] = 0.2 * Math.sin(x * 0.5) + 0.1 * Math.cos(z * 0.7);
        }
        geometry.computeVertexNormals();
        
        const field = new THREE.Mesh(geometry, material);
        field.rotation.x = -Math.PI / 2;
        field.position.y = 0.05; // Slightly above ground
        field.receiveShadow = true;
        
        chunk.add(field);
        
        // Add crops in orderly rows
        const cropRows = 10;
        const cropsPerRow = 10;
        const cropSpacing = fieldSize / cropRows;
        
        for (let row = 0; row < cropRows; row++) {
            for (let col = 0; col < cropsPerRow; col++) {
                // Skip some crops to create variation
                if (Math.random() < 0.2) continue;
                
                const cropHeight = (0.5 + Math.random() * 0.5) * ratScale;
                const cropGeometry = new THREE.CylinderGeometry(0.1 * ratScale, 0.1 * ratScale, cropHeight, 8);
                const cropMaterial = new THREE.MeshStandardMaterial({ color: 0x90EE90 });
                const crop = new THREE.Mesh(cropGeometry, cropMaterial);
                
                const posX = -fieldSize/2 + (row + 0.5) * cropSpacing;
                const posZ = -fieldSize/2 + (col + 0.5) * cropSpacing;
                const posY = this.getHeightAt(chunkX * this.chunkSize + posX, chunkZ * this.chunkSize + posZ);
                
                crop.position.set(posX, posY + cropHeight/2, posZ);
                crop.castShadow = true;
                
                // Add some variation in rotation
                crop.rotation.x = (Math.random() - 0.5) * 0.2;
                crop.rotation.z = (Math.random() - 0.5) * 0.2;
                
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
        }
        
        // Add a farmhouse
        const houseWidth = 8 * ratScale;
        const houseHeight = 5 * ratScale;
        const houseDepth = 6 * ratScale;
        
        const houseGeometry = new THREE.BoxGeometry(houseWidth, houseHeight, houseDepth);
        const houseMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D });
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        
        house.position.set(0, houseHeight/2, 0);
        house.castShadow = true;
        house.receiveShadow = true;
        
        // Add roof
        const roofGeometry = new THREE.ConeGeometry(houseWidth * 0.7, houseHeight * 0.5, 4);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        
        roof.position.set(0, houseHeight + houseHeight * 0.25, 0);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        
        // Add house details
        this.addBuildingDetails(house, houseWidth, houseHeight, houseDepth);
        
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
        chunk.add(roof);
    }
    
    populateForest(chunk, chunkX, chunkZ, zone) {
        const ratScale = this.RAT_SCALE;
        
        // Add trees
        for (let i = 0; i < 15; i++) {
            const treeHeight = (4 + Math.random() * 6) * ratScale;
            
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(
                0.3 * ratScale, 
                0.4 * ratScale, 
                treeHeight * 0.7, 
                8
            );
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            
            // Tree leaves
            const leavesGeometry = new THREE.ConeGeometry(
                treeHeight * 0.4, 
                treeHeight * 0.6, 
                8
            );
            const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = treeHeight * 0.65;
            
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
            const bushSize = (0.8 + Math.random() * 0.4) * ratScale;
            const bushGeometry = new THREE.SphereGeometry(bushSize, 8, 6);
            const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
            const bush = new THREE.Mesh(bushGeometry, bushMaterial);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            bush.position.set(posX, posY + bushSize * 0.8, posZ);
            bush.castShadow = true;
            
            // Add berries
            const berrySize = 0.1 * ratScale;
            const berryGeometry = new THREE.SphereGeometry(berrySize, 8, 8);
            const berryMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
            
            for (let j = 0; j < 10; j++) {
                const berry = new THREE.Mesh(berryGeometry, berryMaterial);
                const angle = Math.random() * Math.PI * 2;
                const radius = bushSize * 0.8;
                berry.position.set(
                    Math.cos(angle) * radius,
                    (Math.random() - 0.3) * bushSize,
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
        
        // Add fallen logs and mushrooms
        for (let i = 0; i < 3; i++) {
            const logLength = (2 + Math.random() * 3) * ratScale;
            const logRadius = 0.3 * ratScale;
            
            const logGeometry = new THREE.CylinderGeometry(logRadius, logRadius, logLength, 8);
            const logMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const log = new THREE.Mesh(logGeometry, logMaterial);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            log.position.set(posX, posY + logRadius, posZ);
            log.rotation.z = Math.random() * 0.3;
            log.rotation.y = Math.random() * Math.PI;
            log.castShadow = true;
            log.receiveShadow = true;
            
            chunk.add(log);
            
            // Add mushrooms on log
            for (let j = 0; j < 5; j++) {
                const mushroomSize = (0.1 + Math.random() * 0.15) * ratScale;
                
                const stemGeometry = new THREE.CylinderGeometry(
                    mushroomSize * 0.2, 
                    mushroomSize * 0.3, 
                    mushroomSize * 2, 
                    8
                );
                const capGeometry = new THREE.SphereGeometry(mushroomSize, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
                
                const stemMaterial = new THREE.MeshStandardMaterial({ color: 0xEEEEEE });
                const capMaterial = new THREE.MeshStandardMaterial({ color: 0xFF5555 });
                
                const stem = new THREE.Mesh(stemGeometry, stemMaterial);
                const cap = new THREE.Mesh(capGeometry, capMaterial);
                
                cap.position.y = mushroomSize;
                
                const mushroom = new THREE.Group();
                mushroom.add(stem);
                mushroom.add(cap);
                
                // Position mushroom along log
                const logPosition = (Math.random() - 0.5) * logLength * 0.8;
                const angle = Math.random() * Math.PI * 2;
                
                mushroom.position.set(
                    logPosition,
                    logRadius,
                    0
                );
                
                // Match log rotation but keep mushroom upright
                mushroom.rotation.z = -log.rotation.z;
                mushroom.rotation.y = angle;
                
                log.add(mushroom);
            }
        }
    }
    
    populateSpawn(chunk, chunkX, chunkZ, zone) {
        const ratScale = this.RAT_SCALE;
        
        // Create rat hole entrance
        const holeGeometry = new THREE.CircleGeometry(1 * ratScale, 32);
        const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const hole = new THREE.Mesh(holeGeometry, holeMaterial);
        
        hole.rotation.x = -Math.PI / 2;
        hole.position.y = 0.01;
        
        chunk.add(hole);
        
        // Add tunnel mouth around the hole
        const tunnelGeometry = new THREE.TorusGeometry(1 * ratScale, 0.3 * ratScale, 16, 32, Math.PI);
        const tunnelMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const tunnel = new THREE.Mesh(tunnelGeometry, tunnelMaterial);
        
        tunnel.rotation.x = Math.PI / 2;
        tunnel.position.y = 0.01;
        tunnel.position.z = -1 * ratScale;
        
        chunk.add(tunnel);
        
        // Add tutorial elements
        const signHeight = 1.5 * ratScale;
        const signWidth = 2 * ratScale;
        
        const postGeometry = new THREE.CylinderGeometry(0.1 * ratScale, 0.1 * ratScale, signHeight, 8);
        const signboardGeometry = new THREE.BoxGeometry(signWidth, signWidth * 0.7, 0.1 * ratScale);
        
        const woodMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D });
        
        const post = new THREE.Mesh(postGeometry, woodMaterial);
        post.position.set(2 * ratScale, signHeight / 2, 0);
        
        const signboard = new THREE.Mesh(signboardGeometry, woodMaterial);
        signboard.position.set(0, signHeight * 0.8, 0);
        signboard.rotation.y = -Math.PI / 4;
        
        const sign = new THREE.Group();
        sign.add(post);
        sign.add(signboard);
        sign.castShadow = true;
        
        // Add text texture to sign
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(0, 0, 256, 128);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Welcome to Rat Quest!', 128, 30);
        ctx.font = '18px Arial';
        ctx.fillText('WASD to move', 128, 60);
        ctx.fillText('E to interact', 128, 90);
        
        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshBasicMaterial({ map: texture });
        
        const textPlane = new THREE.PlaneGeometry(signWidth * 0.9, signWidth * 0.6);
        const textMesh = new THREE.Mesh(textPlane, textMaterial);
        textMesh.position.z = 0.06 * ratScale;
        
        signboard.add(textMesh);
        
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
        const ratScale = this.RAT_SCALE;
        
        // Add some rocks
        for (let i = 0; i < 5; i++) {
            const rockSize = (0.5 + Math.random() * 1.5) * ratScale;
            const rockGeometry = new THREE.DodecahedronGeometry(rockSize, 1);
            const rockMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x808080,
                roughness: 0.9
            });
            
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            rock.position.set(posX, posY, posZ);
            // Add random rotation and scale distortion for natural look
            rock.rotation.x = Math.random() * Math.PI;
            rock.rotation.y = Math.random() * Math.PI;
            rock.rotation.z = Math.random() * Math.PI;
            rock.scale.x = 0.8 + Math.random() * 0.4;
            rock.scale.y = 0.8 + Math.random() * 0.4;
            rock.scale.z = 0.8 + Math.random() * 0.4;
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            
            chunk.add(rock);
        }
        
        // Add grass clumps
        for (let i = 0; i < 15; i++) {
            const grassGeometry = new THREE.PlaneGeometry(ratScale, ratScale);
            const grassMaterial = new THREE.MeshStandardMaterial({
                color: 0x4CAF50,
                transparent: true,
                alphaTest: 0.5,
                side: THREE.DoubleSide
            });
            
            // Create cross-shaped grass clump
            const grassClump = new THREE.Group();
            
            for (let j = 0; j < 3; j++) {
                const blade = new THREE.Mesh(grassGeometry, grassMaterial);
                blade.rotation.y = j * Math.PI / 3;
                grassClump.add(blade);
            }
            
            const offsetX = (Math.random() - 0.5) * this.chunkSize;
            const offsetZ = (Math.random() - 0.5) * this.chunkSize;
            
            const posX = offsetX;
            const posZ = offsetZ;
            const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
            
            grassClump.position.set(posX, posY, posZ);
            grassClump.scale.set(0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.6);
            
            chunk.add(grassClump);
        }
        
        // Small chance to spawn a treasure or item
        if (Math.random() < 0.3) {
            this.spawnItem(chunk, chunkX, chunkZ);
        }
    }
    
    spawnItem(chunk, chunkX, chunkZ) {
        const ratScale = this.RAT_SCALE;
        
        const itemTypes = [
            { id: 'cheese', name: 'Cheese', type: 'food', value: 5, color: 0xFFD700 },
            { id: 'coin', name: 'Gold Coin', type: 'treasure', value: 1, color: 0xFFD700 },
            { id: 'gem', name: 'Gem', type: 'treasure', value: 10, color: 0x00FFFF }
        ];
        
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        
        let geometry;
        if (itemType.id === 'cheese') {
            // Create a wedge shape for cheese
            geometry = new THREE.CylinderGeometry(
                0.3 * ratScale, 
                0.3 * ratScale, 
                0.2 * ratScale, 
                8, 
                1, 
                false, 
                0, 
                Math.PI * 1.5
            );
        } else if (itemType.id === 'coin') {
            geometry = new THREE.CylinderGeometry(
                0.2 * ratScale, 
                0.2 * ratScale, 
                0.05 * ratScale, 
                16
            );
        } else {
            geometry = new THREE.OctahedronGeometry(0.15 * ratScale, 0);
        }
        
        const material = new THREE.MeshStandardMaterial({ 
            color: itemType.color,
            metalness: itemType.id === 'coin' ? 0.8 : 0.2,
            roughness: itemType.id === 'gem' ? 0.1 : 0.7
        });
        const item = new THREE.Mesh(geometry, material);
        
        const offsetX = (Math.random() - 0.5) * this.chunkSize;
        const offsetZ = (Math.random() - 0.5) * this.chunkSize;
        
        const posX = offsetX;
        const posZ = offsetZ;
        const posY = this.getHeightAt(chunkX * this.chunkSize + offsetX, chunkZ * this.chunkSize + offsetZ);
        
        item.position.set(posX, posY + 0.1 * ratScale, posZ);
        item.castShadow = true;
        
        // Store item properties in userData instead of directly on the mesh
        item.userData = {
            itemId: itemType.id,
            itemName: itemType.name,
            itemType: itemType.type,
            itemValue: itemType.value,
            baseY: posY + 0.1 * ratScale,
            hoverOffset: Math.random() * Math.PI * 2,
            rotateSpeed: 0.5 + Math.random() * 0.5
        };
        
        this.items.push(item);
        chunk.add(item);
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
    
    getZoneAtPosition(position) {
        for (const zone of this.zones) {
            const distance = position.distanceTo(zone.position);
            if (distance < zone.radius) {
                return zone;
            }
        }
        return null;
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