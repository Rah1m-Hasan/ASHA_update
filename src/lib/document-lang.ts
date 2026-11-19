"use client";

import { useEffect } from "react";

/**
 * Keeps the document language in step with the language the page is written in.
 *
 * The document is served as English. A screen the person has switched to Bangla
 * must be announced in Bangla, or a screen reader reads it with the wrong
 * pronunciation (WCAG 3.1.1 Language of Page, 3.1.2 Language of Parts).
 *
 * The value is written straight onto the root element rather than through React
 * state: the language is a property of the document, not of any one component,
 * and the reading language has to be correct before the first word is spoken.
 */
export function setDocumentLanguage(language: string | undefined | null) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "bn" ? "bn" : "en";
}

/** Bangla is written in its own script, and it is easy to recognise. */
const BANGLA = /[ঀ-৿]/;

/**
 * The language of a piece of text, for the parts of a page that are written in
 * one language inside a page written in another (WCAG 3.1.2 Language of Parts).
 * A Bangla answer inside an English chat is the common case.
 */
export function textLanguage(text: string | undefined | null) {
  return text && BANGLA.test(text) ? "bn" : "en";
}

/**
 * Sets the document language for as long as the screen that owns it is on
 * screen, and puts it back to English when that screen is left.
 *
 * The restore matters: the language belongs to a screen, not to the session. A
 * person who reads Move in Bangla and then opens an English screen must have
 * that screen announced in English, so the language is never left behind on the
 * document.
 */
export function useDocumentLanguage(language: string | undefined | null) {
  useEffect(() => {
    setDocumentLanguage(language);
    return () => setDocumentLanguage("en");
  }, [language]);
}
