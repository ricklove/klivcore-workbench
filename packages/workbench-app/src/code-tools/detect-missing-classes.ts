/**
 * Module-level cache to store state between function calls.
 */
const cacheState = {
  validClasses: new Set<string>(),
  reportedMissingClasses: new Set<string>(),
  lastSheetCount: 0,
  lastScanTime: 0,
  cacheDuration: 2000,
};

interface DetectOptions {
  /** If true, re-scans CSS even if the stylesheet count hasn't changed. */
  forceRefreshCSS?: boolean;
  /**
   * If true, prevents logging the same missing class multiple times across different runs.
   * Default: false (reports everything every time).
   */
  onlyReportNew?: boolean;
  /** Root element to search from (DOM scanner only). */
  root?: HTMLElement;
  /** Patterns to ignore. */
  ignore?: (string | RegExp)[];
}

/**
 * 1. DOM SCANNER
 */
export function detectMissingClasses(options: DetectOptions = {}) {
  const {
    forceRefreshCSS = false,
    onlyReportNew = false,
    root = document.body,
    ignore = [],
  } = options;

  ensureCachePopulated(forceRefreshCSS);

  const allElements = root.getElementsByTagName('*');
  const missingInThisPass: string[] = [];

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (!el) continue;

    const classes = el.classList;
    for (let j = 0; j < classes.length; j++) {
      const cls = classes[j];
      if (!cls) continue;

      if (isClassMissing(cls, ignore, onlyReportNew)) {
        missingInThisPass.push(cls);
        // We always add to history, but only use it if onlyReportNew is true
        cacheState.reportedMissingClasses.add(cls);
      }
    }
  }

  logResults('DOM Scan', missingInThisPass);
  return missingInThisPass;
}

/**
 * 2. RAW CODE SCANNER
 */
export function detectMissingClassesInCode(
  tsCode: string,
  options: DetectOptions = {},
) {
  const {
    forceRefreshCSS = false,
    onlyReportNew = false,
    ignore = [],
  } = options;

  ensureCachePopulated(forceRefreshCSS);

  const pattern = /\b(?:class|className)\s*[=:]\s*(["'`])((?:(?!\1).)*)\1/g;

  const missingInThisPass: string[] = [];
  let match: RegExpExecArray | null;

  while (true) {
    match = pattern.exec(tsCode);
    if (match === null) break;
    const content = match[2];
    if (!content) continue;

    const potentialClasses = content.split(/\s+/);

    for (const cls of potentialClasses) {
      if (!cls || cls.includes('${') || cls.includes('}')) continue;

      if (isClassMissing(cls, ignore, onlyReportNew)) {
        missingInThisPass.push(cls);
        cacheState.reportedMissingClasses.add(cls);
      }
    }
  }

  logResults('Code Scan', missingInThisPass);
  return missingInThisPass;
}

export function resetMissingClassCache() {
  cacheState.reportedMissingClasses.clear();
}

/* ================= INTERNAL HELPERS ================= */

function isClassMissing(
  cls: string,
  ignorePatterns: (string | RegExp)[],
  onlyReportNew: boolean,
): boolean {
  // 1. Is it a valid CSS class?
  if (cacheState.validClasses.has(cls)) return false;

  // 2. Have we reported it before?
  // If onlyReportNew is FALSE (default), we ignore the history and report it again.
  if (onlyReportNew && cacheState.reportedMissingClasses.has(cls)) return false;

  // 3. Is it ignored by the user?
  if (isIgnored(cls, ignorePatterns)) return false;

  return true;
}

function logResults(source: string, missing: string[]) {
  // Deduplicate within this specific pass so we don't see the same error 50 times in one log
  const uniqueMissing = Array.from(new Set(missing));

  if (uniqueMissing.length > 0) {
    console.warn(
      `%c[Missing Classes - ${source}] Found ${uniqueMissing.length} issues:`,
      'color: orange; font-weight: bold;',
      uniqueMissing,
    );
  }
}

function ensureCachePopulated(force: boolean) {
  const now = Date.now();
  const sheetCount = document.styleSheets.length;

  const shouldScan =
    force ||
    sheetCount !== cacheState.lastSheetCount ||
    now - cacheState.lastScanTime > cacheState.cacheDuration;

  if (shouldScan) {
    populateValidClasses();
    cacheState.lastSheetCount = sheetCount;
    cacheState.lastScanTime = now;
  }
}

function populateValidClasses() {
  cacheState.validClasses.clear();
  const sheets = Array.from(document.styleSheets);

  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules;
      if (rules) {
        extractClassesFromRules(rules);
      }
    } catch (e) {
      console.debug(
        `[detectMissingClasses] Skipped cross-origin stylesheet`,
        e,
      );
    }
  }
}

function extractClassesFromRules(rules: CSSRuleList) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;

    if (rule.type === 1 && 'selectorText' in rule) {
      const styleRule = rule as CSSStyleRule;
      extractClassesFromSelector(styleRule.selectorText);
    } else if ('cssRules' in rule) {
      const groupingRule = rule as CSSGroupingRule;
      if (groupingRule.cssRules) {
        extractClassesFromRules(groupingRule.cssRules);
      }
    }
  }
}

function extractClassesFromSelector(selectorText: string) {
  const classRegex = /\.([a-zA-Z0-9\-_\\:[\]!/]+)/g;
  let match: RegExpExecArray | null;
  while (true) {
    match = classRegex.exec(selectorText);
    if (match === null) break;
    const capturedGroup = match[1];
    if (!capturedGroup) continue;
    const cleanClass = capturedGroup.replace(/\\/g, '');
    cacheState.validClasses.add(cleanClass);
  }
}

function isIgnored(cls: string, ignorePatterns: (string | RegExp)[]) {
  for (const pattern of ignorePatterns) {
    if (typeof pattern === 'string' && cls === pattern) return true;
    if (pattern instanceof RegExp && pattern.test(cls)) return true;
  }
  return false;
}

/* ================= HMR SUPPORT ================= */
if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', (payload) => {
    if (!payload || !payload.updates) return;
    const hasCssUpdate = payload.updates.some(
      (update) => update.type === 'css-update' || update.path.endsWith('.css'),
    );
    if (hasCssUpdate) {
      cacheState.lastScanTime = 0;
      cacheState.validClasses.clear();
      cacheState.reportedMissingClasses.clear();
    }
  });
}
