import { useState } from "react";
import { type Option, None, Some } from "@/types/option";

export enum WeekSlide {
  FromLeft = "from-left",
  FromRight = "from-right",
}

/** The side a newly shown week enters from; `None` until the week changes while mounted. */
export function useWeekSlide(weekOffset: number): Option<WeekSlide> {
  const [shown, setShown] = useState<{ offset: number; slide: Option<WeekSlide> }>({ offset: weekOffset, slide: None });
  if (weekOffset === shown.offset) return shown.slide;
  const slide = Some(weekOffset > shown.offset ? WeekSlide.FromRight : WeekSlide.FromLeft);
  setShown({ offset: weekOffset, slide });
  return slide;
}
