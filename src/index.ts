import parseBif from "./parser";
import {
  render,
  renderError,
  renderFetchingMessage,
  renderLoadingMessage,
  renderParsingMessage,
} from "./render";

const fileInputWrapperElt = document.getElementById("file-input-wrapper");
const fileInputEl = document.getElementById("file-input");
const urlInputElt = document.getElementById("url-input");
const urlInputWrapperElt = document.getElementById("url-input-wrapper");

if (fileInputWrapperElt === null || fileInputEl === null) {
  throw new Error("File input not found in the document");
}
if (urlInputWrapperElt === null || urlInputElt === null) {
  throw new Error("URL input not found in the document");
}


if (
  window.File !== undefined &&
  window.FileReader !== undefined &&
  window.Uint8Array !== undefined
) {

  /**
   * @param {Event} evt
   */
  function onFileSelection(evt: Event) {
    const { target } = evt;
    if (target === null || !(target instanceof HTMLInputElement)) {
      return;
    }
    const files = target.files; // FileList object
    if (files === null || files.length === 0) {
      return;
    }

    renderLoadingMessage();
    const file = files[0];
    const reader = new FileReader();

    // TODO read progressively to skip mdat and whatnot
    reader.onload = (loadEvt : Event) => {
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
        const res = parseBif(arr);
        render(res);
      } catch (err) {
        renderError(err);
      }
    };

    reader.readAsArrayBuffer(file);
    return;
  }

  fileInputEl.addEventListener("change", onFileSelection, false);

} else {
  fileInputWrapperElt.style.display = "none";

  const choiceSeparatorElt = document.getElementById("choices-separator");
  if (choiceSeparatorElt !== null) {
    choiceSeparatorElt.style.display = "none";
  }
}

if (typeof window.fetch === "function" && window.Uint8Array !== undefined) {

  /**
   * @param {Event} evt
   */
  function onUrlValidation(url: string) {
    renderFetchingMessage();
    fetch(url)
      .then(response => response.arrayBuffer())
      .then((arrayBuffer) => {
        try {
          renderParsingMessage();
          const parsed = parseBif(new Uint8Array(arrayBuffer));
          render(parsed);
        } catch (err) {
          renderError(err);
        }
      }).catch(renderError);
  }

  /**
   * @returns {Boolean}
   */
  function onButtonClicking() {
    if (urlInputElt === null) {
      throw new Error("URL input element not found");
    }
    const url = (urlInputElt as HTMLInputElement).value;
    if (url) {
      onUrlValidation(url);
      return false;
    }
  }

  /**
   * @param {Event} evt
   * @returns {Boolean}
   */
  function onInputKeyPress(evt: KeyboardEvent) {
    const keyCode = evt.keyCode || evt.which;
    if (keyCode === 13) {
      const url = (evt.target as HTMLInputElement).value;
      if (url) {
        onUrlValidation(url);
      }
      return false;
    }
  }

  urlInputElt.addEventListener("keypress", onInputKeyPress, false);
  urlInputElt.addEventListener("click", onButtonClicking, false);
} else {
  const choiceSeparatorElt = document.getElementById("choices-separator");
  if (choiceSeparatorElt !== null) {
    choiceSeparatorElt.style.display = "none";
  }
}

