class UI {
    constructor(game) {
        this.game = game;
        this.notificationQueue = [];
        this.notificationTimer = null;
    }
    
    updateHealthBar() {
        const healthFill = document.getElementById('health-fill');
        const healthPercentage = (this.game.state.playerData.health / this.game.state.playerData.maxHealth) * 100;
        healthFill.style.width = `${healthPercentage}%`;
    }
    
    updateHungerBar() {
        const hungerFill = document.getElementById('hunger-fill');
        const hungerPercentage = (this.game.state.playerData.hunger / this.game.state.playerData.maxHunger) * 100;
        hungerFill.style.width = `${hungerPercentage}%`;
    }
    
    showNotification(message, type = 'info') {
        this.notificationQueue.push({ message, type });
        
        if (!this.notificationTimer) {
            this.processNotificationQueue();
        }
    }
    
    processNotificationQueue() {
        if (this.notificationQueue.length === 0) {
            this.notificationTimer = null;
            return;
        }
        
        const notification = this.notificationQueue.shift();
        const notificationArea = document.getElementById('notification-area');
        
        // Create notification element
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification notification-${notification.type}`;
        notificationElement.textContent = notification.message;
        
        // Add to notification area
        notificationArea.appendChild(notificationElement);
        
        // Remove after animation completes
        setTimeout(() => {
            notificationElement.remove();
            this.processNotificationQueue();
        }, 5000); // 5 seconds (animation is 5s)
    }
    
    togglePanel(panelType) {
        switch (panelType) {
            case 'inventory':
                const inventoryPanel = document.getElementById('inventory-panel');
                const isInventoryVisible = !inventoryPanel.classList.contains('hidden');
                
                if (isInventoryVisible) {
                    inventoryPanel.classList.add('hidden');
                } else {
                    // Update inventory before showing
                    this.renderInventory();
                    inventoryPanel.classList.remove('hidden');
                }
                break;
                
            case 'worldMap':
                const worldMapPanel = document.getElementById('world-map-panel');
                const isWorldMapVisible = !worldMapPanel.classList.contains('hidden');
                
                if (isWorldMapVisible) {
                    worldMapPanel.classList.add('hidden');
                } else {
                    // Update world map before showing
                    if (this.game.world) {
                        this.game.world.drawWorldMap();
                    }
                    worldMapPanel.classList.remove('hidden');
                }
                break;
        }
    }
    
    renderInventory() {
        const inventoryGrid = document.querySelector('.inventory-grid');
        inventoryGrid.innerHTML = '';
        
        // Group items by ID and count them
        const groupedItems = {};
        for (const item of this.game.state.playerData.inventory) {
            if (!groupedItems[item.id]) {
                groupedItems[item.id] = {
                    ...item,
                    count: 0
                };
            }
            groupedItems[item.id].count += item.count;
        }
        
        // Calculate total weight
        let totalWeight = 0;
        for (const itemId in groupedItems) {
            totalWeight += groupedItems[itemId].count;
        }
        
        // Update weight display
        document.getElementById('current-weight').textContent = totalWeight;
        
        // Calculate total gold
        let totalGold = 0;
        for (const itemId in groupedItems) {
            const item = groupedItems[itemId];
            if (item.type === 'treasure') {
                totalGold += item.value * item.count;
            }
        }
        
        // Update gold display
        document.getElementById('gold-amount').textContent = totalGold;
        this.game.state.playerData.gold = totalGold;
        
        // Create slots for each item
        for (const itemId in groupedItems) {
            const item = groupedItems[itemId];
            
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            
            const itemElement = document.createElement('div');
            itemElement.className = 'inventory-item';
            itemElement.style.backgroundColor = this.getItemColor(item.id);
            
            const countElement = document.createElement('div');
            countElement.className = 'item-count';
            countElement.textContent = item.count;
            
            // Add tooltip
            itemElement.title = `${item.name}\nType: ${item.type}\nValue: ${item.value}`;
            
            slot.appendChild(itemElement);
            slot.appendChild(countElement);
            inventoryGrid.appendChild(slot);
        }
        
        // Fill remaining slots
        const totalSlots = 20;
        const emptySlots = totalSlots - Object.keys(groupedItems).length;
        
        for (let i = 0; i < emptySlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot empty';
            inventoryGrid.appendChild(slot);
        }
    }
    
    getItemColor(itemId) {
        switch (itemId) {
            case 'cheese': return '#FFD700';
            case 'coin': return '#FFD700';
            case 'gem': return '#00FFFF';
            default: return '#AAAAAA';
        }
    }
}

export { UI };

