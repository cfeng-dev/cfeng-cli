// ---------- TAB completion ----------
(function () {
    // State between consecutive Tab presses
    const tabState = {
        base: null, // string being completed (the current token)
        full: null, // full input line
        start: 0, // start index of token in input
        end: 0, // end index of token in input
        matches: [], // list of candidates
        idx: -1, // current index for cycling
    };

    // Try to locate the currently focused input element in the terminal
    function getInputEl() {
        // Adjust selectors to match your Shell input element
        return $("#terminal input[type='text'], #terminal .cmdline, #terminal .prompt-input").filter(":focus").get(0);
    }

    // Caret utilities
    function getCaret(el) {
        return el.selectionStart || 0;
    }
    function setCaret(el, pos) {
        el.setSelectionRange(pos, pos);
    }

    // Helpers
    const isDir = (name) => Object.prototype.hasOwnProperty.call(struct, name);
    const hasExt = (name, ext) => name.toLowerCase().endsWith(ext);
    const uniq = (arr) => Array.from(new Set(arr));
    const ARG_HINTS = {
        last: ["reboot"], // arguments for the `last` command
        help: () => Object.keys(commands), // example: list all commands for `help`
    };

    // Helper: normalize source (array or function) into a candidate list
    function argCandidatesFor(cmd, prefix) {
        const src = ARG_HINTS[cmd];
        if (!src) return [];
        const list = typeof src === "function" ? src(prefix) : src;
        const p = (prefix || "").toLowerCase();
        return list.filter((x) => x.toLowerCase().startsWith(p));
    }

    // Collect candidates depending on context
    function candidatesFor(token, contextCmd) {
        // Token may be a path fragment like "skills/pr" or "./la"
        let dirPart = "";
        let basePart = token;
        const slashIdx = token.lastIndexOf("/");

        if (slashIdx >= 0) {
            dirPart = token.slice(0, slashIdx);
            basePart = token.slice(slashIdx + 1);
        }

        const currDir = getDirectory() || "root";
        let dir = dirPart || "";
        if (dir === "" || dir === ".") dir = currDir;
        else if (dir === "..") dir = "root";
        else if (!isDir(dir)) return [];

        let pool = [];
        if (contextCmd === "cat") {
            // only files (*.txt) in this folder
            pool = (struct[dir] || []).filter((x) => !isDir(x)).map((x) => `${x}.txt`);
        } else {
            // only directories
            pool = (struct[dir] || []).filter((x) => isDir(x));
        }

        // filter by prefix
        const filtered = pool.filter((name) => name.toLowerCase().startsWith(basePart.toLowerCase()));
        const prefix = dirPart ? dirPart + "/" : "";
        return filtered.map((x) => prefix + x);
    }

    // Command candidates (first token)
    function commandCandidates(prefix) {
        return Object.keys(commands).filter((c) => c.startsWith(prefix));
    }

    // Longest common prefix
    function commonPrefix(strings) {
        if (!strings.length) return "";
        let pref = strings[0];
        for (let s of strings.slice(1)) {
            let i = 0;
            while (i < pref.length && i < s.length && pref[i].toLowerCase() === s[i].toLowerCase()) i++;
            pref = pref.slice(0, i);
            if (!pref) break;
        }
        return pref;
    }

    // Split input into (command, current token around cursor)
    function extractContext(inputVal, caretPos) {
        const left = inputVal.slice(0, caretPos);
        const right = inputVal.slice(caretPos);

        const leftBoundary = left.lastIndexOf(" ") + 1;
        const rightSpace = right.indexOf(" ");
        const rightBoundary = rightSpace === -1 ? inputVal.length : caretPos + rightSpace;

        const token = inputVal.slice(leftBoundary, rightBoundary);
        const before = inputVal.slice(0, leftBoundary);
        const after = inputVal.slice(rightBoundary);

        const firstSpace = inputVal.indexOf(" ");
        const cmd = (firstSpace === -1 ? inputVal : inputVal.slice(0, firstSpace)).trim();

        const cursorInFirst = caretPos <= (firstSpace === -1 ? inputVal.length : firstSpace);

        return {
            cmd: cursorInFirst ? null : cmd,
            token,
            tokenStart: leftBoundary,
            tokenEnd: rightBoundary,
            before,
            after,
        };
    }

    function resetTabState() {
        tabState.base = null;
        tabState.full = null;
        tabState.start = 0;
        tabState.end = 0;
        tabState.matches = [];
        tabState.idx = -1;
    }

    function applyCompletion(el, replacement, start, end) {
        const v = el.value;
        const newVal = v.slice(0, start) + replacement + v.slice(end);
        el.value = newVal;
        const newCaret = start + replacement.length;
        setCaret(el, newCaret);
    }

    function handleTab(e) {
        const el = getInputEl();
        if (!el) return;

        const val = el.value || "";
        const caret = getCaret(el);
        const fresh = tabState.full !== val;
        if (fresh) resetTabState();

        const { cmd, token, tokenStart, tokenEnd } = extractContext(val, caret);
        const atLineStart = cmd === null;

        let cands = [];
        if (atLineStart) {
            cands = commandCandidates(token);
        } else {
            const normalizedCmd = cmd.trim().toLowerCase();

            // 1) Check for command-specific argument completions first
            const special = argCandidatesFor(normalizedCmd, token);
            if (special.length) {
                cands = special;
            } else {
                // 2) Fallback to the existing modes (cat / dir / generic)
                const mode = normalizedCmd === "cat" ? "cat" : ["cd", "ls", "tree"].includes(normalizedCmd) ? "dir" : "generic";

                if (mode === "cat") {
                    // Only file candidates (*.txt) for `cat`
                    cands = candidatesFor(token, "cat");
                } else if (mode === "dir") {
                    // Only directory candidates for cd/ls/tree
                    cands = candidatesFor(token, "dir");
                } else {
                    // Generic mode: dirs + (optionally) files if token ends with .txt
                    const asDir = candidatesFor(token, "dir");
                    const asFile = hasExt(token, ".txt") ? candidatesFor(token, "cat") : [];
                    cands = uniq([...asDir, ...asFile]);
                }
            }
        }

        if (!cands.length) {
            resetTabState();
            return;
        }

        const cp = commonPrefix(cands);
        if (fresh && cp && cp.length > token.length) {
            applyCompletion(el, cp, tokenStart, tokenEnd);
            tabState.full = el.value;
            tabState.base = cp;
            tabState.start = tokenStart;
            tabState.end = tokenStart + cp.length;
            tabState.matches = cands;
            tabState.idx = -1;
            return;
        }

        if (tabState.matches.length && !fresh) {
            const dir = e.shiftKey ? -1 : 1;
            tabState.idx = (tabState.idx + dir + tabState.matches.length) % tabState.matches.length;
            const pick = tabState.matches[tabState.idx];
            applyCompletion(el, pick, tabState.start, tabState.end);
            tabState.full = el.value;
            tabState.end = tabState.start + pick.length;
            return;
        }

        // First Tab press without common prefix → pick the first match
        tabState.base = token;
        tabState.full = val;
        tabState.start = tokenStart;
        tabState.end = tokenEnd;
        tabState.matches = cands;
        tabState.idx = 0;
        const first = cands[0];
        applyCompletion(el, first, tokenStart, tokenEnd);
        tabState.full = el.value;
        tabState.end = tabState.start + first.length;
    }

    // Register keyboard handler
    $(document).on("keydown", function (e) {
        if (e.key === "Tab") {
            const el = getInputEl();
            if (!el) return;
            e.preventDefault();
            handleTab(e);
        } else {
            const el = getInputEl();
            if (el) resetTabState();
        }
    });
})();
