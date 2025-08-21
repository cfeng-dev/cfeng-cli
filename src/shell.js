/* global $, localStorage */

// Put caret (text cursor) at the end of a contenteditable element
function setCaretToEnd(el) {
    // Safety: if element is not found, skip
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false); // move to end
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

class Shell {
    constructor(term, commands) {
        // Store dependencies
        this.commands = commands;
        this.term = term;

        // Initialize state in localStorage
        // Use array for history; flags as string for consistency with comparisons
        localStorage.directory = "root";
        localStorage.history = JSON.stringify([]);
        localStorage.historyIndex = -1;
        localStorage.inHistory = "false";
        localStorage.goingThroughHistory = "false";

        // Wire up DOM event listeners
        this.setupListeners(term);

        // Focus input on boot
        $(".input").focus();
    }

    setupListeners(term) {
        // Keep focus in the last input when clicking terminal area
        $("#terminal").on("mouseup", () => $(".input").last().focus());

        // Handle Up/Down for history navigation
        term.addEventListener("keyup", (evt) => {
            const keyUp = 38;
            const keyDown = 40;
            const key = evt.keyCode;

            if (key === keyUp || key === keyDown) {
                let history = localStorage.history ? JSON.parse(localStorage.history) : [];

                if (key === keyUp) {
                    // Navigate backward through history
                    const history = localStorage.history ? JSON.parse(localStorage.history) : [];
                    if (!history.length) return;

                    // If not currently traversing: enter history at the "end" (one past the last)
                    if (localStorage.inHistory === "false") {
                        localStorage.inHistory = "true";
                        localStorage.historyIndex = String(history.length - 1); // show last entry first
                    } else {
                        // Already traversing: move one step back if possible
                        const idxNow = Number(localStorage.historyIndex);
                        if (idxNow > 0) {
                            localStorage.historyIndex = String(idxNow - 1);
                        }
                    }

                    const idx = Number(localStorage.historyIndex);
                    const text = history[idx] ?? "";
                    const $inp = $(".input").last();
                    $inp.text(text);
                    setCaretToEnd($inp.get(0));
                } else if (key === keyDown) {
                    // Navigate forward through history
                    if (localStorage.inHistory === "true") {
                        const history = localStorage.history ? JSON.parse(localStorage.history) : [];
                        let idx = Number(localStorage.historyIndex);

                        // If we are at the newest entry: clear input and LEAVE history (end state)
                        if (idx >= history.length - 1) {
                            const $inp = $(".input").last();
                            $inp.text("");
                            setCaretToEnd($inp.get(0));
                            localStorage.inHistory = "false";
                            localStorage.historyIndex = String(history.length); // one past the last
                            return;
                        }

                        // Otherwise go one step forward
                        idx += 1;
                        localStorage.historyIndex = String(idx);

                        const text = history[idx] ?? "";
                        const $inp = $(".input").last();
                        $inp.text(text);
                        setCaretToEnd($inp.get(0));
                    }
                }

                // Prevent default arrow scrolling inside contenteditable
                evt.preventDefault();
            }
        });

        // Handle special keys: Tab, Esc, Backspace/Delete, Ctrl+U, Ctrl+K
        term.addEventListener("keydown", (evt) => {
            // 9: Tab, 27: Esc, 8: Backspace, 46: Delete
            if (evt.keyCode === 9) {
                // Prevent focus jump on Tab
                evt.preventDefault();
            } else if (evt.keyCode === 27) {
                // Toggle fullscreen on Esc
                $(".terminal-window").toggleClass("fullscreen");
            } else if (evt.keyCode === 8 || evt.keyCode === 46) {
                // Reset history pointer when editing
                this.resetHistoryIndex();
            }

            // Ctrl+U (clear line before cursor)
            if (evt.ctrlKey && evt.key.toLowerCase() === "u") {
                evt.preventDefault();
                const $inp = $(".input").last();
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                const cursorPos = range.startOffset;

                const text = $inp.text();
                // Remove everything before cursor
                $inp.text(text.slice(cursorPos));

                // Move caret to beginning
                const node = $inp.get(0).firstChild || $inp.get(0);
                sel.collapse(node, 0);
            }

            // Ctrl+K (clear line after cursor)
            if (evt.ctrlKey && evt.key.toLowerCase() === "k") {
                evt.preventDefault();
                const $inp = $(".input").last();
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                const cursorPos = range.startOffset;

                const text = $inp.text();
                // Remove everything after cursor
                $inp.text(text.slice(0, cursorPos));

                // Move caret to end
                const node = $inp.get(0).firstChild || $inp.get(0);
                sel.collapse(node, cursorPos);
            }
        });

        // Handle Enter for command execution
        term.addEventListener("keypress", (evt) => {
            // Skip for control keys in Firefox (arrow/tab)
            if (![9, 27, 37, 38, 39, 40].includes(evt.keyCode)) {
                // Any printable input resets history traversal state
                this.resetHistoryIndex();
            }

            if (evt.keyCode === 13) {
                const prompt = evt.target;
                // Split into command + arg (single-arg model; simple and matches current handlers)
                const parts = prompt.textContent.trim().split(/\s+/);
                const cmd = (parts[0] || "").toLowerCase();
                const arg = parts.slice(1).join(" ").trim(); // allow multi-word args if needed later

                if (cmd === "clear") {
                    this.updateHistory(cmd);
                    this.clearConsole();
                } else if (cmd && Object.prototype.hasOwnProperty.call(this.commands, cmd)) {
                    this.runCommand(cmd, arg);
                    this.resetPrompt(term, prompt);
                    $(".root").last().text(localStorage.directory);
                } else {
                    this.term.innerHTML += "Error: command not recognized";
                    this.resetPrompt(term, prompt);
                }
                evt.preventDefault();
            }
        });
    }

