export const INTEREST_EVENT = "asha:enquiry-interest";

/** Ask the enquiry form to preselect a topic (e.g. from a plan card). */
export function selectInterest(interest: string) {
  window.dispatchEvent(new CustomEvent(INTEREST_EVENT, { detail: interest }));
}
