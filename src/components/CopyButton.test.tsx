import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { CopyButton } from "./CopyButton";

test("copies provided text on click", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });

  render(<CopyButton getText={() => "abc"} />);
  fireEvent.click(screen.getByRole("button", { name: /copy/i }));

  expect(writeText).toHaveBeenCalledWith("abc");
});
