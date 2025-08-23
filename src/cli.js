/* global $, localStorage, Shell */

// ---------- Errors ----------
const errors = {
    invalidDirectory: "Error: not a valid directory",
    noWriteAccess: "Error: you do not have write access to this directory",
    fileNotFound: "Error: file not found in current directory",
    fileNotSpecified: "Error: you did not specify a file",
    invalidFile: "Error: not a valid file",
    noSuchFileOrDirectory: "Error: no such file or directory",
};

// ---------- Virtual structure (directories & groupings) ----------
const struct = {
    root: ["about", "contact", "hobbies", "skills"],
    hobbies: ["sport", "cook", "travel", "movie", "gaming"],
    skills: ["programming", "software", "hardware", "iot", "language"],
};

// ---------- Commands registry ----------
const commands = {};
let systemData = {};
const rootPath = "users/cfeng/root"; // adjust as you like

// ---------- Directory helpers ----------
const getDirectory = () => localStorage.directory;
const setDirectory = (dir) => {
    localStorage.directory = dir;
};

// ---------- Window buttons ----------
const registerFullscreenToggle = () => {
    // Toggle fullscreen on green button
    $(".button.green").on("click", () => {
        $(".terminal-window").toggleClass("fullscreen");
    });
};
// const registerMinimizedToggle = () => {
//     // Toggle minimized on yellow button
//     $(".button.yellow").on("click", () => {
//         $(".terminal-window").toggleClass("minimized");
//     });
// };

// ---------- Mutating commands (disabled) ----------
commands.mkdir = () => errors.noWriteAccess;
commands.touch = () => errors.noWriteAccess;
commands.rm = () => errors.noWriteAccess;

// ---------- Read-only commands ----------

// List directory contents
commands.ls = (directory) => {
    // Return contents of requested or current directory
    const dirArg = (directory || "").trim();

    if (!dirArg || dirArg === ".") {
        return systemData[getDirectory()];
    }
    if (dirArg === ".." || dirArg === "~") {
        return systemData["root"];
    }
    if (dirArg in struct) {
        return systemData[dirArg];
    }
    return systemData[getDirectory()];
};

// Help / supported commands
commands.help = () => systemData.help;

// Print current path
commands.pwd = () => {
    const dir = getDirectory();
    return dir === "root" ? rootPath : `${rootPath}/${dir}`;
};

// Show current user
commands.whoami = () => {
    const variants = ["guest (who actually knows how to use Linux 👀)", "guest - surprisingly good at Linux", "guest@cfeng-cli  # knows more Linux than expected"];

    // Randomly return a variant
    const i = Math.floor(Math.random() * variants.length);
    return variants[i];
};

// Show hostname
commands.hostname = () => {
    return "Chin-I-Feng"; // adjust as you like
};

// Show command history with padded line numbers
commands.history = () => {
    let history = localStorage.history;
    history = history ? JSON.parse(history) : [];
    const width = String(history.length).length;

    return `<pre>${history.map((h, i) => String(i + 1).padStart(width, " ") + "  " + h).join("\n")}</pre>`;
};

// Change directory
commands.cd = (newDirectory) => {
    const dirs = Object.keys(struct);
    const currDir = getDirectory();
    const nd = (newDirectory || "").trim();

    // Back to root or ignore neutral args
    if (!nd || nd === "." || nd === "~" || (nd === ".." && dirs.includes(currDir))) {
        setDirectory("root");
        return null;
    }
    // Into a known directory
    if (dirs.includes(nd) && currDir !== nd) {
        setDirectory(nd);
        return null;
    }
    return errors.invalidDirectory;
};

// Read file contents
commands.cat = (filename) => {
    if (!filename) return errors.fileNotSpecified;

    const isDirectory = (name) => Object.prototype.hasOwnProperty.call(struct, name);
    const hasExt = (name, ext) => name.toLowerCase().endsWith(ext);
    const isPathLike = (name) => name.includes("/");
    const currDir = getDirectory() || "root";

    if (isDirectory(filename)) return errors.invalidFile;

    // --- Case A: relative in the current directory ---
    if (!isPathLike(filename)) {
        if (!hasExt(filename, ".txt")) return errors.invalidFile;
        const key = filename.slice(0, -4); // ohne .txt
        const entries = struct[currDir] || [];
        if (!entries.includes(key)) return errors.noSuchFileOrDirectory; // nicht in diesem Dir
        return key in systemData ? systemData[key] : errors.fileNotFound;
    }

    // --- Case B: Path like "skills/iot.txt" ---
    let [dir, ...rest] = filename.split("/");
    let base = rest.join("/");
    if (!hasExt(base, ".txt")) return errors.noSuchFileOrDirectory;

    // simple path normalization for ./ and .. (one level)
    if (dir === ".") dir = currDir;
    if (dir === "..") dir = "root";

    if (!isDirectory(dir)) return errors.noSuchFileOrDirectory;

    const fileKey = base.slice(0, -4);
    if (!(struct[dir] || []).includes(fileKey)) return errors.noSuchFileOrDirectory;
    return fileKey in systemData ? systemData[fileKey] : errors.fileNotFound;
};

// show the current date and time
commands.date = () => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    });
};

// ---------- last reboot command (deploy timestamp) ----------
// Format a Date in the user's local timezone
function formatLocal(dt) {
    const opts = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZoneName: "short",
    };
    return new Intl.DateTimeFormat(undefined, opts).format(dt);
}

