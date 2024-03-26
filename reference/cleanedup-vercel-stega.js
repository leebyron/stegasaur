const hexidecimalEncoder = {
  0: 0x200b, // zero width space
  1: 0x200c, // zero width non-joiner
  2: 0x200d, // zero width joiner
  3: 0x2062, // invisible times
  4: 0x2063, // invisible separator
  5: 0x2060, // word joiner
  6: 0xfeff, // zero width no-break space
  7: 0x2061, // function application
  8: 0x1d173, // musical symbol begin beam
  9: 0x1d174, // musical symbol end beam
  a: 0x1d175, // musical symbol begin tie
  b: 0x1d176, // musical symbol end tie
  c: 0x1d177, // musical symbol begin slur
  d: 0x1d178, // musical symbol end slur
  e: 0x1d179, // musical symbol begin phrase
  f: 0x1d17a, // musical symbol end phrase
};

const quaternaryEncoder = {
  0: 0x200b, // zero width space
  1: 0x200c, // zero width non-joiner
  2: 0x200d, // zero width joiner
  3: 0xfeff, // zero width no-break space
};

const hexidecimalDecoder = Object.fromEntries(
  Object.entries(hexidecimalEncoder).map((entry) => entry.reverse())
);

const quaternaryDecoder = Object.fromEntries(
  Object.entries(quaternaryEncoder).map((entry) => entry.reverse())
);

const quaternaryNullChar = new Array(4)
  .fill(String.fromCodePoint(quaternaryEncoder[0]))
  .join("");

const nullChar = String.fromCharCode(0);

const formattedHiddenChars = Object.values(hexidecimalEncoder)
  .map((hiddenChar) => `\\u{${hiddenChar.toString(16)}}`)
  .join("");

// All possible hidden chars (legacy and current) in a sequence of 4 or longer.
// Using regexp flags: "g" for global to find all matches, "u" for unicode instead of byte matching.
export const VERCEL_STEGA_REGEX = new RegExp(
  `[${formattedHiddenChars}]{4,}`,
  "gu"
);

/**
 * Encodes JSON as a hidden string
 * @param json - The JSON data to encode
 * @returns The hidden string
 */
export function vercelStegaEncode(json) {
  let jsonString = JSON.stringify(json);
  return `${quaternaryNullChar}${Array.from(jsonString)
    .map((char) => {
      let charCode = char.charCodeAt(0);
      if (charCode > 255)
        throw new Error(
          `Only ASCII edit info can be encoded. Error attempting to encode ${jsonString} on character ${char} (${charCode})`
        );
      return Array.from(charCode.toString(4).padStart(4, "0"))
        .map((digit) => String.fromCodePoint(quaternaryEncoder[digit]))
        .join("");
    })
    .join("")}`;
}

/**
 * Encodes JSON as a hidden string using the original logic
 * @param json - The JSON data to encode
 * @returns The hidden string
 * @deprecated
 */
export function legacyStegaEncode(json) {
  let jsonString = JSON.stringify(json);
  return Array.from(jsonString)
    .map((char) => {
      let charCode = char.charCodeAt(0);
      if (charCode > 255)
        throw new Error(
          `Only ASCII edit info can be encoded. Error attempting to encode ${jsonString} on character ${char} (${charCode})`
        );
      return Array.from(charCode.toString(16).padStart(2, "0"))
        .map((digit) => String.fromCodePoint(hexidecimalEncoder[digit]))
        .join("");
    })
    .join("");
}

function isDateString(t) {
  return Number.isNaN(Number(t)) ? Boolean(Date.parse(t)) : false;
}

function isURLString(t) {
  try {
    new URL(t, t.startsWith("/") ? "https://acme.com" : undefined);
  } catch {
    return false;
  }
  return true;
}

/**
 * Adds an encoded JSON object to a string as hidden characters
 * @param string - The string the JSON will be added to
 * @param json - The JSON to add to the string
 * @param skip - Whether to skip encoding (default: "auto")
 */
export function vercelStegaCombine(string, json, skip = "auto") {
  return skip === true ||
    (skip === "auto" && (isDateString(string) || isURLString(string)))
    ? string
    : `${string}${vercelStegaEncode(json)}`;
}

/**
 * Decodes the first hidden string that's found in the source string back into its original value
 * @param source - The source string with encoded data
 * @returns The decoded JSON value
 */
export function vercelStegaDecode(source) {
  let matches = source.match(VERCEL_STEGA_REGEX);
  if (!!matches) {
    return decode(matches[0], true)[0];
  }
}

/**
 * Decodes every hidden string that's found in the source string back into their original values
 * @param source - The source string with encoded data
 * @returns The decoded JSON values
 */
export function vercelStegaDecodeAll(source) {
  let matches = source.match(VERCEL_STEGA_REGEX);
  if (!!matches) {
    return matches.map((match) => decode(match)).flat();
  }
}

function decode(encodedString, onlyFirst = false) {
  let encodedData = Array.from(encodedString);
  if (encodedData.length % 2 === 0) {
    if (
      encodedData.length % 4 ||
      !encodedString.startsWith(quaternaryNullChar)
    ) {
      return legacyDecode(encodedData, onlyFirst);
    }
  } else {
    throw new Error("Encoded data has invalid length");
  }
  let chars = [];
  for (let charLength = encodedData.length * 0.25; charLength--; ) {
    let quatenaryCode = encodedData
      .slice(charLength * 4, charLength * 4 + 4)
      .map((datum) => quaternaryDecoder[datum.codePointAt(0)])
      .join("");
    chars.unshift(String.fromCharCode(parseInt(quatenaryCode, 4)));
  }
  if (onlyFirst) {
    chars.shift();
    let end = chars.indexOf(nullChar);
    if (end === -1) {
      end = chars.length;
    }
    return [JSON.parse(chars.slice(0, end).join(""))];
  }
  return chars
    .join("")
    .split(nullChar)
    .filter(Boolean)
    .map((charString) => JSON.parse(charString));
}

function legacyDecode(encodedString, onlyFirst) {
  var errorPositionMatch;
  let chars = [];
  for (let charLength = encodedString.length * 0.5; charLength--; ) {
    let hexidecimalCode = `${
      hexidecimalDecoder[encodedString[charLength * 2].codePointAt(0)]
    }${hexidecimalDecoder[encodedString[charLength * 2 + 1].codePointAt(0)]}`;
    chars.unshift(String.fromCharCode(parseInt(hexidecimalCode, 16)));
  }
  let parsedJSONs = [];
  let stringJSONs = [chars.join("")];
  let tries = 10;
  while (stringJSONs.length) {
    let stringJSON = stringJSONs.shift();
    try {
      parsedJSONs.push(JSON.parse(stringJSON));
      if (onlyFirst) return parsedJSONs;
    } catch (error) {
      if (!tries--) throw error;
      let location = +((errorPositionMatch =
        error.message.match(/\sposition\s(\d+)$/)) == null
        ? undefined
        : errorPositionMatch[1]);
      if (!location) throw error;
      stringJSONs.unshift(
        stringJSON.substring(0, location),
        stringJSON.substring(location)
      );
    }
  }
  return parsedJSONs;
}

/**
 * Splits out encoded data from a string, if any is found
 * @param original - The original string
 * @returns The cleaned string and encoded data, separately
 */
export function vercelStegaSplit(original) {
  const matches = original.match(VERCEL_STEGA_REGEX);
  return {
    cleaned: original.replace(VERCEL_STEGA_REGEX, ""),
    encoded: (matches == null ? undefined : matches[0]) || "",
  };
}
