/**
 * Source Manager Component
 * Handles adding, editing, and deleting sources (Xtream, M3U, EPG)
 */

class SourceManager {
    constructor() {
        this.xtreamList = document.getElementById('xtream-list');
        this.m3uList = document.getElementById('m3u-list');
        this.epgList = document.getElementById('epg-list');

        // Content browser state
        this.contentType = 'channels'; // 'channels' or 'movies'
        this.treeData = null; // { type, sourceId, groups: [{ id, name, items: [] }] }
        this.hiddenSet = new Set(); // Set of hidden item keys
        this.expandedGroups = new Set(); // Set of expanded group IDs

        this.init();
    }

    init() {
        // Add source buttons
        document.getElementById('add-xtream').addEventListener('click', () => this.showAddModal('xtream'));
        document.getElementById('add-m3u').addEventListener('click', () => this.showAddModal('m3u'));
        document.getElementById('add-epg').addEventListener('click', () => this.showAddModal('epg'));

        // Initialize content browser
        this.initContentBrowser();
    }

    /**
     * Load and display all sources
     */
    async loadSources() {
        try {
            const sources = await API.sources.getAll();

            this.renderSourceList(this.xtreamList, sources.filter(s => s.type === 'xtream'), 'xtream');
            this.renderSourceList(this.m3uList, sources.filter(s => s.type === 'm3u'), 'm3u');
            this.renderSourceList(this.epgList, sources.filter(s => s.type === 'epg'), 'epg');
        } catch (err) {
            console.error('Error loading sources:', err);
        }
    }

