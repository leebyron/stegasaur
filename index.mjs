/*

TODO: consider base-8 instead of base-4 encoding. What is the real cost of
breaking consistency with stega's formatting?

ZW options:

  - U+200B  zero width space
  - U+200C  zero width non-joiner
  - U+200D  zero width joiner
  - U+2060  word joiner
  - U+2061  function application
  - U+2062  invisible times
  - U+2063  invisible separator
  - U+2064  invisible plus
  - U+FEFF  zero width no-break space

*/

const ENCODER = "\u200B\u200C\u200D\uFEFF";

const DECODER = {
  "\u200B": 0,
  "\u200C": 1,
  "\u200D": 2,
  "\uFEFF": 3,
};

// For compatibility with @vercel/stega
const encodedNull = "\u200B\u200B\u200B\u200B";

const ANNOTATION_ANCHOR = "\u2064";

// const r0123 = `[${ENCODER}]`, r0 = ENCODER[0], r123 = `[${ENCODER.slice(1)}]`, ANNOTATION_PARTS_RX = new RegExp(
//   `${ANNOTATION_ANCHOR}|${r0}{4}(?:${r0}(?:${r0}(?:${r0}${r123}|${r123}${r0123})|${r123}${r0123}{2})|${r123}${r0123}{3})+`
//   , 'g')

const ANNOTATION_PARTS_RX =
  /\u2064|\u200B{4}(?:\u200B(?:\u200B(?:\u200B[\u200C\u200D\uFEFF]|[\u200C\u200D\uFEFF][\u200B\u200C\u200D\uFEFF])|[\u200C\u200D\uFEFF][\u200B\u200C\u200D\uFEFF]{2})|[\u200C\u200D\uFEFF][\u200B\u200C\u200D\uFEFF]{3})+/g;

/**
 * Adds an encoded JSON object to a string as hidden characters. Can later be
 * decoded and recovered with `retrieve()`
 *
 * @param   {string} string The visible string the JSON will be annotating
 * @param   {object} data   The data to annotate to the string
 * @returns {string}        An annotated string
 */
export function annotate(string, data) {
  return ANNOTATION_ANCHOR + string + encodeData(data);
}

/**
 * Returns true if the provided
 *
 * @param   {string}  string          The string annotated with hidden data
 * @param   {boolean} [strict=false]  If true, requires the provided string to
 *                                    be entirely an annotated string
 * @returns {boolean} True if the provided string has been annotated with data
 */
export function isAnnotated(string, strict = false) {
  for (let [start, end] of findRanges(string)) {
    return !strict || (start === 0 && end === string.length);
  }
  return false;
}

/**
 * @typedef {Object} AnnotatedRange
 * @prop    {number} start  The start position of the annotated range
 * @prop    {number} end    The end position of the annotated range
 * @prop    {string} string The string being annotated
 * @prop    {object} data   The data annotating this string
 */

/**
 * Adds an encoded JSON object to a string as hidden characters
 *
 * @param   {string} annotated The string annotated with hidden data
 * @returns {AnnotatedRange | undefined}
 *   The retrieved annotated range (string and data) or undefined if none exists.
 */
export function retrieve(annotated) {
  for (let range of findRanges(annotated)) {
    return createAnnotatedRange(annotated, range);
  }
}

/**
 * Adds an encoded JSON object to a string as hidden characters
 *
 * @param   {string} annotated The string annotated with hidden data
 * @returns {IterableIterator<AnnotatedRange>}
 *   All retrieved annotated ranges (string and data).
 */
export function* retrieveAll(annotated) {
  for (let range of findRanges(annotated)) {
    yield createAnnotatedRange(annotated, range);
  }
}

/**
 * Removes an annotated data from the provided string.
 *
 * @param   {string} annotated  A string annotated with hidden data
 * @returns {string}            The string with the first annotation removed.
 */
