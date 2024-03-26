const ENCODER = [
  "\u200B", // zero width space
  "\u200C", // zero width non-joiner
  "\u200D", // zero width joiner
  "\uFEFF", // zero width no-break space
];

const DECODER = {
  "\u200B": 0,
  "\u200C": 1,
  "\u200D": 2,
  "\uFEFF": 3,
};

// For compatibility with @vercel/stega
const encodedNull = ENCODER[0].repeat(4);

// TODO: these render as space width in browsers :-(
const ANNOTATION_ANCHOR = "\uFFF9";
const ANNOTATION_SEPARATOR = "\uFFFA";
const ANNOTATION_TERMINATOR = "\uFFFB";
const ANNOTATION_RX = /[\uFFF9\uFFFA\uFFFB]/g;

/**
 * Adds an encoded JSON object to a string as hidden characters. Can later be
 * decoded and recovered with `retrieve()`
 *
 * @param   {string} string The visible string the JSON will be annotating
 * @param   {object} data   The data to annotate to the string
 * @returns {string}        An annotated string
 */
export function annotate(string, data) {
  return (
    ANNOTATION_ANCHOR +
    string +
    ANNOTATION_SEPARATOR +
    encodeData(data) +
    ANNOTATION_TERMINATOR
  );
}

/**
 * Returns true if the provided
 *
 * @param   {string}        string  The string annotated with hidden data
 * @param   {boolean=false} strict  If true, requires the provided string to
 *                                  exactly be entirely an annotated string
 * @returns {boolean}  True if the provided string has been annotated with data
 */
export function isAnnotated(string, strict = false) {
  for (let [start, , end] of findRanges(string)) {
    return !strict || (start === 0 && end === string.length - 1);
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
 * @returns {AnnotatedRange}  The retrieved annotated range (string and data).
 */
export function retrieve(annotated) {
  for (let range of findRanges(annotated)) {
    return createAnnotatedRange(annotated, range);
  }
  return null;
}

/**
 * Adds an encoded JSON object to a string as hidden characters
 *
 * @param   {string} annotated The string annotated with hidden data
 * @returns {Iterable<AnnotatedRange>} All retrieved annotated ranges (string and data).
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
  for (let [start, separator, end] of findRanges(annotated)) {
    return (
      annotated.slice(0, start) +
      annotated.slice(start + 1, separator) +
      annotated.slice(end + 1)
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
  return annotated.replaceAll(
    /\uFFF9|\uFFFA[\u200B\u200C\u200D\uFEFF]+\uFFFB/g,
    ""
  );
}

/**
 * Replaces all hidden annotations with the result of the replacer function
 *
 * @param   {string} annotated  A string annotated with hidden data
 * @param   {(range: AnnotatedRange) => string} replacer replacer function
 * @returns {string}
 */
export function replaceAll(annotated, replacer) {
  let searchStack = [];
  let range;

  ANNOTATION_RX.lastIndex = 0;
  while (ANNOTATION_RX.test(annotated)) {
    const matchIndex = ANNOTATION_RX.lastIndex - 1;
    const matchChar = annotated[matchIndex];
    if (matchChar === ANNOTATION_ANCHOR) {
      if (range) {
        searchStack.push(range);
      }
      range = [matchIndex, null, null];
    } else if (matchChar === ANNOTATION_SEPARATOR) {
      if (range) {
        range[1] = matchIndex;
      }
    } else if (matchChar === ANNOTATION_TERMINATOR) {
      if (range && range[1]) {
        range[2] = matchIndex;
        const replacement = replacer(createAnnotatedRange(annotated, range));
        const [start, , end] = range;
        annotated =
          annotated.slice(0, start) + replacement + annotated.slice(end + 1);
        ANNOTATION_RX.lastIndex -= end + 1 - start - replacement.length;
        range = searchStack.pop();
      }
    }
  }

  return annotated;
}

/**
 * Yields a generator sequence of raw annotated ranges found in the provided
 * annotated string.
 *
 * @private
 * @arg {string} annotated        The string annotated with hidden data
 * @returns {Generator<RawRange>} The retrieved annotated ranges.
 * @typedef {[start: number, separator: number, end: number]} RawRange
 */
function* findRanges(annotated) {
  let foundStack = [];
  let searchStack = [];
  let range;

  ANNOTATION_RX.lastIndex = 0;
  while (ANNOTATION_RX.test(annotated)) {
    const matchIndex = ANNOTATION_RX.lastIndex - 1;
    const matchChar = annotated[matchIndex];
    if (matchChar === ANNOTATION_ANCHOR) {
      if (range) {
        searchStack.push(range);
      }
      range = [matchIndex, null, null];
    } else if (matchChar === ANNOTATION_SEPARATOR) {
      if (range) {
        range[1] = matchIndex;
      }
    } else if (matchChar === ANNOTATION_TERMINATOR) {
      if (range && range[1]) {
        range[2] = matchIndex;
        foundStack.push(range);
        if (searchStack.length > 0) {
          range = searchStack.pop();
        } else {
          while ((range = foundStack.pop())) {
            if (range[1] && range[2]) {
              yield range;
            }
          }
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
  const json = JSON.stringify(data ?? null);
  let encoded = encodedNull;
  for (let i = 0; i < json.length; i++) {
    let charCode = json.charCodeAt(i);
    if (charCode > 255) {
      throw new Error(
        `Error encoding non-ASCII ${char} (${charCode}) in ${data}`
      );
    }
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
    throw new Error("Invalid encoded data");
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
 * @param {string}    annotated
 * @param {RawRange}  range
 * @returns {AnnotatedRange}
 */
function createAnnotatedRange(annotated, range) {
  const [start, separator, end] = range;
  return {
    start,
    end,
    string: annotated.slice(start + 1, separator),
    data: decodeData(annotated.slice(separator + 1, end)),
  };
}
