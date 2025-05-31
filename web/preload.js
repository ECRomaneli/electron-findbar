const $remote = (ipc => ({
    getLastState: async () => ipc.invoke('electron-findbar/last-state'),
    inputChange: (value) => { ipc.send('electron-findbar/input-change', value, true) },
    matchCase: (value) => { ipc.send('electron-findbar/match-case', value, true) },
    previous: () => { ipc.send('electron-findbar/previous') },
    next: () => { ipc.send('electron-findbar/next') },
    close: () => { ipc.send('electron-findbar/close') },
    onMatchesChange: (listener) => { ipc.on('electron-findbar/matches', listener) },
    onInputFocus: (listener) => { ipc.on('electron-findbar/input-focus', listener) },
    onTextChange: (listener) => { ipc.on('electron-findbar/text-change', listener) },
    onMatchCaseChange: (listener) => { ipc.on('electron-findbar/match-case-change', listener) }
})) (require('electron').ipcRenderer)

let canRequest = true, canMove = false

function inputChange(e) {
    canRequest = false
    $remote.inputChange(e.target.value)
}

function matchCaseChange(btn) {
    const newStatus = buttonIsDisabled(btn)
    toggleButton(btn, newStatus)
    $remote.matchCase(newStatus)
}

function move(next) {
    if (canRequest && canMove) {
        canRequest = false
        next ? $remote.next() : $remote.previous()
    }
}

function toggleButton(btn, status) {
    btn.classList[status ? 'remove' : 'add']('disabled')
}

function buttonIsDisabled(btn) {
    return btn.classList.contains('disabled')
}

document.addEventListener('DOMContentLoaded', async () => {
    const inputEl = document.getElementById('input')
    const matchCaseBtn = document.getElementById('match-case')
    const previousBtn = document.getElementById('previous')
    const nextBtn = document.getElementById('next')
    const closeBtn = document.getElementById('close')
    const matchesEl = document.getElementById('matches')
    const moveBtns = [previousBtn, nextBtn]

    matchCaseBtn.addEventListener('click', () => matchCaseChange(matchCaseBtn))
    previousBtn.addEventListener('click', () => move(false))
    nextBtn.addEventListener('click', () => move(true))
    closeBtn.addEventListener('click', () => $remote.close())
    inputEl.addEventListener('input', inputChange)

    $remote.onTextChange((_, text) => { inputEl.value = text })

    $remote.onInputFocus(() => {
        inputEl.setSelectionRange(0, inputEl.value.length)
        inputEl.focus()
    })

    $remote.onMatchCaseChange((_, status) => { console.log('Match case:', status);toggleButton(matchCaseBtn, status) })

    $remote.onMatchesChange((_, m) => {
        canRequest = true
        matchesEl.innerText = inputEl.value ? m.active + '/' + m.total : ''
        for (var moveBtn of moveBtns) { toggleButton(moveBtn, canMove = m.total > 1) }
    })
    
    const lastState = await $remote.getLastState()
    inputEl.value = lastState.text || ''
    lastState.movable || document.getElementsByClassName('movable')[0].classList.remove('movable')
    toggleButton(matchCaseBtn, lastState.matchCase)
    $remote.inputChange(inputEl.value)
    inputEl.setSelectionRange(0, inputEl.value.length)
    inputEl.focus()
})