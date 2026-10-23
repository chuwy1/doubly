let round = 1;
// The "n" makes this a BigInt: a whole number that can be ANY size.
// A normal number turns into things like 1.18e+21 after about round 70.
let number = 1n;

const question = document.querySelector('#question');
const message = document.querySelector('#message');
const answerInput = document.querySelector('#answer');
const submitButton = document.querySelector('#submit');
const playButton = document.querySelector('#play');
const titleScreen = document.querySelector('.title-screen');
const gameScreen = document.querySelector('.game-screen');
const roundLabel = document.querySelector('#round');
const card = document.querySelector('.card');

// toLocaleString adds commas so big numbers are easy to read: 1048576 -> "1,048,576"
function showQuestion() {
    const shown = number.toLocaleString();
    question.textContent = shown + ' + ' + shown + ' = ?';
    fitQuestion();
}

// Grow first, shrink last. CSS already widens the card to fit the question.
// Only when the card is as wide as the screen and the question STILL doesn't fit,
// this makes the text a bit smaller, step by step, until it does.
function fitQuestion() {
    // Start over from the normal CSS size and rules
    question.style.fontSize = '';
    question.style.whiteSpace = '';

    let size = parseFloat(getComputedStyle(question).fontSize);

    // scrollWidth = how wide the text wants to be, clientWidth = how wide it's allowed to be
    while (question.scrollWidth > question.clientWidth && size > 18) {
        size = size - 2;
        question.style.fontSize = size + 'px';
    }

    // Still too long even when small? Then let it wrap onto the next line after all
    if (question.scrollWidth > question.clientWidth) {
        question.style.whiteSpace = 'normal';
    }
}

showQuestion();

function nextRound() {
    number = number * 2n; // BigInts can only do math with other BigInts, so 2n, not 2
    round = round + 1;
    showQuestion();
    roundLabel.textContent = 'Round ' + round;
}

// Browsers block sound until the player clicks or presses a key,
// so this starts empty and gets created the first time we need it
let audio = null;

// Plays a list of notes one after another.
// gap = seconds between notes, length = how long each note rings
function playNotes(notes, gap, length) {
    if (audio === null) {
        audio = new AudioContext();
    }

    notes.forEach(function(frequency, i) {
        const start = audio.currentTime + i * gap;
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();

        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;

        // Start fairly quiet, then fade out fast so it sounds like a plucked note
        volume.gain.setValueAtTime(0.2, start);
        volume.gain.exponentialRampToValueAtTime(0.001, start + length);

        oscillator.connect(volume);
        volume.connect(audio.destination);

        oscillator.start(start);
        oscillator.stop(start + length);
    });
}

// C, E, G played quickly = a happy little "ding-ding-ding"
function playCorrectSound() {
    playNotes([523, 659, 784], 0.08, 0.25);
}

// Climbs up to a high C, steps back, then lands on it again = "ta-da!"
function playCelebrationSound() {
    playNotes([523, 659, 784, 1047, 784, 1047, 1319], 0.11, 0.45);
}

function checkAnswer() {
    // The question shows commas, so players may type them too ("1,024").
    // replace() with /[,\s]/g removes every comma and space.
    const typed = answerInput.value.replace(/[,\s]/g, '');

    if (typed === '') {
        message.textContent = 'Type a number first!';
        message.className = '';
        answerInput.focus();
        return;
    }

    // /^\d+$/ means "only digits, from start (^) to end ($)".
    // BigInt() would crash on things like "abc" or "1.5", so check first.
    if (!/^\d+$/.test(typed)) {
        message.textContent = 'Numbers only!';
        message.className = 'wrong';
        answerInput.focus();
        return;
    }

    if (BigInt(typed) === number * 2n) {
        message.textContent = 'Correct!';
        message.className = 'correct';
        card.classList.add('pop');
        nextRound();
        answerInput.value = '';

        // Every 10 rounds cleared (10, 20, 30...) is a milestone.
        // % gives the remainder of a division: 20 % 10 is 0, 21 % 10 is 1.
        if ((round - 1) % 10 === 0) {
            playCelebrationSound();
            openCelebration();
            return; // the popup's name box gets the focus, not the answer box
        }

        playCorrectSound();
    } else {
        message.textContent = 'Wrong!';
        message.className = 'wrong';
        card.classList.add('shake');
    }

    answerInput.focus();
}

