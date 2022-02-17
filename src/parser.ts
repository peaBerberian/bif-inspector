export interface IBifThumbnail { index : number;
                                 duration : number;
                                 ts : number;
                                 data : Uint8Array; }

export interface IBifObject {
  version : number;
  imageCount : number;
  framewiseSeparation: number;
  format : string | undefined;
  width : number | undefined;
  height : number | undefined;
  aspectRatio : string | undefined;
  isVod : boolean | undefined;
  thumbs : IBifThumbnail[];
}

/**
 * @param {UInt8Array} buf
 * @returns {Object}
 */
function parseBif(buf : Uint8Array) : IBifObject {
  let pos = 0;

  const length = buf.length;

  const fileFormat = utf8ToStr(buf.subarray(pos + 1, pos + 8)); pos += 8;
  if (buf[0] !== 0x89 || fileFormat !== "BIF\r\n\u001a\n") {
    throw new Error("Invalid BIF file");
  }

  const version = le4toi(buf, pos); pos += 4;

  if (version > 0) {
    throw new Error(`Unhandled version: ${version}`);
  }

  const imageCount = le4toi(buf, pos); pos += 4;
  const framewiseSeparation = le4toi(buf, pos); pos += 4;

  // Following may be undefined as they are reserved bits

  const formatSubarr = buf.subarray(pos, pos + 4);
  const formatInt = le4toi(buf, pos); pos += 4;
  let format : string | undefined = utf8ToStr(formatSubarr);
  let width : number | undefined = le2toi(buf, pos); pos += 2;
  let height : number | undefined = le2toi(buf, pos); pos += 2;
  let aspectRatio : string | undefined =
    [buf[pos], buf[pos + 1]].join(":"); pos += 2;
  let isVod : boolean | undefined = buf[pos] === 1;

  if (!isVod && aspectRatio === "0:0") {
    isVod = undefined;
    aspectRatio = undefined;
    if (width === 0) {
      width = undefined;
      if (height === 0) {
        height = undefined;
        if (formatInt === 0) {
          format = undefined;
        }
      }
    }
  }

  // bytes 0x1F to 0x40 is unused data for now
  pos = 0x40;

  const thumbs : IBifThumbnail[] = [];

  let index = 0;
  let previousImageInfo = null;
  while (pos < length) {
    const currentImageTimestamp = le4toi(buf, pos); pos += 4;
    const currentImageOffset = le4toi(buf, pos); pos += 4;

    if (previousImageInfo !== null) {
      // calculate for index-1
      const ts = previousImageInfo.timestamp * framewiseSeparation;
      const duration = framewiseSeparation;
      const data = buf.slice(previousImageInfo.offset, currentImageOffset);

      thumbs.push({ index, duration, ts, data });

      index++;
    }

    if (currentImageTimestamp === 0xFFFFFFFF) {
      break;
    }

    previousImageInfo = { timestamp: currentImageTimestamp,
                          offset: currentImageOffset };
  }

  return { version,
           imageCount,
           framewiseSeparation,
           format,
           width,
           height,
           aspectRatio,
           isVod,
           thumbs };
}

const hasTextDecoder = typeof window === "object" &&
                       typeof window.TextDecoder === "function";

/**
 * Translate groups of 2 little-endian bytes to Integer (from 0 up to 65535).
 * @param {Uint8Array} bytes
 * @param {Number} offset - The offset (from the start of the given array)
 * @returns {Number}
 */
function le2toi(bytes : Uint8Array, offset : number) : number {
  return ((bytes[offset + 0] << 0) +
          (bytes[offset + 1] << 8));
}

/**
 * Translate groups of 4 little-endian bytes to Integer.
 * @param {Uint8Array} bytes
 * @param {Number} offset - The offset (from the start of the given array)
 * @returns {Number}
 */
function le4toi(bytes : Uint8Array, offset : number) : number {
  return ((bytes[offset + 0]) +
          (bytes[offset + 1] * 0x0000100) +
          (bytes[offset + 2] * 0x0010000) +
          (bytes[offset + 3] * 0x1000000));
}

/**
 * Creates a string from the given Uint8Array containing utf-8 code units.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function utf8ToStr(data : Uint8Array) : string {
  if (hasTextDecoder) {
    try {
      // TextDecoder use UTF-8 by default
      const decoder = new TextDecoder();
      return decoder.decode(data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Utils: could not use TextDecoder to parse UTF-8, " +
                   "fallbacking to another implementation", e);
    }
  }

  let uint8 = data;

  // If present, strip off the UTF-8 BOM.
  if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    uint8 = uint8.subarray(3);
  }

  // We're basically doing strToUtf8 in reverse.
  // You can look at that other function for the whole story.

  // Generate string containing escaped UTF-8 code units
  const utf8Str = stringFromCharCodes(uint8);

  let escaped : string;
  if (typeof escape === "function") {
    // Transform UTF-8 escape sequence into percent-encoded escape sequences.
    escaped = escape(utf8Str);
  } else {
    // Let's implement a simple escape function
    // http://ecma-international.org/ecma-262/9.0/#sec-escape-string
    const nonEscapedChar = /[A-Za-z0-9*_\+-\.\/]/;
    escaped = "";
    for (let i = 0; i < utf8Str.length; i++) {
      if (nonEscapedChar.test(utf8Str[i])) {
        escaped += utf8Str[i];
      } else {
        const charCode = utf8Str.charCodeAt(i);
        escaped += charCode >= 256 ? "%u" + intToHex(charCode, 4) :
                                     "%" + intToHex(charCode, 2);
      }
    }
  }

  // Decode the percent-encoded UTF-8 string into the proper JS string.
  // Example: "g#%E3%82%AC" -> "g#€"
  return decodeURIComponent(escaped);
}


/**
 * Transform an integer into an hexadecimal string of the given length, padded
 * to the left with `0` if needed.
 * @example
 * ```
 * intToHex(5, 4); // => "0005"
 * intToHex(5, 2); // => "05"
 * intToHex(10, 1); // => "a"
 * intToHex(268, 3); // => "10c"
 * intToHex(4584, 6) // => "0011e8"
 * intToHex(123456, 4); // => "1e240" (we do nothing when going over 4 chars)
 * ```
 * @param {number} num
 * @param {number} size
 * @returns {string}
 */
function intToHex(num : number, size : number) : string {
  const toStr = num.toString(16);
  return toStr.length >= size ? toStr :
    new Array(size - toStr.length + 1).join("0") + toStr;
}

/**
 * Creates a new string from the given array of char codes.
 * @param {Uint8Array} args
 * @returns {string}
 */
function stringFromCharCodes(args : Uint8Array) : string {
  const max = 16000;
  let ret = "";
  for (let i = 0; i < args.length; i += max) {
    const subArray = args.subarray(i, i + max);

    // NOTE: ugly I know, but TS is problematic here (you can try)
    ret += String.fromCharCode.apply(null, subArray as unknown as number[]);
  }
  return ret;
}


export default parseBif;
