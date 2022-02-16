(() => {
  // src/parser.ts
  function parseBif(buf) {
    let pos = 0;
    const length = buf.length;
    const fileFormat = utf8ToStr(buf.subarray(pos + 1, pos + 8));
    pos += 8;
    if (buf[0] !== 137 || fileFormat !== "BIF\r\n\n") {
      throw new Error("Invalid BIF file");
    }
    const version = le4toi(buf, pos);
    pos += 4;
    if (version > 0) {
      throw new Error(`Unhandled version: ${version}`);
    }
    const imageCount = le4toi(buf, pos);
    pos += 4;
    const framewiseSeparation = le4toi(buf, pos);
    pos += 4;
    const formatSubarr = buf.subarray(pos, pos + 4);
    const formatInt = le4toi(buf, pos);
    pos += 4;
    let format = utf8ToStr(formatSubarr);
    let width = le2toi(buf, pos);
    pos += 2;
    let height = le2toi(buf, pos);
    pos += 2;
    let aspectRatio = [buf[pos], buf[pos + 1]].join(":");
    pos += 2;
    let isVod = buf[pos] === 1;
    if (!isVod && aspectRatio === "0:0") {
      isVod = void 0;
      aspectRatio = void 0;
      if (width === 0) {
        width = void 0;
        if (height === 0) {
          height = void 0;
          if (formatInt === 0) {
            format = void 0;
          }
        }
      }
    }
    pos = 64;
    const thumbs = [];
    let index = 0;
    let previousImageInfo = null;
    while (pos < length) {
      const currentImageTimestamp = le4toi(buf, pos);
      pos += 4;
      const currentImageOffset = le4toi(buf, pos);
      pos += 4;
      if (previousImageInfo !== null) {
        const ts = previousImageInfo.timestamp * framewiseSeparation;
        const duration = framewiseSeparation;
        const data = buf.slice(previousImageInfo.offset, currentImageOffset);
        thumbs.push({ index, duration, ts, data });
        index++;
      }
      if (currentImageTimestamp === 4294967295) {
        break;
      }
      previousImageInfo = {
        timestamp: currentImageTimestamp,
        offset: currentImageOffset
      };
    }
    return {
      version,
      imageCount,
      framewiseSeparation,
      format,
      width,
      height,
      aspectRatio,
      isVod,
      thumbs
    };
  }
  var hasTextDecoder = typeof window === "object" && typeof window.TextDecoder === "function";
  function le2toi(bytes, offset) {
    return (bytes[offset + 0] << 0) + (bytes[offset + 1] << 8);
  }
  function le4toi(bytes, offset) {
    return bytes[offset + 0] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536 + bytes[offset + 3] * 16777216;
  }
  function utf8ToStr(data) {
    if (hasTextDecoder) {
      try {
        const decoder = new TextDecoder();
        return decoder.decode(data);
      } catch (e) {
        console.warn("Utils: could not use TextDecoder to parse UTF-8, fallbacking to another implementation", e);
      }
    }
    let uint8 = data;
    if (uint8[0] === 239 && uint8[1] === 187 && uint8[2] === 191) {
      uint8 = uint8.subarray(3);
    }
    const utf8Str = stringFromCharCodes(uint8);
    let escaped;
    if (typeof escape === "function") {
      escaped = escape(utf8Str);
    } else {
      const nonEscapedChar = /[A-Za-z0-9*_\+-\.\/]/;
      escaped = "";
      for (let i = 0; i < utf8Str.length; i++) {
        if (nonEscapedChar.test(utf8Str[i])) {
          escaped += utf8Str[i];
        } else {
          const charCode = utf8Str.charCodeAt(i);
          escaped += charCode >= 256 ? "%u" + intToHex(charCode, 4) : "%" + intToHex(charCode, 2);
        }
      }
    }
    return decodeURIComponent(escaped);
  }
  function intToHex(num, size) {
    const toStr = num.toString(16);
    return toStr.length >= size ? toStr : new Array(size - toStr.length + 1).join("0") + toStr;
  }
  function stringFromCharCodes(args) {
    const max = 16e3;
    let ret = "";
    for (let i = 0; i < args.length; i += max) {
      const subArray = args.subarray(i, i + max);
      ret += String.fromCharCode.apply(null, subArray);
    }
    return ret;
  }
  var parser_default = parseBif;

  // src/render.ts
  var currentUrls = [];
  function renderFetchingMessage() {
    cleanPreviousRender();
    const contentEl = getContentElt();
    contentEl.innerText = "Fetching BIF File...";
  }
  function renderParsingMessage() {
    cleanPreviousRender();
    const contentEl = getContentElt();
    contentEl.innerText = "Parsing BIF File...";
  }
  function renderLoadingMessage() {
    cleanPreviousRender();
    const contentEl = getContentElt();
    contentEl.innerText = "Loading BIF File...";
  }
  function render(parsedBif) {
    cleanPreviousRender();
    const contentEl = getContentElt();
    contentEl.innerText = "Rendering parsed BIF File...";
    const containerElt = document.createElement("div");
    const metadataElt = document.createElement("pre");
    metadataElt.innerText = `version: ${parsedBif.version}
image count: ${parsedBif.imageCount}
framewise separation (ms): ${parsedBif.framewiseSeparation}
` + (parsedBif.format !== void 0 ? `format: ${parsedBif.format}
` : "") + (parsedBif.width !== void 0 ? `width: ${parsedBif.width}
` : "") + (parsedBif.height !== void 0 ? `height: ${parsedBif.height}
` : "") + (parsedBif.aspectRatio !== void 0 ? `aspect ratio: ${parsedBif.aspectRatio}
` : "") + (parsedBif.isVod !== void 0 ? `is VoD: ${String(parsedBif.isVod)}
` : "");
    containerElt.appendChild(metadataElt);
    for (const image of parsedBif.thumbs) {
      let hideImageInfo = function() {
        imageInfoElt.style.display = "none";
      }, displayImageInfo = function() {
        imageInfoElt.style.top = `${imageElt.offsetTop}px`;
        imageInfoElt.style.left = `${imageElt.offsetLeft}px`;
        imageInfoElt.style.display = "block";
      };
      const blob = new Blob([image.data], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      currentUrls.push(url);
      const imageElt = document.createElement("img");
      imageElt.className = "thumbnail";
      imageElt.src = url;
      const imageInfoElt = document.createElement("pre");
      imageInfoElt.innerText = `index: ${image.index}
time (ms): ${image.ts}
duration (ms): ${image.duration}
`;
      imageInfoElt.style.position = "absolute";
      imageInfoElt.style.zIndex = "999";
      imageInfoElt.style.margin = "0px";
      imageInfoElt.style.padding = "5px";
      imageInfoElt.style.backgroundColor = "#004356";
      imageInfoElt.style.color = "#fff";
      imageInfoElt.style.display = "none";
      imageInfoElt.onmouseover = displayImageInfo;
      imageInfoElt.onmouseout = hideImageInfo;
      imageElt.onmouseout = hideImageInfo;
      imageElt.onmouseover = displayImageInfo;
      imageElt.onmousemove = displayImageInfo;
      containerElt.appendChild(imageElt);
      containerElt.appendChild(imageInfoElt);
    }
    contentEl.innerHTML = "";
    contentEl.appendChild(containerElt);
  }
  function getContentElt() {
    const contentEl = document.getElementById("content");
    if (contentEl === null) {
      throw new Error("Content element not found in the document");
    }
    return contentEl;
  }
  function cleanPreviousRender() {
    for (const prevUrl of currentUrls) {
      URL.revokeObjectURL(prevUrl);
    }
    currentUrls.length = 0;
    const contentEl = getContentElt();
    contentEl.innerHTML = "";
  }
  function renderError(err) {
    cleanPreviousRender();
    const contentEl = getContentElt();
    const pElt = document.createElement("p");
    const message = err instanceof Error ? err.message : "Unknown Error";
    pElt.innerText = "Error: " + message;
    contentEl.appendChild(pElt);
  }

  // src/index.ts
  var fileInputWrapperElt = document.getElementById("file-input-wrapper");
  var fileInputEl = document.getElementById("file-input");
  var urlInputElt = document.getElementById("url-input");
  var urlInputWrapperElt = document.getElementById("url-input-wrapper");
  if (fileInputWrapperElt === null || fileInputEl === null) {
    throw new Error("File input not found in the document");
  }
  if (urlInputWrapperElt === null || urlInputElt === null) {
    throw new Error("URL input not found in the document");
  }
  if (window.File !== void 0 && window.FileReader !== void 0 && window.Uint8Array !== void 0) {
    let onFileSelection = function(evt) {
      const { target } = evt;
      if (target === null || !(target instanceof HTMLInputElement)) {
        return;
      }
      const files = target.files;
      if (files === null || files.length === 0) {
        return;
      }
      renderLoadingMessage();
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const { target: loadTarget } = loadEvt;
        if (loadTarget === null || !(loadTarget instanceof FileReader)) {
          return;
        }
        if (!(loadTarget.result instanceof ArrayBuffer)) {
          return;
        }
        const arr = new Uint8Array(loadTarget.result);
        try {
          renderParsingMessage();
          const res = parser_default(arr);
          render(res);
        } catch (err) {
          renderError(err);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    };
    fileInputEl.addEventListener("change", onFileSelection, false);
  } else {
    fileInputWrapperElt.style.display = "none";
    const choiceSeparatorElt = document.getElementById("choices-separator");
    if (choiceSeparatorElt !== null) {
      choiceSeparatorElt.style.display = "none";
    }
  }
  if (typeof window.fetch === "function" && window.Uint8Array !== void 0) {
    let onUrlValidation = function(url) {
      renderFetchingMessage();
      fetch(url).then((response) => response.arrayBuffer()).then((arrayBuffer) => {
        try {
          renderParsingMessage();
          const parsed = parser_default(new Uint8Array(arrayBuffer));
          render(parsed);
        } catch (err) {
          renderError(err);
        }
      }).catch(renderError);
    }, onButtonClicking = function() {
      if (urlInputElt === null) {
        throw new Error("URL input element not found");
      }
      const url = urlInputElt.value;
      if (url) {
        onUrlValidation(url);
        return false;
      }
    }, onInputKeyPress = function(evt) {
      const keyCode = evt.keyCode || evt.which;
      if (keyCode === 13) {
        const url = evt.target.value;
        if (url) {
          onUrlValidation(url);
        }
        return false;
      }
    };
    urlInputElt.addEventListener("keypress", onInputKeyPress, false);
    urlInputElt.addEventListener("click", onButtonClicking, false);
  } else {
    const choiceSeparatorElt = document.getElementById("choices-separator");
    if (choiceSeparatorElt !== null) {
      choiceSeparatorElt.style.display = "none";
    }
  }
})();