playButton.addEventListener('click', function() {
    leaderboard.classList.add('hidden');
    titleScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    fitQuestion(); // a hidden screen has no size, so measure now that it's showing
    answerInput.focus();
});

submitButton.addEventListener('click', checkAnswer);

answerInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        checkAnswer();
    }
});

// Remove the animation class when it finishes, so it can play again next time
card.addEventListener('animationend', function() {
    card.classList.remove('pop', 'shake');
});

// ---------- Scratch paper ----------

const scratch = document.querySelector('#scratch');
const scratchToggle = document.querySelector('#scratch-toggle');
const scratchClose = document.querySelector('#scratch-close');
const canvas = document.querySelector('#scratch-canvas');
const pen = canvas.getContext('2d');
const toolButtons = document.querySelectorAll('[data-tool]');
const colorButtons = document.querySelectorAll('[data-color]');
const undoButton = document.querySelector('#undo');
const redoButton = document.querySelector('#redo');
const clearButton = document.querySelector('#clear');

let tool = 'pencil';
let color = '#222222';
let drawing = false;
let undoStack = [];
let redoStack = [];

// A canvas has its own pixel size, separate from its size on screen.
// If they don't match, drawings come out stretched, so we match them here.
function fitCanvas() {
    if (canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight) {
        return;
    }

    // Changing the size wipes the canvas, so save the drawing and put it back
    const picture = snapshot();
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    pen.putImageData(picture, 0, 0);
}

function snapshot() {
    return pen.getImageData(0, 0, canvas.width, canvas.height);
}

function restore(picture) {
    pen.clearRect(0, 0, canvas.width, canvas.height);
    pen.putImageData(picture, 0, 0);
}

function updateUndoRedo() {
    undoButton.disabled = undoStack.length === 0;
    redoButton.disabled = redoStack.length === 0;
}

function toggleScratch() {
    scratch.classList.toggle('hidden');

    // Only measure when it's visible; a hidden element has a size of 0
    if (!scratch.classList.contains('hidden')) {
        fitCanvas();
    }

    // Opening or closing the panel changes how much room the card has
    fitQuestion();
}

function selectTool(name) {
    tool = name;
    toolButtons.forEach(function(button) {
        button.classList.toggle('active', button.dataset.tool === name);
    });
}

scratchToggle.addEventListener('click', toggleScratch);
scratchClose.addEventListener('click', toggleScratch);

window.addEventListener('resize', function() {
    if (!scratch.classList.contains('hidden')) {
        fitCanvas();
    }
    fitQuestion();
});

toolButtons.forEach(function(button) {
    button.addEventListener('click', function() {
        selectTool(button.dataset.tool);
    });
});

colorButtons.forEach(function(button) {
    button.addEventListener('click', function() {
        color = button.dataset.color;
        colorButtons.forEach(function(other) {
            other.classList.toggle('active', other === button);
        });
        // Picking a color means you want to draw, so switch back from the eraser
        selectTool('pencil');
    });
});

// Save how the page looks right now, BEFORE a change, so Undo can go back to it
function saveForUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 30) {
        undoStack.shift(); // forget the oldest one so we don't use too much memory
    }
    redoStack = []; // a new change means the old "future" is gone
    updateUndoRedo();
}

canvas.addEventListener('pointerdown', function(event) {
    saveForUndo();

    drawing = true;
    canvas.setPointerCapture(event.pointerId);

    pen.lineCap = 'round';
    pen.lineJoin = 'round';
    pen.strokeStyle = color;

    if (tool === 'eraser') {
        pen.lineWidth = 28;
        pen.globalCompositeOperation = 'destination-out'; // removes ink instead of adding it
    } else {
        pen.lineWidth = 4;
        pen.globalCompositeOperation = 'source-over'; // normal drawing
    }

    pen.beginPath();
    pen.moveTo(event.offsetX, event.offsetY);
    pen.lineTo(event.offsetX, event.offsetY); // so a single tap still leaves a dot
    pen.stroke();
});

