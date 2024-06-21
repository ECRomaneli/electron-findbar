/**
 * Remote IPC events to control the findbar through the renderer.
 */
const Remote = (ipc => ({
    /**
     * Get last queried text.
     * @returns {string}
     */
    getLastText: async () => ipc.invoke('electron-findbar/last-text'),

    /**
     * Change the input value and find it.
     * @param {string} text 
     */
    inputChange: (text) => { ipc.send('electron-findbar/input-change', text) },
    previous: () => { ipc.send('electron-findbar/previous') },
    next: () => { ipc.send('electron-findbar/next') },
    open: () => { ipc.send('electron-findbar/open') },
    close: () => { ipc.send('electron-findbar/close') },
})) (require('electron').ipcRenderer)

module.exports = Remote