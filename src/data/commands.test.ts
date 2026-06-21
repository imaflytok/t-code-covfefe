import { expect, test } from "vitest";
import { covfefe, executiveOrder, parseCommand } from "./commands";

test("parseCommand handles bare + arg commands, ignores normal text", () => {
  expect(parseCommand("/covfefe")).toEqual({ cmd: "covfefe", arg: "" });
  expect(parseCommand("/model gpt-4o")).toEqual({ cmd: "model", arg: "gpt-4o" });
  expect(parseCommand("  /CLEAR ")).toEqual({ cmd: "clear", arg: "" });
  expect(parseCommand("hello")).toBeNull();
});

test("easter eggs return content", () => {
  expect(covfefe().toLowerCase()).toContain("covfefe");
  expect(executiveOrder("security")).toContain("SECURITY");
  expect(executiveOrder("")).toContain("CODE QUALITY");
});