// Parse "YYYY-MM-DD HH:mm:ss UTC" reliably and return a Date in local tz
function parseDeployUtcString(s) {
    // Strict regex for the expected format
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC$/.exec(s);
    if (!m) return null;
    const [, y, mo, d, h, mi, se] = m.map(Number);
    // Construct as UTC then return a local Date
    return new Date(Date.UTC(y, mo - 1, d, h, mi, se));
}

// show the date of the last site deployment
commands.last = (arg) => {
    // Supports "last reboot"
    if (arg && arg.toLowerCase() === "reboot") {
        if (window.lastDeploy) {
            const commit = (window.lastCommit || "").slice(0, 7) || "unknown";

            // Robust parse of "YYYY-MM-DD HH:mm:ss UTC"
            const dt = parseDeployUtcString(window.lastDeploy);

            if (dt && !isNaN(dt)) {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                return `Last site deploy: ${formatLocal(dt)} (${tz}) [commit ${commit}]`;
            }
            // Fallback: show raw value if parsing failed
            return `Last site deploy: ${window.lastDeploy} [commit ${commit}]`;
        }
        return "Last site deploy: not configured (missing deploy-info.js)";
    }
    return "Usage: last reboot";
};

// ---------- tree (directory tree with counts) ----------
(function () {
    const isDir = (name) => Object.prototype.hasOwnProperty.call(struct, name);

    function buildTreeLines(dir, prefix = "", counts) {
        const entries = (struct[dir] || []).slice();
        const lastIdx = entries.length - 1;
        const lines = [];

        entries.forEach((name, idx) => {
            const isLast = idx === lastIdx;
            const branch = isLast ? "└── " : "├── ";
            const nextPrefix = prefix + (isLast ? "    " : "│   ");

            if (isDir(name)) {
                counts.dirs += 1;
                lines.push(`${prefix}${branch}<span class="dir">${name}/</span>`);
                const childLines = buildTreeLines(name, nextPrefix, counts);
                lines.push(...childLines);
            } else {
                counts.files += 1;
                lines.push(`${prefix}${branch}<span class="file">${name}.txt</span>`);
            }
        });

        return lines;
    }

    function renderTree(start = "root") {
        if (!isDir(start)) return errors.invalidDirectory;

        const counts = { dirs: 0, files: 0 };
        const lines = buildTreeLines(start, "", counts);
        const header = start === "root" ? "." : `./${start}`;
        const dirLbl = counts.dirs === 1 ? "directory" : "directories";
        const fileLbl = counts.files === 1 ? "file" : "files";
        const body = lines.length ? `\n${lines.join("\n")}\n\n` : `\n\n`;
        const summary = `${counts.dirs} ${dirLbl}, ${counts.files} ${fileLbl}`;

        return `<pre class="tree">${header}${body}${summary}</pre>`;
    }

    commands.tree = (arg) => {
        const d = (arg || "").trim();
        if (!d || d === "." || d === "~") return renderTree("root");
        if (!isDir(d)) return errors.invalidDirectory;
        return renderTree(d);
    };
})();

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
            const mode = normalizedCmd === "cat" ? "cat" : ["cd", "ls", "tree"].includes(normalizedCmd) ? "dir" : "generic";
            if (mode === "generic") {
                const asDir = candidatesFor(token, "dir");
                const asFile = hasExt(token, ".txt") ? candidatesFor(token, "cat") : [];
                cands = uniq([...asDir, ...asFile]);
            } else if (mode === "cat") {
                cands = candidatesFor(token, "cat");
            } else {
                cands = candidatesFor(token, "dir");
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

// ---------- Bootstrap / Init ----------
$(() => {
    registerFullscreenToggle();
    // registerMinimizedToggle();

    const cmd = document.getElementById("terminal");

    // Set default directory (if not already set)
    if (!getDirectory()) setDirectory("root");

    // Disable AJAX cache to always fetch fresh pages
    $.ajaxSetup({ cache: false });

    // Fetch page fragments concurrently
    const pages = [
        $.get("pages/about.html"),
        $.get("pages/contact.html"),
        $.get("pages/help.html"),
        $.get("pages/root.html"),
        $.get("pages/skills.html"),
        $.get("pages/programming.html"),
        $.get("pages/software.html"),
        $.get("pages/hardware.html"),
        $.get("pages/iot.html"),
        $.get("pages/language.html"),
        $.get("pages/hobbies.html"),
        $.get("pages/sport.html"),
        $.get("pages/cook.html"),
        $.get("pages/travel.html"),
        $.get("pages/movie.html"),
        $.get("pages/gaming.html"),
    ];

    $.when
        .apply($, pages)
        .done(
            (
                aboutData,
                contactData,
                helpData,
                rootData,
                skillsData,
                programmingData,
                softwareData,
                hardwareData,
                iotData,
                languageData,
                hobbiesData,
                sportData,
                cookData,
                travelData,
                movieData,
                gamingData
            ) => {
                systemData.about = aboutData[0];
                systemData.contact = contactData[0];
                systemData.help = helpData[0];
                systemData.root = rootData[0];
                systemData.skills = skillsData[0];
                systemData.programming = programmingData[0];
                systemData.software = softwareData[0];
                systemData.hardware = hardwareData[0];
                systemData.iot = iotData[0];
                systemData.language = languageData[0];

                systemData.hobbies = hobbiesData[0];
                systemData.sport = sportData[0];
                systemData.cook = cookData[0];
                systemData.travel = travelData[0];
                systemData.movie = movieData[0];
                systemData.gaming = gamingData[0];

                // Start terminal after everything is mapped
                const terminal = new Shell(cmd, commands);
            }
        );
});
