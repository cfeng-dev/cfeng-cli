// === Footer year ===
document.addEventListener("DOMContentLoaded", function () {
    const yearEl = document.getElementById("year");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
});

// === Cursor focus effect ===
document.addEventListener("DOMContentLoaded", () => {
    const line = document.querySelector(".prompt-line");
    const input = document.querySelector(".cli-input");

    if (line && input) {
        line.addEventListener(
            "pointerdown",
            () => {
                input.focus();
                const v = input.value;
                input.setSelectionRange(v.length, v.length);
            },
            { passive: true }
        );
    }
});
