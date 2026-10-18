// Poster pop-ups. A poster wrapped in <button class="popupTrigger" data-popups="a.jpg, b.webp, c.mp4">
// opens a full-screen layer and drops the first file at a random spot. While open:
//   - tap/click empty space to add the next file where you tapped
//     (shuffled order, no repeats until the whole set has been shown)
//   - drag a file to move it, anywhere including off-screen
//   - pinch (touch) or scroll/trackpad-pinch (desktop) to resize; two fingers also rotate
//   - tap a file to bring it to the front
//   - the xD SPACE nav button shrinks to its "x", which (or Esc) closes and clears everything
// Videos play muted on loop. The trigger listener sits on the document so cells the nD page
// inserts later work too.

const layer = document.createElement("div");
layer.className = "popupLayer";

// a fixed copy of the xD SPACE nav button that shrinks to its "x" and becomes the exit
const closeBtn = document.createElement("button");
closeBtn.type = "button";
closeBtn.className = "navButton popupClose";
closeBtn.setAttribute("aria-label", "Close");
closeBtn.hidden = true;
closeBtn.innerHTML =
    '<span class="popupCloseText"><span class="brandX">x</span><span class="brandName">D SPACE</span></span>';

const hint = document.createElement("p");
hint.className = "popupHint";
hint.textContent = "tap anywhere for more · drag to move · pinch or scroll to resize";

layer.append(hint);
document.body.append(layer, closeBtn);

const queues = new WeakMap(); // trigger -> files left to show, so each poster keeps its own order
const transforms = new WeakMap(); // pop-up -> { x, y, s, r }
let trigger = null; // poster that opened the layer
let round = 0; // bumps on close so a file still loading from before is dropped
let z = 0; // last z-index handed out, so the newest/touched file sits on top

