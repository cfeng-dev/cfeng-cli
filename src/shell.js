/* global $, localStorage */

// Helper: set caret to the end of an <input>
function setCaretToEndInput(inputEl) {
    if (!inputEl) return;
    const len = inputEl.value.length;
    inputEl.focus();
    try {
        inputEl.setSelectionRange(len, len);
    } catch (_) {}
}

class Shell {
    constructor(term, commands) {
        this.commands = commands;
        this.term = term;

        // Initialize local storage state
        localStorage.directory = "root";
        localStorage.history = JSON.stringify([]);
        localStorage.historyIndex = -1;
        localStorage.inHistory = "false";

        this.setupListeners(term);

        // Focus on the last input at startup
        $(".cli-input").last().trigger("focus");
    }

    setupListeners(term) {
        // Click inside terminal => focus on last input
        $("#terminal").on("mouseup", () => $(".cli-input").last().trigger("focus"));

        // ↑ / ↓ = history navigation
        term.addEventListener("keydown", (evt) => {
            const keyUp = 38,
                keyDown = 40;
            if (evt.keyCode !== keyUp && evt.keyCode !== keyDown) return;

            const $inp = $(".cli-input").last();
            const inp = $inp.get(0);
            let history = localStorage.history ? JSON.parse(localStorage.history) : [];
            if (!history.length) return;

            if (evt.keyCode === keyUp) {
                // Move up in history
                if (localStorage.inHistory === "false") {
                    localStorage.inHistory = "true";
                    localStorage.historyIndex = String(history.length - 1);
                } else {
                    const idxNow = Number(localStorage.historyIndex);
                    if (idxNow > 0) localStorage.historyIndex = String(idxNow - 1);
                }
            } else if (evt.keyCode === keyDown) {
                // Move down in history
                if (localStorage.inHistory === "true") {
                    let idx = Number(localStorage.historyIndex);
                    if (idx >= history.length - 1) {
                        $inp.val("");
                        localStorage.inHistory = "false";
                        localStorage.historyIndex = String(history.length);
                        setCaretToEndInput(inp);
                        evt.preventDefault();
                        return;
                    }
                    localStorage.historyIndex = String(idx + 1);
                }
            }

            const idx = Number(localStorage.historyIndex);
            $inp.val(history[idx] ?? "");
            setCaretToEndInput(inp);
            evt.preventDefault();
        });

        // Special keys: Tab / Esc / Backspace / Delete / Ctrl+U / Ctrl+K
        term.addEventListener("keydown", (evt) => {
            if (evt.keyCode === 9) {
                // Tab = prevent default browser behavior
                evt.preventDefault();
            } else if (evt.keyCode === 27) {
                // Esc = toggle fullscreen mode
                $(".terminal-window").toggleClass("fullscreen");
            } else if (evt.keyCode === 8 || evt.keyCode === 46) {
                // Backspace / Delete = reset history index
                this.resetHistoryIndex();
            }

            // Ctrl+U: delete everything before cursor
            if (evt.ctrlKey && evt.key.toLowerCase() === "u") {
                evt.preventDefault();
                const inp = $(".cli-input").last().get(0);
                const pos = inp.selectionStart ?? 0;
                const v = inp.value;
                inp.value = v.slice(pos);
                setCaretToEndInput(inp); // move to beginning
            }

            // Ctrl+K: delete everything after cursor
            if (evt.ctrlKey && evt.key.toLowerCase() === "k") {
                evt.preventDefault();
                const inp = $(".cli-input").last().get(0);
                const pos = inp.selectionStart ?? 0;
                const v = inp.value;
                inp.value = v.slice(0, pos);
                setCaretToEndInput(inp);
            }
        });

        // Enter = execute command
        term.addEventListener("keydown", (evt) => {
            if (evt.key !== "Enter") return;
            evt.preventDefault();

            const inputEl = document.activeElement?.classList?.contains("cli-input") ? document.activeElement : $(".cli-input").last().get(0);
            if (!inputEl) return;

            const parts = inputEl.value.trim().split(/\s+/);
            const cmd = (parts[0] || "").toLowerCase();
            const arg = parts.slice(1).join(" ").trim();

            if (cmd === "clear") {
                this.updateHistory(cmd);
                this.clearConsole();
            } else if (cmd && Object.prototype.hasOwnProperty.call(this.commands, cmd)) {
                this.runCommand(cmd, arg);
                this.resetPrompt(term, inputEl); // <— wichtig: altes Input übergeben
                $(".root").last().text(localStorage.directory);
            } else if (cmd) {
                const errEl = document.createElement("p");
                errEl.textContent = "Error: command not recognized";
                this.term.appendChild(errEl);

                this.resetPrompt(term, inputEl);
            }
        });
    }

    runCommand(cmd, args) {
        const command = args ? `${cmd} ${args}` : cmd;
        this.updateHistory(command);

        const output = this.commands[cmd](args);
        if (output) {
            const outEl = document.createElement("div");
            outEl.className = "command-output";
            outEl.innerHTML = typeof output === "string" ? output : `<p>${String(output)}</p>`;
            this.term.appendChild(outEl);
        }
    }

    resetPrompt(term, oldInput) {
        oldInput.readOnly = true; // keeps visible but not editable
        oldInput.blur();

        const dir = localStorage.directory;
        const newLine = document.createElement("p");
        newLine.className = "prompt-line";
        newLine.innerHTML = `
            <span class="prompt">
                <span class="root">${dir}</span>
                <span class="tick">❯</span>
            </span>
            <input class="cli-input command_input" type="text" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">`;
        term.appendChild(newLine);

        const newInput = newLine.querySelector(".cli-input");
        newInput.value = "";
        newInput.focus();
    }

    resetHistoryIndex() {
        const history = localStorage.history ? JSON.parse(localStorage.history) : [];
        localStorage.inHistory = "false";
        localStorage.historyIndex = String(history.length);
    }

    updateHistory(command) {
        let history = localStorage.history ? JSON.parse(localStorage.history) : [];
        history.push(command);
        localStorage.history = JSON.stringify(history);
        localStorage.inHistory = "false";
        localStorage.historyIndex = String(history.length);
    }

    clearConsole() {
        const dir = localStorage.directory;
        $("#terminal").html(
            `<p class="prompt-line">
                <span class="prompt">
                    <span class="root">${dir}</span>
                    <span class="tick">❯</span>
                </span>
                <input class="cli-input command_input" type="text" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">
            </p>`
        );
        $(".cli-input").last().trigger("focus");
    }
}
