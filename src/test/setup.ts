import "@testing-library/jest-dom";

// jsdom does not implement Element.prototype.scrollIntoView; stub it so
// components that auto-scroll (e.g. MessageList) can mount under test.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