canvas.addEventListener('pointermove', function(event) {
    if (!drawing) {
        return;
    }
    pen.lineTo(event.offsetX, event.offsetY);
    pen.stroke();
});

canvas.addEventListener('pointerup', function() {
    drawing = false;
});

canvas.addEventListener('pointercancel', function() {
    drawing = false;
});

undoButton.addEventListener('click', function() {
    redoStack.push(snapshot());
    restore(undoStack.pop());
    updateUndoRedo();
});

redoButton.addEventListener('click', function() {
    undoStack.push(snapshot());
    restore(redoStack.pop());
    updateUndoRedo();
});

clearButton.addEventListener('click', function() {
    // Save first, same as a stroke, so a Clear by accident can be undone
    saveForUndo();
    pen.clearRect(0, 0, canvas.width, canvas.height);
});

// ---------- Celebration + leaderboard ----------

const celebration = document.querySelector('#celebration');
const popupTitle = document.querySelector('#popup-title');
const popupText = document.querySelector('#popup-text');
const nameInput = document.querySelector('#player-name');
const saveButton = document.querySelector('#save-score');
const keepGoingButton = document.querySelector('#keep-going');
const leaderboard = document.querySelector('#leaderboard');
const leaderboardToggle = document.querySelector('#leaderboard-toggle');
const leaderboardClose = document.querySelector('#leaderboard-close');
const leaderboardList = document.querySelector('#leaderboard-list');
const leaderboardEmpty = document.querySelector('#leaderboard-empty');

// Each step is 1000 times bigger (3 more digits) than the one before it
const bigNames = ['Hundreds', 'Thousands', 'Millions', 'Billions', 'Trillions',
    'Quadrillions', 'Quintillions', 'Sextillions', 'Septillions', 'Octillions',
    'Nonillions', 'Decillions', 'Undecillions', 'Duodecillions', 'Tredecillions',
    'Quattuordecillions', 'Quindecillions', 'Sexdecillions', 'Septendecillions',
    'Octodecillions', 'Novemdecillions', 'Vigintillions'];

// Turns a digit count into a size word: 4 digits (2,048) -> 'Thousands', 7 digits -> 'Millions'.
// 1-3 digits = step 0, 4-6 digits = step 1, 7-9 digits = step 2, and so on.
function sizeName(digits) {
    const step = Math.floor((digits - 1) / 3);
    return bigNames[step] || 'Way too many';
}

// localStorage keeps data in this browser even after the page is closed.
// It only stores text, so the list is turned into JSON text and back.
// try/catch: if the browser blocks storage, the game still works, just without saving.
function loadScores() {
    try {
        const scores = JSON.parse(localStorage.getItem('doubly-leaderboard'));

        // Anyone can edit localStorage by hand in DevTools, so don't trust what comes back:
        // it must be a list, and each entry needs a text name and a whole-number round
        if (!Array.isArray(scores)) {
            return [];
        }
        return scores.filter(function(score) {
            return score && typeof score.name === 'string' &&
                Number.isInteger(score.round) && score.round >= 0;
        });
    } catch (error) {
        return [];
    }
}

function saveScores(scores) {
    try {
        localStorage.setItem('doubly-leaderboard', JSON.stringify(scores));
    } catch (error) {
        // Nothing to do; the score just won't be remembered
    }
}

function makeSpan(className, text) {
    const span = document.createElement('span');
    span.className = className;
    // textContent (not innerHTML) so a name like "<b>hi</b>" shows as plain text
    // instead of being run as HTML
    span.textContent = text;
    return span;
}

