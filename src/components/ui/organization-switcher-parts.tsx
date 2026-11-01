import { None, Some, type Option } from "@/types/option";

export function optionsMessage(
  isLoading: boolean,
  isError: boolean,
  isEmpty: boolean
): Option<string> {
  if (isLoading) return Some("Loading organizations...");
  if (isError) return Some("Error loading organizations");
  if (isEmpty) return Some("No organizations found");
  return None;
}