function shuffled(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function nextSrc() {
    let queue = queues.get(trigger);
    if (!queue?.length) {
        queue = shuffled(trigger.dataset.popups.split(",").map((s) => s.trim()).filter(Boolean));
        queues.set(trigger, queue);
    }
    return queue.pop();
}

function apply(el) {
    const t = transforms.get(el);
    el.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.r}deg) scale(${t.s})`;
}

// at = { x, y } centres the file on a tap; without it the spot is random
function place(el, naturalW, naturalH, at) {
    // size by the longest edge so landscape and portrait files look equally big:
    // 40–60% of the smaller screen side, or 45–65% on phones; starts fully on screen
    const side = Math.min(innerWidth, innerHeight);
    const range = innerWidth < 600 ? [0.45, 0.65] : [0.4, 0.6];
    const longest = side * (range[0] + Math.random() * (range[1] - range[0]));
    const ratio = naturalH / naturalW;
    let w = ratio > 1 ? longest / ratio : longest;
    w = Math.min(w, innerWidth - 16, (innerHeight - 16) / ratio);
    const h = w * ratio;
    el.style.width = `${w}px`;
    el.style.zIndex = ++z;
    transforms.set(el, {
        x: at ? at.x - w / 2 : Math.random() * Math.max(0, innerWidth - w),
        y: at ? at.y - h / 2 : Math.random() * Math.max(0, innerHeight - h),
        s: 1,
        r: (Math.random() - 0.5) * 12,
    });
    apply(el);
    layer.append(el);
}

function addPopup(at) {
    const src = nextSrc();
    const thisRound = round;
    if (/\.(mp4|webm)$/i.test(src)) {
        const video = document.createElement("video");
        Object.assign(video, { muted: true, loop: true, autoplay: true, playsInline: true });
        video.className = "popup";
        video.onloadedmetadata = () =>
            thisRound === round && place(video, video.videoWidth, video.videoHeight, at);
        video.src = src;
    } else {
        const img = new Image();
        img.className = "popup";
        img.alt = "";
        img.draggable = false;
        img.onload = () => thisRound === round && place(img, img.naturalWidth, img.naturalHeight, at);
        img.src = src;
    }
}

// --- xD SPACE button <-> x morph ---
// The copy's box (left, width) and its text (left) animate with the same timing in
// opposite directions, so the text stays put on screen while the box shrinks around the x.

const MORPH_MS = 400;
let home = null; // the real nav button, hidden while its copy is out
let expanded = null; // the copy's box when it matches the real button
let morphDone = 0; // timer that hides the copy once it has grown back

function setBox(left, width, textLeft) {
    closeBtn.style.setProperty("--bx", `${left}px`);
    closeBtn.style.setProperty("--bw", `${width}px`);
    closeBtn.style.setProperty("--tx", `${textLeft}px`);
}

function shrinkHome() {
    clearTimeout(morphDone);
    home = document.querySelector('.navBar a[href="xdspace.html"]');
    const b = home.getBoundingClientRect();
    // where the button sits with the page scrolled to the top, so it's reachable from anywhere
    closeBtn.style.top = `${b.top + scrollY}px`;
    closeBtn.style.height = `${b.height}px`;
    closeBtn.style.setProperty("--ty", "0px");
    setBox(b.left, b.width, 0);
    closeBtn.classList.add("instant"); // no transitions while lining up the start state
    closeBtn.classList.remove("collapsed");
    closeBtn.hidden = false;
    // line the copy's x up exactly with the real one, then hide the real button
    const realX = home.querySelector("#logox").getBoundingClientRect();
    const copyX = closeBtn.querySelector(".brandX").getBoundingClientRect();
    const tx = realX.left - copyX.left;
    // the copy is fixed at the unscrolled spot, so add the scroll back when comparing heights
    closeBtn.style.setProperty("--ty", `${realX.top + scrollY - copyX.top}px`);
    expanded = { left: b.left, width: b.width, textLeft: tx };
    setBox(b.left, b.width, tx);
    home.style.visibility = "hidden";
    void closeBtn.offsetWidth; // commit the start state so the change below animates
    closeBtn.classList.remove("instant");
    // shrink to a square centred on the x
    const size = b.height;
    const left = realX.left + realX.width / 2 - size / 2;
    setBox(left, size, tx + b.left - left);
    closeBtn.classList.add("collapsed");
}

function growHome() {
    setBox(expanded.left, expanded.width, expanded.textLeft);
    closeBtn.classList.remove("collapsed");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    morphDone = setTimeout(() => {
        closeBtn.hidden = true;
        home.style.visibility = "";
    }, reduced ? 0 : MORPH_MS);
}

function open(t) {
    trigger = t;
    document.body.classList.add("popupsOpen");
    shrinkHome();
    closeBtn.focus();
    addPopup();
}

function close() {
    round++;
    layer.querySelectorAll(".popup").forEach((el) => el.remove());
    document.body.classList.remove("popupsOpen");
    growHome();
    trigger?.focus();
    trigger = null;
}

document.addEventListener("click", (e) => {
    const t = e.target.closest(".popupTrigger");
    if (t) open(t);
});

closeBtn.addEventListener("click", close);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && trigger) close();
});

// --- gestures: one pointer moves, two pointers move + scale + rotate ---

const pointers = new Map(); // pointerId -> { x, y }
let target = null; // pop-up being handled, or null for empty space
let start = null; // snapshot when the current gesture (re)started
let moved = false; // a tap only counts if the pointer barely moved

function snapshot() {
    const [a, b] = [...pointers.values()];
    start = { a, t: target && { ...transforms.get(target) } };
    if (b) {
        start.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        start.dist = Math.hypot(b.x - a.x, b.y - a.y);
        start.angle = Math.atan2(b.y - a.y, b.x - a.x);
    }
}

layer.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".popup");
    if (pointers.size === 0) {
        target = el;
        moved = false;
        if (el) el.style.zIndex = ++z;
    } else if (el !== target) {
        return; // a second finger only counts on the same file
    }
    try {
        layer.setPointerCapture(e.pointerId); // keep getting moves if the finger leaves the file
    } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot();
});

layer.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pointers.values()];
    if (Math.hypot(a.x - start.a.x, a.y - start.a.y) > 6 || b) moved = true;
    if (!target) return;
    const t = transforms.get(target);
    if (b) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        t.x = start.t.x + mid.x - start.mid.x;
        t.y = start.t.y + mid.y - start.mid.y;
        t.s = Math.min(8, Math.max(0.15, start.t.s * (Math.hypot(b.x - a.x, b.y - a.y) / start.dist)));
        t.r = start.t.r + (Math.atan2(b.y - a.y, b.x - a.x) - start.angle) * (180 / Math.PI);
    } else {
        t.x = start.t.x + a.x - start.a.x;
        t.y = start.t.y + a.y - start.a.y;
    }
    apply(target);
});

function endPointer(e) {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size) return snapshot(); // one finger lifted mid-pinch: carry on dragging
    if (!moved && !target && e.type === "pointerup") addPopup({ x: e.clientX, y: e.clientY });
    target = null;
}
layer.addEventListener("pointerup", endPointer);
layer.addEventListener("pointercancel", endPointer);

// mouse wheel and trackpad pinch resize the file under the cursor
layer.addEventListener(
    "wheel",
    (e) => {
        const el = e.target.closest(".popup");
        if (!el) return;
        e.preventDefault();
        const t = transforms.get(el);
        t.s = Math.min(8, Math.max(0.15, t.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
        apply(el);
    },
    { passive: false },
);