function showLeaderboard() {
    const scores = loadScores();

    leaderboardList.innerHTML = '';
    leaderboardEmpty.classList.toggle('hidden', scores.length > 0);

    scores.forEach(function(score, i) {
        const row = document.createElement('li');
        // The answer in round N was 2 to the power of N. Its digit count is
        // N × log10(2), rounded down, plus 1. That way we never build a giant number
        // just to count its digits (someone could edit their round to a billion).
        const digits = Math.floor(score.round * Math.log10(2)) + 1;
        row.append(
            makeSpan('score-rank', i + 1),
            makeSpan('score-name', score.name),
            makeSpan('score-rounds', score.round + ' rounds'),
            makeSpan('score-size', sizeName(digits))
        );
        leaderboardList.append(row);
    });
}

// While a popup is open, `inert` makes the whole game screen behind it unclickable
// and unreachable with Tab, so nobody can keep answering underneath the popup
function openPopup(popup) {
    popup.classList.remove('hidden');
    gameScreen.inert = true;
}

function closePopup(popup) {
    popup.classList.add('hidden');
    gameScreen.inert = false;
}

function openCelebration() {
    const cleared = round - 1;
    // toLocaleString adds the commas: 1024 -> "1,024"
    popupTitle.textContent = cleared + ' Rounds!';
    popupText.textContent = 'You doubled all the way to ' + number.toLocaleString() +
        '. That\'s ' + sizeName(number.toString().length) + '! Save your score, or keep grinding?';

    openPopup(celebration);
    nameInput.focus();
}

function resetGame() {
    round = 1;
    number = 1n;
    showQuestion();
    roundLabel.textContent = 'Round ' + round;
    message.textContent = '';
    answerInput.value = '';

    // Fresh game, fresh scratch paper
    pen.clearRect(0, 0, canvas.width, canvas.height);
    undoStack = [];
    redoStack = [];
    updateUndoRedo();
    scratch.classList.add('hidden');
}

function saveAndRestart() {
    // trim() removes spaces at the start and end, so "   " counts as empty
    const name = nameInput.value.trim() || 'Mystery player';
    const scores = loadScores();

    scores.push({ name: name, round: round - 1 });
    // Highest round first; keep only the top 10
    scores.sort(function(a, b) {
        return b.round - a.round;
    });
    saveScores(scores.slice(0, 10));

    closePopup(celebration);
    resetGame();
    showLeaderboard();
    gameScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    leaderboard.classList.remove('hidden'); // open it so they see their new score
}

function toggleLeaderboard() {
    leaderboard.classList.toggle('hidden');
}

leaderboardToggle.addEventListener('click', toggleLeaderboard);
leaderboardClose.addEventListener('click', toggleLeaderboard);

saveButton.addEventListener('click', saveAndRestart);

// ---------- Quit ----------

const quitButton = document.querySelector('#quit');
const quitConfirm = document.querySelector('#quit-confirm');
const quitYes = document.querySelector('#quit-yes');
const quitNo = document.querySelector('#quit-no');

quitButton.addEventListener('click', function() {
    openPopup(quitConfirm);
    // Focus the safe choice, so pressing Enter by accident doesn't throw the game away
    quitNo.focus();
});

quitNo.addEventListener('click', function() {
    closePopup(quitConfirm);
    answerInput.focus();
});

quitYes.addEventListener('click', function() {
    closePopup(quitConfirm);
    resetGame();
    gameScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
});

nameInput.addEventListener('keydown', function(event) {
    // event.repeat is true when a key is being HELD down. Without this check, holding
    // Enter on the last answer would carry over and instantly save as "Mystery player".
    if (event.key === 'Enter' && !event.repeat) {
        saveAndRestart();
    }
});

keepGoingButton.addEventListener('click', function() {
    closePopup(celebration);
    answerInput.focus();
});

// ---------- Escape key ----------

function isOpen(element) {
    return !element.classList.contains('hidden');
}

// Escape closes whatever is on top, one thing per press: popups first, then panels.
// .click() presses a button from code, so Escape does exactly what the button does.
document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') {
        return;
    }

    if (isOpen(quitConfirm)) {
        quitNo.click();
    } else if (isOpen(celebration)) {
        keepGoingButton.click();
    } else if (isOpen(scratch)) {
        toggleScratch();
    } else if (isOpen(leaderboard)) {
        toggleLeaderboard();
    }
});

showLeaderboard();