    runCommand(cmd, args) {
        // Store the executed command in history
        const command = args ? `${cmd} ${args}` : cmd;
        this.updateHistory(command);

        // Execute and render output if any
        const output = this.commands[cmd](args);
        if (output) {
            this.term.innerHTML += output;
        }
    }

    resetPrompt(term, prompt) {
        // Clone the current prompt block and freeze the previous input
        const newPrompt = prompt.parentNode.cloneNode(true);
        prompt.setAttribute("contenteditable", false);

        if (this.prompt) {
            // Allow overriding the prompt label if needed
            newPrompt.querySelector(".prompt").textContent = this.prompt;
        }

        term.appendChild(newPrompt);
        const input = newPrompt.querySelector(".input");
        input.innerHTML = "";
        input.focus();
    }

    resetHistoryIndex() {
        // Reset pointer to "end" (outside history)
        const history = localStorage.history ? JSON.parse(localStorage.history) : [];
        localStorage.inHistory = "false";
        localStorage.historyIndex = String(history.length); // one past the last
    }

    updateHistory(command) {
        // Append and reset pointer to "end" (outside history)
        let history = localStorage.history ? JSON.parse(localStorage.history) : [];
        history.push(command);
        localStorage.history = JSON.stringify(history);
        localStorage.inHistory = "false";
        localStorage.historyIndex = String(history.length); // one past the last
    }

    clearConsole() {
        // Reset the terminal output to a fresh prompt while keeping the current directory
        const dir = localStorage.directory;
        $("#terminal").html(
            `<p class="hidden">
        <span class="prompt">
          <span class="root">${dir}</span>
          <span class="tick">$</span>
        </span>
        <span contenteditable="true" class="input" spellcheck="false"></span>
      </p>`
        );
        $(".input").focus();
    }
}

// --- Display deployment time locally ---
document.addEventListener("DOMContentLoaded", () => {
    const deployEl = document.getElementById("deploy-time");
    if (deployEl && window.lastDeploy) {
        const utc = new Date(window.lastDeploy.replace(" UTC", "Z"));
        deployEl.textContent = utc.toLocaleString(); // Local time
    }
});