export function remove(annotated) {
  for (let [start, end, dataStart] of findRanges(annotated)) {
    return (
      annotated.slice(0, start) +
      annotated.slice(start + 1, dataStart) +
      annotated.slice(end)
    );
  }
  return annotated;
}

/**
 * Removes all annotated data from the provided string.
 *
 * @param   {string} annotated  A string annotated with hidden data
 * @returns {string}            The string with all annotations removed
 */
export function removeAll(annotated) {
  return annotated.replaceAll(ANNOTATION_PARTS_RX, "");
}

/**
 * Replaces all hidden annotations with the result of the replacer function.
 *
 * In the case of nested annotations, will replace inner annotations first.
 *
 * @param   {string} annotated  A string annotated with hidden data
 * @param   {(range: AnnotatedRange) => string} replacer replacer function
 * @returns {string}
 */
export function replaceAll(annotated, replacer) {
  let startStack = [];
  let start;
  let match;

  ANNOTATION_PARTS_RX.lastIndex = 0;
  while ((match = ANNOTATION_PARTS_RX.exec(annotated))) {
    const matchIndex = match.index;
    const matchString = match[0];

    if (matchString === ANNOTATION_ANCHOR) {
      if (start != null) {
        startStack.push(start);
      }
      start = matchIndex;
    } else {
      start = start || 0;
      const end = matchIndex + matchString.length;
      const string = annotated.slice(start + 1, matchIndex);
      const data = decodeData(matchString);
      const replacement = replacer(string, data);
      annotated =
        annotated.slice(0, start) + replacement + annotated.slice(end);
      ANNOTATION_PARTS_RX.lastIndex -= end - start - replacement.length;
      start = startStack.pop();
    }
  }

  return annotated;
}

/**
 * Yields a generator sequence of raw annotated ranges found in the provided
 * annotated string in order of the start point of each annotated range.
 *
 * If an anchor point is not found, assumes the range starts at 0
 *
 * @private
 * @param   {string} annotated            A string annotated with hidden data
 * @returns {IterableIterator<RawRange>}  The retrieved annotated ranges.
 * @typedef {[start: number, end: number, dataStart: number, encodedData: string]} RawRange
 */
function* findRanges(annotated) {
  let foundStack = [];
  let startStack = [];
  let start;
  let match;

  ANNOTATION_PARTS_RX.lastIndex = 0;
  while ((match = ANNOTATION_PARTS_RX.exec(annotated))) {
    const matchIndex = match.index;
    const matchString = match[0];

    if (matchString === ANNOTATION_ANCHOR) {
      if (start != null) {
        startStack.push(start);
      }
      start = matchIndex;
    } else {
      foundStack.push([
        start || 0,
        matchIndex + matchString.length,
        matchIndex,
        matchString,
      ]);
      if (startStack.length > 0) {
        start = startStack.pop();
      } else {
        while (foundStack.length) {
          yield foundStack.pop();
        }
      }
    }
  }
}

/**
 * Encodes some data as a non-rendering hidden string.
 *
 * This is a "low level" function, prefer using `annotate()` if intending to
 * include the resulting data within a broader string of text.
 *
 * @param   {object} data The JSON-encodeable data
 * @returns {string}      The data encoded as a non-rendering string
 */
export function encodeData(data) {
  let encoded = encodedNull;
  const asciiJSON = toAsciiJson(data);
  for (let i = 0; i < asciiJSON.length; i++) {
    let charCode = asciiJSON.charCodeAt(i);
    encoded +=
      ENCODER[charCode >> 6] +
      ENCODER[(charCode >> 4) & 3] +
      ENCODER[(charCode >> 2) & 3] +
      ENCODER[charCode & 3];
  }
  return encoded;
}

/**
 * Decodes a non-rendering hidden string into data.
 *
 * This is a "low level" function, use `retrieve()` to get the resulting data
 * from an annotated string of text.
 *
 * @param   {string} encoded  The encoded data as a non-rendering string
 * @returns {object}          The decoded data as a plain object
 */
