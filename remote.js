/**
 * Remote IPC events to control the findbar through the renderer.
 */
const Remote = (ipc => ({
    /**
     * Get last queried text and the "match case" status.
     * @returns {Promise<{ text: string, matchCase: boolean, movable: boolean }>}
     */
    getLastState: async () => ipc.invoke('electron-findbar/last-state'),

    /**
     * Change the input value and find it.
     * @param {string} text - The text to search for
     */
    inputChange: (text) => { ipc.send('electron-findbar/input-change', text) },
    
    /**
     * Toggle case sensitive search
     * @param {boolean} value - Whether to match case or not
     */
    matchCase: (value) => { ipc.send('electron-findbar/match-case', value) },
    
    /**
     * Navigate to the previous match
     */
    previous: () => { ipc.send('electron-findbar/previous') },
    
    /**
     * Navigate to the next match
     */
    next: () => { ipc.send('electron-findbar/next') },
    
    /**
     * Open the findbar
     */
    open: () => { ipc.send('electron-findbar/open') },
    
    /**
     * Close the findbar
     */
    close: () => { ipc.send('electron-findbar/close') },
})) (require('electron').ipcRenderer)

module.exports = Remote