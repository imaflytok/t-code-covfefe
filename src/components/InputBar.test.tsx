import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { InputBar } from "./InputBar";

test("Enter submits; Shift+Enter does not", () => {
  const onSend = vi.fn();
  render(<InputBar onSend={onSend} />);
  const ta = screen.getByPlaceholderText(/ask trump/i);

  fireEvent.change(ta, { target: { value: "hello" } });
  fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
  expect(onSend).not.toHaveBeenCalled();

  fireEvent.keyDown(ta, { key: "Enter" });
  expect(onSend).toHaveBeenCalledWith("hello");
});
