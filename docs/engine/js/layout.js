// Text layout with no drawing: breaks words into even lines and finds the size that fits.

// Breaks one paragraph at the given size. balanced=true evens out line lengths across the
// paragraph; otherwise each line takes as many words as fit.
export function breakLines(widths, spaceWidth, maxWidth, balanced = true) {
  const n = widths.length;
  if (n === 0) return [];

  if (!balanced) {
    const lines = [];
    let start = 0;
    let used = 0;
    widths.forEach((width, i) => {
      if (i > start && used + spaceWidth + width > maxWidth) {
        lines.push([start, i]);
        start = i;
        used = width;
      } else {
        used += i > start ? spaceWidth + width : width;
      }
    });
    lines.push([start, n]);
    return lines;
  }

  // Minimum-raggedness search: cost[i] is the best score for laying out words i..n.
  const cost = new Array(n + 1).fill(Infinity);
  const next = new Array(n + 1).fill(n);
  cost[n] = 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    let lineWidth = -spaceWidth;
    for (let j = i; j < n; j += 1) {
      lineWidth += spaceWidth + widths[j];
      if (lineWidth > maxWidth && j > i) break;
      const slack = Math.max(0, maxWidth - lineWidth);
      // The last line counts too, which avoids a single word left on its own.
      const widow = j === n - 1 && i === j && n > 1 ? maxWidth * maxWidth : 0;
      const total = slack * slack + widow + cost[j + 1];
      if (total < cost[i]) {
        cost[i] = total;
        next[i] = j + 1;
      }
    }
  }
  const lines = [];
  for (let i = 0; i < n; i = next[i]) lines.push([i, next[i]]);
  return lines;
}

// The greedy line count gives the fewest possible lines. Balanced layout narrows the measure
// until it would need one more line, so lines come out even without adding height.
function balancedLines(widths, spaceWidth, maxWidth) {
  const target = breakLines(widths, spaceWidth, maxWidth, false).length;
  let low = Math.max(...widths);
  let high = maxWidth;
  for (let step = 0; step < 12; step += 1) {
    const mid = (low + high) / 2;
    if (breakLines(widths, spaceWidth, mid, false).length > target) low = mid;
    else high = mid;
  }
  return breakLines(widths, spaceWidth, Math.min(high + 0.5, maxWidth), true);
}

// Lays out paragraphs at one size. wordWidth100 holds each paragraph's word widths at 100 px.
function layoutAt(paragraphs, size, options) {
  const { maxWidth, lineHeight, paragraphGap, balance, space100 } = options;
  const scale = size / 100;
  const lines = [];
  let height = 0;
  paragraphs.forEach((paragraph) => {
    const widths = paragraph.widths100.map((w) => w * scale);
    const space = space100 * scale;
    const ranges = balance
      ? balancedLines(widths, space, maxWidth)
      : breakLines(widths, space, maxWidth, false);
    if (paragraph.gap) height += size * lineHeight * paragraphGap;
    ranges.forEach(([from, to]) => {
      const width = widths.slice(from, to).reduce((sum, w) => sum + w, 0) + space * (to - from - 1);
      lines.push({ words: paragraph.words.slice(from, to), width, y: height });
      height += size * lineHeight;
    });
  });
  return { size, lines, height };
}

// Finds the largest size up to maxSize where the text fits the box without splitting a word.
export function fitText(paragraphs, options) {
  const { maxWidth, maxHeight, maxSize, minSize = 8 } = options;
  const widest = Math.max(1, ...paragraphs.flatMap((p) => p.widths100));
  const fits = (size) =>
    (widest * size) / 100 <= maxWidth && layoutAt(paragraphs, size, options).height <= maxHeight;

  let low = minSize;
  let high = maxSize;
  if (fits(high)) return layoutAt(paragraphs, high, options);
  for (let step = 0; step < 14; step += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return layoutAt(paragraphs, Math.floor(low * 2) / 2, options);
}
