import s1_0 from "../../assets/faces/set1_0.png";
import s1_1 from "../../assets/faces/set1_1.png";
import s1_2 from "../../assets/faces/set1_2.png";
import s1_3 from "../../assets/faces/set1_3.png";
import s1_4 from "../../assets/faces/set1_4.png";
import s2_0 from "../../assets/faces/set2_0.png";
import s2_1 from "../../assets/faces/set2_1.png";
import s2_2 from "../../assets/faces/set2_2.png";
import s2_3 from "../../assets/faces/set2_3.png";
import s2_4 from "../../assets/faces/set2_4.png";

export interface Face {
  src: string;
  caption: string;
}

/** Set 1 — Trump is answering. */
export const SET1: Face[] = [
  { src: s1_0, caption: "thinking..." },
  { src: s1_1, caption: "tremendous thinking..." },
  { src: s1_2, caption: "very busy... making it perfect" },
  { src: s1_3, caption: "this is easy. believe me." },
  { src: s1_4, caption: "almost done... it's going to be beautiful" },
];

/** Set 2 — Trump is appraising your question. */
export const SET2: Face[] = [
  { src: s2_0, caption: "very smart question" },
  { src: s2_1, caption: "one of the best questions ever" },
  { src: s2_2, caption: "people don't ask this... sad!" },
  { src: s2_3, caption: "I know the best answer. always." },
  { src: s2_4, caption: "here it comes... huge answer" },
];

/** Pick one of the two caption sets (the row of 5 shown while thinking). */
export function pickRow(seed = Math.random()): Face[] {
  return seed < 0.5 ? SET1 : SET2;
}