export function decodeData(encoded) {
  if (encoded.length % 4 !== 0 || encoded.slice(0, 4) !== encodedNull) {
    throw new Error(`Invalid encoded data: ${toAsciiJson(encoded)}`);
  }
  let decoded = "";
  for (let i = 4; i < encoded.length; i += 4) {
    const charCode =
      (DECODER[encoded[i]] << 6) |
      (DECODER[encoded[i + 1]] << 4) |
      (DECODER[encoded[i + 2]] << 2) |
      DECODER[encoded[i + 3]];
    if (charCode === 0) break;
    decoded += String.fromCharCode(charCode);
  }
  return JSON.parse(decoded);
}

/**
 * Creates an AnnotatedRange from an annotated string and RawRange
 *
 * @private
 * @param   {string}    annotated
 * @param   {RawRange}  range
 * @returns {AnnotatedRange}
 */
function createAnnotatedRange(annotated, range) {
  const [start, end, dataStart, encodedData] = range;
  return {
    start,
    end,
    string: annotated.slice(start + 1, dataStart),
    data: decodeData(encodedData),
  };
}

/**
 * Produce a JSON string from a value. Returned JSON is strictly ASCII. This
 * is possible since all parts of the JSON grammar are strictly ASCII except
 * for string literals. This replaces all non-ASCII characters with unicode
 * escape sequences.
 *
 * @private
 * @param   {object} value
 * @returns {string}
 */
function toAsciiJson(value) {
  return JSON.stringify(value).replaceAll(
    /[^\x00-\x7F]/g,
    (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

/*

// HTML

Given a root node, crawl the DOM tree looking for text that might contain
encoded data, then for each return:

- The element (node?) it was found in
- The property it was found in (textContent, alt)
- The AnnotatedRange (or should be a subtype? with these props expanded out?)
- A DOM Rect describing where its visible on the screen


This then offers full control to manipulate the nodes, the content, or draw
onto the screen.

Do this in a generator so work can be done incrementally for large pages.

*/

/**
 * Given a root DOM Node, searches through the DOM tree looking for annotations,
 * and yielding `NodeAnnotation` objects as they are found to fully describe
 * their location within the DOM.
 *
 * @param {Node} rootNode
 * @returns {Generator<NodeAnnotation>}
 *
 * @typedef {Object} NodeAnnotation
 * @prop    {Node}   node     The node the annotation was found within
 * @prop    {string} property The property of the node the annotation is within
 * @prop    {DOMRectReadOnly} rect The visible region of the screen covering
 *                                 this annotation
 * @prop    {number} start    The start position of the annotation
 * @prop    {number} end      The end position of the annotation
 * @prop    {string} string   The string being annotated
 * @prop    {object} data     The data annotating this string
 */
export function* findNodeAnnotations(rootNode) {
  // Initialize a stack with the root node
  const stack = [rootNode];
  while (stack.length) {
    const node = stack.pop();

    // If the current node is a text node, yield it
    const nodeType = node.nodeType;
    if (nodeType === Node.TEXT_NODE) {
      const data = node.data;

      for (let annotation of retrieveAll(data)) {
        const rect = null; // TODO lazy generation of createRange() and getBoundingClientRect()
        // need to decide if this should be multiple ranges (for text that wraps?)
        // also need to decide if this yields viewport relative or document relative
        yield { node, property: "data", rect, ...annotation };
      }
    } else if (nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName;
      if (tagName === "SCRIPT") continue;

      // TODO: image alt & ariaLabels

      // Add all child nodes of the current node to the stack to process next.
      // Note: We're adding the child nodes in reverse order to ensure that they
      // are popped from the stack in the correct order.
      for (
        let children = node.childNodes, i = children.length - 1;
        i >= 0;
        i--
      ) {
        stack.push(children[i]);
      }
    }
  }
}
