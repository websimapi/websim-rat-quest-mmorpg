import * as THREE from 'three';

class Player {
    constructor(game) {
        this.game = game;
        this.moveSpeed = 5;
        this.turnSpeed = 2;
        this.jumpForce = 5;
        this.gravity = 20;
        
        this.velocity = new THREE.Vector3();
        this.isJumping = false;
        this.isGrounded = false;
        
        this.controls = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            action: false
        };
        
        this.setupInputs();
        this.createPlayerModel();
    }
    
    createPlayerModel() {
        // Create a simple placeholder rat model
        const ratGroup = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.z = Math.PI / 2;
        body.castShadow = true;
        ratGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.2, 16, 12);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0.4, 0.1, 0);
        head.castShadow = true;
        ratGroup.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.5, 0.15, 0.12);
        ratGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.5, 0.15, -0.12);
        ratGroup.add(rightEye);
        
        // Ears
        const earGeometry = new THREE.ConeGeometry(0.1, 0.2, 8);
        const earMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        
        const leftEar = new THREE.Mesh(earGeometry, earMaterial);
        leftEar.position.set(0.35, 0.25, 0.15);
        leftEar.rotation.x = -Math.PI / 6;
        leftEar.rotation.z = -Math.PI / 3;
        ratGroup.add(leftEar);
        
        const rightEar = new THREE.Mesh(earGeometry, earMaterial);
        rightEar.position.set(0.35, 0.25, -0.15);
        rightEar.rotation.x = Math.PI / 6;
        rightEar.rotation.z = -Math.PI / 3;
        ratGroup.add(rightEar);
        
        // Tail
        const tailCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.4, 0, 0),
            new THREE.Vector3(-0.6, 0.1, 0),
            new THREE.Vector3(-0.8, 0, 0),
            new THREE.Vector3(-1, -0.1, 0)
        ]);
        
        const tailGeometry = new THREE.TubeGeometry(tailCurve, 8, 0.05, 8, false);
        const tailMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.castShadow = true;
        ratGroup.add(tail);
        
        // Legs
        const legGeometry = new THREE.CapsuleGeometry(0.05, 0.2, 4, 8);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
        
        const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
        frontLeftLeg.position.set(0.2, -0.2, 0.2);
        frontLeftLeg.rotation.x = Math.PI / 2;
        ratGroup.add(frontLeftLeg);
        
        const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
        frontRightLeg.position.set(0.2, -0.2, -0.2);
        frontRightLeg.rotation.x = Math.PI / 2;
        ratGroup.add(frontRightLeg);
        
        const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
        backLeftLeg.position.set(-0.2, -0.2, 0.2);
        backLeftLeg.rotation.x = Math.PI / 2;
        ratGroup.add(backLeftLeg);
        
        const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
        backRightLeg.position.set(-0.2, -0.2, -0.2);
        backRightLeg.rotation.x = Math.PI / 2;
        ratGroup.add(backRightLeg);
        
        // Camera pivot
        this.cameraPivot = new THREE.Object3D();
        this.cameraPivot.position.set(0, 0.5, 0);
        
        // Add the model to the scene
        ratGroup.scale.set(0.5, 0.5, 0.5);
        ratGroup.position.y = 0.25;
        
        this.model = new THREE.Group();
        this.model.add(ratGroup);
        this.model.add(this.cameraPivot);
        
        // Create the collider
        this.collider = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 0.3);
    }
    
    spawn() {
        // Add player model to the scene
        this.game.scene.add(this.model);
        
        // Position the player
        this.model.position.copy(this.game.state.playerData.position);
        
        // Set up camera
        this.game.camera.position.set(0, 0, 0);
        this.cameraPivot.add(this.game.camera);
        this.updateCameraPosition();
    }
    
    setupInputs() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.setControl(e.code, true);
        });
        
        document.addEventListener('keyup', (e) => {
            this.setControl(e.code, false);
        });
        
        // Mouse controls for camera rotation
        document.addEventListener('mousemove', (e) => {
            if (this.game.state.screen === 'playing' && document.pointerLockElement) {
                const sensitivity = 0.002;
                this.rotate(-e.movementX * sensitivity, -e.movementY * sensitivity);
            }
        });
        
        // Pointer lock for camera control
        document.getElementById('game-canvas').addEventListener('click', () => {
            if (this.game.state.screen === 'playing') {
                document.getElementById('game-canvas').requestPointerLock();
            }
        });
    }
    
    setControl(code, active) {
        if (this.game.state.screen !== 'playing') return;
        
        switch (code) {
            case 'KeyW': this.controls.forward = active; break;
            case 'KeyS': this.controls.backward = active; break;
            case 'KeyA': this.controls.left = active; break;
            case 'KeyD': this.controls.right = active; break;
            case 'Space': this.controls.jump = active; break;
            case 'ShiftLeft': this.controls.sprint = active; break;
            case 'KeyE': 
                if (active) this.interact();
                break;
        }
    }
    
    update(deltaTime) {
        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * deltaTime;
        }
        
        // Handle movement
        this.processMovement(deltaTime);
        
        // Update collider position
        this.collider.center.x = this.model.position.x;
        this.collider.center.y = this.model.position.y + 0.3;
        this.collider.center.z = this.model.position.z;
        
        // Check for collisions with world objects
        this.handleCollisions();
        
        // Update camera
        this.updateCameraPosition();
        
        // Update debug info
        if (this.game.state.debug) {
            document.getElementById('player-position').textContent = 
                `${this.model.position.x.toFixed(1)}, ${this.model.position.y.toFixed(1)}, ${this.model.position.z.toFixed(1)}`;
            
            // Check the current zone
            const currentZone = this.game.world.getZoneAtPosition(this.model.position);
            document.getElementById('current-zone').textContent = currentZone ? currentZone.type : 'Wilderness';
        }
    }
    
    processMovement(deltaTime) {
        // Calculate movement speed
        const speed = this.controls.sprint ? this.moveSpeed * 1.5 : this.moveSpeed;
        
        // Calculate movement direction based on camera orientation
        const cameraDirection = new THREE.Vector3();
        this.game.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        const cameraSideDirection = new THREE.Vector3(
            cameraDirection.z,
            0,
            -cameraDirection.x
        );
        
        // Calculate movement vector
        const moveVector = new THREE.Vector3(0, 0, 0);
        
        if (this.controls.forward) moveVector.add(cameraDirection);
        if (this.controls.backward) moveVector.sub(cameraDirection);
        if (this.controls.right) moveVector.add(cameraSideDirection);
        if (this.controls.left) moveVector.sub(cameraSideDirection);
        
        // Normalize movement vector if player is moving
        if (moveVector.length() > 0) {
            moveVector.normalize();
            
            // Rotate rat model to face movement direction
            this.model.rotation.y = Math.atan2(moveVector.x, moveVector.z);
        }
        
        // Apply horizontal movement
        this.velocity.x = moveVector.x * speed;
        this.velocity.z = moveVector.z * speed;
        
        // Apply jump if grounded
        if (this.controls.jump && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }
        
        // Apply velocity to position
        this.model.position.x += this.velocity.x * deltaTime;
        this.model.position.y += this.velocity.y * deltaTime;
        this.model.position.z += this.velocity.z * deltaTime;
        
        // Ground check
        if (this.model.position.y < 0.25) {
            this.model.position.y = 0.25;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
        
        // Update player data
        this.game.state.playerData.position.copy(this.model.position);
        this.game.state.playerData.rotation = this.model.rotation.y;
    }
    
    rotate(yaw, pitch) {
        // Horizontal camera rotation around Y axis
        this.cameraPivot.rotation.y += yaw;
        
        // Vertical camera rotation (pitch) constrained to prevent flipping
        this.cameraPivot.rotation.x += pitch;
        this.cameraPivot.rotation.x = Math.max(
            -Math.PI / 2, 
            Math.min(Math.PI / 3, this.cameraPivot.rotation.x)
        );
    }
    
    updateCameraPosition() {
        // Position the camera behind the player
        const cameraOffset = new THREE.Vector3();
        cameraOffset.set(0, 0.5, 2);
        
        // Check for camera collisions with world
        // This is a simplified version - in a real game you'd use raycasting
        cameraOffset.z = 2;
    }
    
    handleCollisions() {
        // Check for item pickups
        const items = this.game.world.items;
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const distance = this.model.position.distanceTo(item.position);
            
            if (distance < 1) {
                this.pickupItem(item, i);
            }
        }
        
        // Check for interactable objects
        // (This would be handled by the interact method)
    }
    
    pickupItem(item, index) {
        // Add item to inventory using userData properties
        this.game.state.playerData.inventory.push({
            id: item.userData.itemId,
            name: item.userData.itemName,
            type: item.userData.itemType,
            value: item.userData.itemValue,
            count: 1
        });
        
        // Remove item from world
        this.game.scene.remove(item);
        this.game.world.items.splice(index, 1);
        
        // Show notification
        this.game.ui.showNotification(`Picked up ${item.userData.itemName}`);
        
        // Update UI
        if (document.getElementById('inventory-panel').classList.contains('hidden') === false) {
            this.game.ui.renderInventory();
        }
    }
    
    interact() {
        // Cast a ray forward from the player to detect interactable objects
        const direction = new THREE.Vector3();
        this.model.getWorldDirection(direction);
        
        const raycaster = new THREE.Raycaster(
            this.collider.center,
            direction,
            0,
            2
        );
        
        const intersects = raycaster.intersectObjects(this.game.world.interactables);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.interactable) {
                object.userData.interact(this);
            }
        }
    }
    
    teleport(x, y, z) {
        this.model.position.set(x, y, z);
        this.game.state.playerData.position.copy(this.model.position);
        this.velocity.set(0, 0, 0);
    }
}

export { Player };