    /**
     * Render source list
     */
    renderSourceList(container, sources, type) {
        if (sources.length === 0) {
            container.innerHTML = `<p class="hint">No ${type.toUpperCase()} sources configured</p>`;
            return;
        }

        const icons = { xtream: Icons.live, m3u: Icons.guide, epg: Icons.series };

        container.innerHTML = sources.map(source => `
      <div class="source-item ${source.enabled ? '' : 'disabled'}" data-id="${source.id}">
        <span class="source-icon">${icons[type]}</span>
        <div class="source-info">
          <div class="source-name">${source.name}</div>
          <div class="source-url">${source.url}</div>
        </div>
        <div class="source-actions">
          <button class="btn btn-sm btn-secondary" data-action="refresh" title="Refresh Data">${Icons.play}</button>
          <button class="btn btn-sm btn-secondary" data-action="test" title="Test Connection">${Icons.search}</button>
          <button class="btn btn-sm btn-secondary" data-action="toggle" title="${source.enabled ? 'Disable' : 'Enable'}">
            ${source.enabled ? Icons.favorite : Icons.favoriteOutline}
          </button>
          <button class="btn btn-sm btn-secondary" data-action="edit" title="Edit">${Icons.settings}</button>
          <button class="btn btn-sm btn-danger" data-action="delete" title="Delete">${Icons.close}</button>
        </div>
      </div>
    `).join('');

        // Attach event listeners
        container.querySelectorAll('.source-item').forEach(item => {
            const id = parseInt(item.dataset.id);

            item.querySelector('[data-action="refresh"]').addEventListener('click', () => this.refreshSource(id, type));
            item.querySelector('[data-action="test"]').addEventListener('click', () => this.testSource(id));
            item.querySelector('[data-action="toggle"]').addEventListener('click', () => this.toggleSource(id));
            item.querySelector('[data-action="edit"]').addEventListener('click', () => this.showEditModal(id, type));
            item.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteSource(id));
        });
    }

    /**
     * Show add source modal
     */
    showAddModal(type) {
        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        const titles = { xtream: 'Add Xtream Connection', m3u: 'Add M3U Playlist', epg: 'Add EPG Source' };
        title.textContent = titles[type];

        body.innerHTML = this.getSourceForm(type);

        footer.innerHTML = `
      <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-save">Add Source</button>
    `;

        modal.classList.add('active');

        // Event listeners
        modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
        document.getElementById('modal-cancel').onclick = () => modal.classList.remove('active');
        document.getElementById('modal-save').onclick = () => this.saveNewSource(type);
    }

    /**
     * Show edit source modal
     */
    async showEditModal(id, type) {
        try {
            const source = await API.sources.getById(id);

            const modal = document.getElementById('modal');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');
            const footer = document.getElementById('modal-footer');

            title.textContent = `Edit ${type.toUpperCase()} Source`;
            body.innerHTML = this.getSourceForm(type, source);

            footer.innerHTML = `
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save">Save Changes</button>
      `;

            modal.classList.add('active');

            modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
            document.getElementById('modal-cancel').onclick = () => modal.classList.remove('active');
            document.getElementById('modal-save').onclick = () => this.updateSource(id, type);
        } catch (err) {
            console.error('Error loading source:', err);
        }
    }

    /**
     * Get source form HTML
     */
    getSourceForm(type, source = {}) {
        const nameField = `
      <div class="form-group">
        <label for="source-name">Name</label>
        <input type="text" id="source-name" class="form-input" placeholder="My Source" value="${source.name || ''}">
      </div>
    `;

        const urlField = `
      <div class="form-group">
        <label for="source-url">${type === 'xtream' ? 'Server URL' : 'URL'}</label>
        <input type="text" id="source-url" class="form-input" 
               placeholder="${type === 'xtream' ? 'http://server.com:port' : 'https://example.com/playlist.m3u'}" 
               value="${source.url || ''}">
      </div>
    `;

        if (type === 'xtream') {
            return `
        ${nameField}
        ${urlField}
        <div class="form-group">
          <label for="source-username">Username</label>
          <input type="text" id="source-username" class="form-input" value="${source.username || ''}">
        </div>
        <div class="form-group">
          <label for="source-password">Password</label>
          <input type="password" id="source-password" class="form-input" 
                 value="${source.password && !source.password.includes('•') ? source.password : ''}">
        </div>
      `;
        }

        return nameField + urlField;
    }

    /**
     * Save new source
     */
    async saveNewSource(type) {
        const name = document.getElementById('source-name').value.trim();
        const url = document.getElementById('source-url').value.trim();
        const username = document.getElementById('source-username')?.value.trim() || null;
        const password = document.getElementById('source-password')?.value.trim() || null;

        if (!name || !url) {
            alert('Name and URL are required');
            return;
        }

        try {
            await API.sources.create({ type, name, url, username, password });
            document.getElementById('modal').classList.remove('active');
            await this.loadSources();

            // Refresh channel list
            if (window.app?.channelList) {
                await window.app.channelList.loadSources();
                await window.app.channelList.loadChannels();
            }
        } catch (err) {
            alert('Error adding source: ' + err.message);
        }
    }

    /**
     * Update existing source
     */
    async updateSource(id, type) {
        const name = document.getElementById('source-name').value.trim();
        const url = document.getElementById('source-url').value.trim();
        const username = document.getElementById('source-username')?.value.trim();
        const password = document.getElementById('source-password')?.value.trim();

        if (!name || !url) {
            alert('Name and URL are required');
            return;
        }

        try {
            const data = { name, url };
            if (type === 'xtream') {
                data.username = username;
                if (password) data.password = password;
            }

            await API.sources.update(id, data);
            document.getElementById('modal').classList.remove('active');
            await this.loadSources();
        } catch (err) {
            alert('Error updating source: ' + err.message);
        }
    }

    /**
     * Delete source
     */
    async deleteSource(id) {
        if (!confirm('Are you sure you want to delete this source?')) return;

        try {
            await API.sources.delete(id);
            await this.loadSources();

            if (window.app?.channelList) {
                await window.app.channelList.loadSources();
                await window.app.channelList.loadChannels();
            }
        } catch (err) {
            alert('Error deleting source: ' + err.message);
        }
    }

    /**
     * Toggle source enabled/disabled
     */
    async toggleSource(id) {
        try {
            await API.sources.toggle(id);
            await this.loadSources();
        } catch (err) {
            alert('Error toggling source: ' + err.message);
        }
    }

    /**
     * Test source connection
     */
    async testSource(id) {
        try {
            const result = await API.sources.test(id);
            if (result.success) {
                alert('Connection successful!');
            } else {
                alert('Connection failed: ' + (result.error || result.message));
            }
        } catch (err) {
            alert('Connection failed: ' + err.message);
        }
    }

    /**
     * Refresh source data
     */
    async refreshSource(id, type) {
        try {
            const btn = document.querySelector(`.source-item[data-id="${id}"] [data-action="refresh"]`);
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<div class="loading-spinner" style="width:1em;height:1em;border-width:2px"></div>';
            }

            // Clear cache for this source first
            await API.proxy.cache.clear(id);

            if (type === 'epg') {
                // Force refresh EPG data
                if (window.app?.epgGuide) {
                    await window.app.epgGuide.loadEpg(true);
                }
                alert('EPG data refreshed!');
            } else if (type === 'xtream') {
                // Re-fetch xtream data by reloading channels
                if (window.app?.channelList) {
                    await window.app.channelList.loadChannels();
                }
                alert('Xtream data refreshed!');
            } else if (type === 'm3u') {
                // Re-fetch M3U data by reloading channels
                if (window.app?.channelList) {
                    await window.app.channelList.loadChannels();
                }
                alert('M3U playlist refreshed!');
            }

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = Icons.play;
            }
        } catch (err) {
            console.error('Error refreshing source:', err);
            alert('Refresh failed: ' + err.message);
        }
    }

    /**
     * Initialize content browser
     */
    initContentBrowser() {
        this.contentSourceSelect = document.getElementById('content-source-select');
        this.contentTree = document.getElementById('content-tree');
        this.channelsBtn = document.getElementById('content-type-channels');
        this.moviesBtn = document.getElementById('content-type-movies');
        this.seriesBtn = document.getElementById('content-type-series');

        // Content type toggle
        this.channelsBtn?.addEventListener('click', () => {
            this.contentType = 'channels';
            this.channelsBtn.classList.add('active');
            this.moviesBtn?.classList.remove('active');
            this.seriesBtn?.classList.remove('active');
            this.reloadContentTree();
        });

        this.moviesBtn?.addEventListener('click', () => {
            this.contentType = 'movies';
            this.moviesBtn.classList.add('active');
            this.channelsBtn?.classList.remove('active');
            this.seriesBtn?.classList.remove('active');
            this.reloadContentTree();
        });

        this.seriesBtn?.addEventListener('click', () => {
            this.contentType = 'series';
            this.seriesBtn.classList.add('active');
            this.channelsBtn?.classList.remove('active');
            this.moviesBtn?.classList.remove('active');
            this.reloadContentTree();
        });

        // Source selection
        this.contentSourceSelect?.addEventListener('change', () => this.reloadContentTree());

        // Show All / Hide All buttons
        document.getElementById('content-show-all')?.addEventListener('click', () => this.setAllVisibility(true));
        document.getElementById('content-hide-all')?.addEventListener('click', () => this.setAllVisibility(false));

        // Save Changes button
        document.getElementById('content-save')?.addEventListener('click', () => this.saveContentChanges());
    }

    /**
     * Reload content tree based on current type and source
     */
    reloadContentTree() {
        const sourceId = this.contentSourceSelect?.value;
        if (!sourceId) {
            const typeLabel = this.contentType === 'movies' ? 'movie categories' :
                this.contentType === 'series' ? 'series categories' : 'groups and channels';
            this.contentTree.innerHTML = `<p class="hint">Select a source to view ${typeLabel}</p>`;
            return;
        }

        if (this.contentType === 'movies') {
            this.loadMovieCategoriesTree(parseInt(sourceId));
        } else if (this.contentType === 'series') {
            this.loadSeriesCategoriesTree(parseInt(sourceId));
        } else {
            this.loadContentTree(parseInt(sourceId));
        }
    }

    /**
     * Load sources into content browser dropdown
     */
    async loadContentSources() {
        try {
            const sources = await API.sources.getAll();
            const select = document.getElementById('content-source-select');
            if (!select) return;

            // Keep the placeholder option
            select.innerHTML = '<option value="">Select a source...</option>';

            sources.filter(s => s.type === 'xtream' || s.type === 'm3u').forEach(source => {
                select.innerHTML += `<option value="${source.id}">${source.name} (${source.type})</option>`;
            });
        } catch (err) {
            console.error('Error loading content sources:', err);
        }
    }

    /**
     * Load content tree for a source
     * Checked = Visible, Unchecked = Hidden
     */


    /**
     * Load content tree for a source
     */
    async loadContentTree(sourceId) {
        this.contentTree.innerHTML = '<p class="hint">Loading...</p>';
        this.treeData = { type: 'channels', sourceId, groups: [] };
        this.expandedGroups.clear();

        try {
            const source = await API.sources.getById(sourceId);
            let channels = [];

            let categoryMap = {};

            if (source.type === 'xtream') {
                // Run sequentially to avoid overwhelming the provider
                const categories = await API.proxy.xtream.liveCategories(sourceId);
                const streams = await API.proxy.xtream.liveStreams(sourceId);

                channels = streams;
                categories.forEach(cat => {
                    categoryMap[cat.category_id] = cat.category_name;
                });
            } else if (source.type === 'm3u') {
                const m3uData = await API.proxy.m3u.get(sourceId);
                channels = m3uData.channels || [];
            }

            // Get currently hidden items
            const hiddenItems = await API.channels.getHidden(sourceId);
            this.hiddenSet = new Set(hiddenItems.map(h => `${h.item_type}:${h.item_id}`));

            // Group channels
            const groups = {};
            channels.forEach(ch => {
                let groupName = 'Uncategorized';
                if (source.type === 'xtream') {
                    if (ch.category_id && categoryMap[ch.category_id]) {
                        groupName = categoryMap[ch.category_id];
                    }
                } else {
                    groupName = ch.category_name || ch.groupTitle || 'Uncategorized';
                }

                if (!groups[groupName]) {
                    groups[groupName] = [];
                }

                // Normalize channel object
                const channelId = ch.stream_id || ch.id || ch.url;
                const channelName = ch.name || ch.tvgName || 'Unknown';

                groups[groupName].push({
                    id: channelId,
                    name: channelName,
                    original: ch,
                    type: 'channel'
                });
            });

            // Convert to array
            this.treeData.groups = Object.keys(groups).sort().map(name => ({
                id: name, // generic group ID
                name: name,
                type: 'group',
                items: groups[name]
            }));

            this.renderTree();

        } catch (err) {
            console.error('Error loading content tree:', err);
            this.contentTree.innerHTML = '<p class="hint" style="color: var(--color-error);">Error loading content</p>';
        }
    }

    /**
     * Render the full tree based on current state
     */
    renderTree() {
        if (!this.treeData || !this.treeData.groups.length) {
            this.contentTree.innerHTML = '<p class="hint">No content found</p>';
            return;
        }

        const html = this.treeData.groups.map(group => this.getGroupHtml(group)).join('');
        this.contentTree.innerHTML = html;

        // Attach event listeners
        this.attachTreeListeners(this.contentTree);
    }

    /**
     * Get HTML for a group (and its items if expanded)
     */
    getGroupHtml(group) {
        const isExpanded = this.expandedGroups.has(group.id);

        // Group checkbox is checked if ANY child is visible (derived state)
        const hasVisibleChild = group.items.some(item => !this.hiddenSet.has(`${item.type}:${item.id}`));
        const checked = hasVisibleChild;

        let itemsHtml = '';
        if (isExpanded) {
            itemsHtml = `<div class="content-channels">
                ${group.items.map(item => {
                const itemHidden = this.hiddenSet.has(`${item.type}:${item.id}`);
                return `
                    <label class="checkbox-label channel-item" title="${this.escapeHtml(item.name)}">
                        <input type="checkbox" class="channel-checkbox" 
                               data-type="${item.type}" 
                               data-id="${item.id}" 
                               data-source-id="${this.treeData.sourceId}" 
                               ${!itemHidden ? 'checked' : ''}>
                        <span class="channel-name">${this.escapeHtml(item.name)}</span>
                    </label>`;
            }).join('')}
            </div>`;
        }

        return `
            <div class="content-group ${isExpanded ? '' : 'collapsed'}" data-group-id="${this.escapeHtml(group.id)}">
                <div class="content-group-header">
                    <span class="group-expander">${Icons.chevronDown}</span>
                    <label class="checkbox-label" onclick="event.stopPropagation()">
                        <input type="checkbox" class="group-checkbox" 
                               data-type="group" 
                               data-id="${this.escapeHtml(group.name)}" 
                               data-source-id="${this.treeData.sourceId}" 
                               ${checked ? 'checked' : ''}>
                        <span class="group-name">${this.escapeHtml(group.name)} (${group.items.length})</span>
                    </label>
                </div>
                ${itemsHtml}
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    attachTreeListeners(container) {
        // Toggle group collapse
        container.querySelectorAll('.content-group-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Prevent triggering if clicking the checkbox/label directly (handled by its own listener/bubbling)
                if (e.target.closest('input') || e.target.closest('label')) return;

                const groupEl = header.closest('.content-group');
                const groupId = groupEl.dataset.groupId;
                this.toggleGroupExpand(groupId);
            });
        });

        // Toggle visibility
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (cb.classList.contains('group-checkbox')) {
                    this.toggleGroupChildren(cb);
                } else {
                    this.toggleVisibility(cb);
                }
            });
        });
    }

    toggleGroupExpand(groupId) {
        if (this.expandedGroups.has(groupId)) {
            this.expandedGroups.delete(groupId);
        } else {
            this.expandedGroups.add(groupId);
        }

        // Re-render only this group
        const groupEl = this.contentTree.querySelector(`.content-group[data-group-id="${CSS.escape(groupId)}"]`);
        if (groupEl) {
            const group = this.treeData.groups.find(g => g.id === groupId);
            if (group) {
                const newHtml = this.getGroupHtml(group);
                groupEl.outerHTML = newHtml;

                // Re-attach listeners to the new element
                const newEl = this.contentTree.querySelector(`.content-group[data-group-id="${CSS.escape(groupId)}"]`);
                if (newEl) this.attachTreeListeners(newEl);
            }
        }
    }

    /**
     * Load movie categories tree for a source
     */
    async loadMovieCategoriesTree(sourceId) {
        this.contentTree.innerHTML = '<p class="hint">Loading movie categories...</p>';
        this.treeData = { type: 'movies', sourceId, groups: [] };

        try {
            const source = await API.sources.getById(sourceId);

            if (source.type !== 'xtream') {
                this.contentTree.innerHTML = '<p class="hint">Movie categories are only available for Xtream sources</p>';
                return;
            }

            const categories = await API.proxy.xtream.vodCategories(sourceId);

            if (!categories || categories.length === 0) {
                this.contentTree.innerHTML = '<p class="hint">No movie categories found</p>';
                return;
            }

            const hiddenItems = await API.channels.getHidden(sourceId);
            this.hiddenSet = new Set(hiddenItems.map(h => `${h.item_type}:${h.item_id}`));

            // Create a single "Movies" group or flatten?
            // The original UI rendered a flat list of categories. 
            // Better to stick to "Group -> Items" structure, or just wrap them in a pseudo-group?
            // Original: rendered checkboxes directly.
            // Let's adopt the treeData structure but with a single root group or flat items?
            // To support generic renderTree, we can put them in a "Categories" group or just render them as items.
            // Let's update renderTree to support flat list if groups is empty? 
            // Or just put them in one "All Categories" group that is auto-expanded.

            this.treeData.groups = [{
                id: 'all_categories',
                name: 'Categories',
                type: 'group',
                items: categories.sort((a, b) => a.category_name.localeCompare(b.category_name)).map(cat => ({
                    id: cat.category_id,
                    name: cat.category_name,
                    type: 'vod_category',
                    original: cat
                }))
            }];

            // Auto expand
            this.expandedGroups.add('all_categories');
            this.renderTree();

        } catch (err) {
            console.error('Error loading movie categories:', err);
            this.contentTree.innerHTML = '<p class="hint" style="color: var(--color-error);">Error loading movie categories</p>';
        }
    }

    /**
     * Load series categories tree for a source
     */
    async loadSeriesCategoriesTree(sourceId) {
        this.contentTree.innerHTML = '<p class="hint">Loading series categories...</p>';
        this.treeData = { type: 'series', sourceId, groups: [] };

        try {
            const source = await API.sources.getById(sourceId);

            if (source.type !== 'xtream') {
                this.contentTree.innerHTML = '<p class="hint">Series categories are only available for Xtream sources</p>';
                return;
            }

            const categories = await API.proxy.xtream.seriesCategories(sourceId);

            if (!categories || categories.length === 0) {
                this.contentTree.innerHTML = '<p class="hint">No series categories found</p>';
                return;
            }

            const hiddenItems = await API.channels.getHidden(sourceId);
            this.hiddenSet = new Set(hiddenItems.map(h => `${h.item_type}:${h.item_id}`));

            this.treeData.groups = [{
                id: 'all_series_categories',
                name: 'Categories',
                type: 'group',
                items: categories.sort((a, b) => a.category_name.localeCompare(b.category_name)).map(cat => ({
                    id: cat.category_id,
                    name: cat.category_name,
                    type: 'series_category',
                    original: cat
                }))
            }];

            this.expandedGroups.add('all_series_categories');
            this.renderTree();

        } catch (err) {
            console.error('Error loading series categories:', err);
            this.contentTree.innerHTML = '<p class="hint" style="color: var(--color-error);">Error loading series categories</p>';
        }
    }

    /**
     * Toggle visibility of a single item (LOCAL STATE ONLY - use Save to persist)
     * Checked = show (remove from hidden), Unchecked = hide (add to hidden)
     */
    toggleVisibility(checkbox) {
        const itemType = checkbox.dataset.type;
        const itemId = checkbox.dataset.id;
        const isVisible = checkbox.checked;

        // Update local state only (will be persisted when Save is clicked)
        const key = `${itemType}:${itemId}`;
        if (isVisible) {
            this.hiddenSet.delete(key);
        } else {
            this.hiddenSet.add(key);
        }

        // Update parent group checkbox to reflect derived state
        const groupEl = checkbox.closest('.content-group');
        if (groupEl) {
            const groupCheckbox = groupEl.querySelector('.group-checkbox');
            if (groupCheckbox) {
                const groupId = groupEl.dataset.groupId;
                const group = this.treeData.groups.find(g => g.id === groupId);
                if (group) {
                    const hasVisibleChild = group.items.some(item => !this.hiddenSet.has(`${item.type}:${item.id}`));
                    groupCheckbox.checked = hasVisibleChild;
                }
            }
        }
    }

    /**
     * Toggle all children of a group (LOCAL STATE ONLY - use Save to persist)
     */
    toggleGroupChildren(groupCb) {
        const groupName = groupCb.dataset.id;
        const group = this.treeData.groups.find(g => g.name === groupName);
        if (!group) return;

        const isChecked = groupCb.checked;

        // Update state for all children
        group.items.forEach(item => {
            const key = `${item.type}:${item.id}`;
            if (isChecked) {
                this.hiddenSet.delete(key);
            } else {
                this.hiddenSet.add(key);
            }
        });

        // Re-render group to update all checkboxes
        const groupEl = this.contentTree.querySelector(`.content-group[data-group-id="${CSS.escape(group.id)}"]`);
        if (groupEl) {
            groupEl.outerHTML = this.getGroupHtml(group);
            const newEl = this.contentTree.querySelector(`.content-group[data-group-id="${CSS.escape(group.id)}"]`);
            if (newEl) this.attachTreeListeners(newEl);
        }
    }

    /**
     * Set visibility for all items (LOCAL STATE ONLY - use Save to persist)
     */
    setAllVisibility(visible) {
        if (!this.treeData || !this.treeData.groups) return;

        // Update state for all items
        this.treeData.groups.forEach(group => {
            group.items.forEach(item => {
                const key = `${item.type}:${item.id}`;
                if (visible) {
                    this.hiddenSet.delete(key);
                } else {
                    this.hiddenSet.add(key);
                }
            });
        });

        // Re-render to reflect changes
        this.renderTree();
    }

    /**
     * Save all content visibility changes to the server
     */
    async saveContentChanges() {
        if (!this.treeData) {
            alert('No content loaded to save');
            return;
        }

        const saveBtn = document.getElementById('content-save');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Saving...';
        }

        try {
            const sourceId = this.treeData.sourceId;
            const itemsToShow = [];
            const itemsToHide = [];

            // Collect all items and determine their visibility
            this.treeData.groups.forEach(group => {
                group.items.forEach(item => {
                    const key = `${item.type}:${item.id}`;
                    const isHidden = this.hiddenSet.has(key);

                    if (isHidden) {
                        itemsToHide.push({ sourceId, itemType: item.type, itemId: item.id });
                    } else {
                        itemsToShow.push({ sourceId, itemType: item.type, itemId: item.id });
                    }
                });
            });

            // Execute bulk operations
            const promises = [];
            if (itemsToShow.length > 0) {
                promises.push(API.channels.bulkShow(itemsToShow));
            }
            if (itemsToHide.length > 0) {
                promises.push(API.channels.bulkHide(itemsToHide));
            }

            await Promise.all(promises);

            // Sync Channel List
            if (window.app?.channelList) {
                await window.app.channelList.loadHiddenItems();
                window.app.channelList.render();
            }

            if (saveBtn) {
                saveBtn.textContent = '✓ Saved!';
                setTimeout(() => {
                    saveBtn.textContent = '💾 Save Changes';
                    saveBtn.disabled = false;
                }, 1500);
            }

        } catch (err) {
            console.error('Error saving content changes:', err);
            alert('Failed to save changes: ' + err.message);
            if (saveBtn) {
                saveBtn.textContent = '💾 Save Changes';
                saveBtn.disabled = false;
            }
        }
    }

}

// Export
window.SourceManager = SourceManager;
