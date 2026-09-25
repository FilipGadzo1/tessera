import "./setup.css";
import { afterEach } from "vitest";
import { resetEmulatedMedia } from "./emulation";
import { parkPointer } from "./pointer";

// After every test in every file: park the pointer (no hover leaks into the next test) and clear
// any emulated media (forced colors, reduced motion) a test forgot to reset.
afterEach(async () => {
  await parkPointer();
  await resetEmulatedMedia();
});
