(() => {
  const svg = document.getElementById('staffSvg');
  const staffLayer = document.getElementById('staffLayer');
  const noteLayer = document.getElementById('noteLayer');
  const overlayLayer = document.getElementById('overlayLayer');
  const answerEl = document.getElementById('answer');

  const clefModeEl = document.getElementById('clefMode');
  const namingEl = document.getElementById('naming');
  const questionMsEl = document.getElementById('questionMs');
  const answerMsEl = document.getElementById('answerMs');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const skipBtn = document.getElementById('skipBtn');

  // SVG geometry
  const W = 700;
  const H = 220;
  const marginLeft = 80; // for clef area
  const marginRight = 40;
  const staffTop = 60;
  const lineSpacing = 16; // distance between staff lines
  const stepsInStaff = 8; // bottom line (0) to top line (8)
  const stepHeight = lineSpacing / 2;
  const staffWidth = W - marginLeft - marginRight;
  const noteX = marginLeft + staffWidth * 0.55;

  const LETTERS = ['C','D','E','F','G','A','B'];
  const SOLFEGE = ['ド','レ','ミ','ファ','ソ','ラ','シ'];

  // Reference step numbers for bottom line of each clef
  // stepNumber = octave*7 + letterIndex(C=0, D=1, ... B=6)
  const REF = {
    treble: { bottomLineStep: 4*7 + 2 }, // E4 bottom line
    bass:   { bottomLineStep: 2*7 + 4 }, // G2 bottom line
  };

  // Ranges (inclusive) in stepNumber for randomization
  const RANGE = {
    treble: { min: 4*7 + 0, max: 5*7 + 5 }, // C4 .. A5
    bass:   { min: 2*7 + 2, max: 4*7 + 0 }, // E2 .. C4
  };

  let running = false;
  let currentTimer = null;
  let showingAnswer = false;
  let current = null; // { clef, stepNumber, letterIndex, octave, stepIndex }

  function clearGroup(g){
    while (g.firstChild) g.removeChild(g.firstChild);
  }

  function lineY(lineIndex /*0..4*/){
    return staffTop + (4 - lineIndex) * lineSpacing;
  }

  function stepToY(stepIndex /* bottom line=0, top line=8 */){
    const bottomY = lineY(0); // bottom line
    return bottomY - stepIndex * stepHeight;
  }

  function drawStaff(clef){
    clearGroup(staffLayer);

    // Staff lines
    for (let i=0; i<5; i++){
      const y = lineY(i);
      const line = el('line', {
        x1: marginLeft, y1: y,
        x2: marginLeft + staffWidth, y2: y,
        class: 'staff-line'
      });
      staffLayer.appendChild(line);
    }

    // Clef symbol area
    const clefGroup = el('g', {});
    const clefText = el('text', {
      x: marginLeft - 40,
      y: lineY(2),
      class: 'clef-symbol',
      'text-anchor': 'middle'
    });
    clefText.textContent = clef === 'treble' ? '𝄞' : '𝄢'; // may depend on font support
    clefGroup.appendChild(clefText);

    // Fallback label
    const label = el('text', {
      x: marginLeft - 40,
      y: lineY(2) + 46,
      class: 'clef-label',
      'text-anchor': 'middle'
    });
    label.textContent = clef === 'treble' ? 'Treble' : 'Bass';
    clefGroup.appendChild(label);

    staffLayer.appendChild(clefGroup);
  }

  function el(name, attrs){
    const n = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const k in attrs){
      n.setAttribute(k, String(attrs[k]));
    }
    return n;
  }

  function pickClef(){
    const mode = clefModeEl.value;
    if (mode === 'treble' || mode === 'bass') return mode;
    return Math.random() < 0.5 ? 'treble' : 'bass';
  }

  function randomInt(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function fromStepNumber(stepNumber){
    const octave = Math.floor(stepNumber / 7);
    const letterIndex = stepNumber % 7;
    return { octave, letterIndex };
  }

  function getRandomNote(clef){
    const r = RANGE[clef];
    const stepNumber = randomInt(r.min, r.max);
    const { octave, letterIndex } = fromStepNumber(stepNumber);
    const ref = REF[clef];
    const stepIndex = stepNumber - ref.bottomLineStep; // 0..8 inside staff; can be outside
    return { clef, stepNumber, octave, letterIndex, stepIndex };
  }

  function drawNote(note){
    clearGroup(noteLayer);
    clearGroup(overlayLayer);

    // Ledger lines if needed (outside 0..8 and on line positions)
    const s = note.stepIndex;
    const ledgerXs = [noteX - 22, noteX + 22];

    if (s < 0){
      let li = (s % 2 === 0) ? s : s - 1; // even downwards
      for (; li <= -2; li += 2){
        const y = stepToY(li);
        overlayLayer.appendChild(el('line', {
          x1: ledgerXs[0], y1: y, x2: ledgerXs[1], y2: y, class: 'ledger-line'
        }));
      }
    } else if (s > 8){
      let li = (s % 2 === 0) ? s : s + 1; // even upwards
      for (; li >= 10; li -= 2){
        const y = stepToY(li);
        overlayLayer.appendChild(el('line', {
          x1: ledgerXs[0], y1: y, x2: ledgerXs[1], y2: y, class: 'ledger-line'
        }));
      }
    }

    // Note head
    const y = stepToY(s);
    const head = el('ellipse', {
      cx: noteX,
      cy: y,
      rx: 9,
      ry: 6.5,
      transform: `rotate(-20 ${noteX} ${y})`,
      class: 'note-head'
    });
    noteLayer.appendChild(head);

    // If on ledger line itself, add small central ledger (common practice)
    if ((s < 0 || s > 8) && s % 2 === 0){
      overlayLayer.appendChild(el('line', {
        x1: noteX - 14, y1: y, x2: noteX + 14, y2: y, class: 'ledger-line'
      }));
    }
  }

  function noteName(note){
    const style = namingEl.value; // 'letter' | 'solfege'
    const letter = LETTERS[note.letterIndex];
    const solfe = SOLFEGE[note.letterIndex];
    const text = style === 'letter' ? letter : solfe;
    return `${text}${note.octave}`;
  }

  function showQuestion(){
    const clef = pickClef();
    drawStaff(clef);
    current = getRandomNote(clef);
    drawNote(current);
    answerEl.textContent = ' ';
    showingAnswer = false;
  }

  function showAnswer(){
    if (!current) return;
    answerEl.textContent = noteName(current);
    showingAnswer = true;
  }

  function msFromInputs(){
    const q = Math.max(0.1, parseFloat(questionMsEl.value) || 2.0) * 1000;
    const a = Math.max(0.1, parseFloat(answerMsEl.value) || 1.0) * 1000;
    return { q, a };
  }

  function schedule(){
    clearTimer();
    if (!running) return;
    const { q, a } = msFromInputs();

    // Phase 1: question only
    showQuestion();
    currentTimer = setTimeout(() => {
      if (!running) return;
      // Phase 2: reveal answer
      showAnswer();
      currentTimer = setTimeout(() => {
        if (!running) return;
        schedule();
      }, a);
    }, q);
  }

  function clearTimer(){
    if (currentTimer){
      clearTimeout(currentTimer);
      currentTimer = null;
    }
  }

  function start(){
    if (running) return;
    running = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    skipBtn.disabled = false;
    schedule();
  }

  function stop(){
    running = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    skipBtn.disabled = true;
    clearTimer();
  }

  // Event handlers
  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
  skipBtn.addEventListener('click', () => {
    if (!running) return;
    if (!showingAnswer){
      // reveal immediately
      clearTimer();
      showAnswer();
    } else {
      // go next immediately
      schedule();
    }
  });

  // If user changes controls while running, apply next cycle immediately
  ;[clefModeEl, namingEl, questionMsEl, answerMsEl].forEach(elm => {
    elm.addEventListener('change', () => {
      if (!running) return;
      schedule();
    });
  });

  // Initial render
  drawStaff('treble');
  current = { clef: 'treble', stepNumber: 4*7 + 2, octave: 4, letterIndex: 2, stepIndex: 0 };
  drawNote(current);
  answerEl.textContent = '"開始" でスタート';
})();

