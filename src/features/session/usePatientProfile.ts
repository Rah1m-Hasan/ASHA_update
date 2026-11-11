"use client";

import { createContext, useContext } from "react";
import type { SessionData, Profile } from "./types";

export type PatientProfileCtx = {
  profile: Profile | null;
  data: SessionData | null;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  isLocalDemo: boolean;
};

export const PatientProfileContext = createContext<PatientProfileCtx>({
  profile: null,
  data: null,
  error: null,
  loading: false,
  refresh: async () => {},
  isLocalDemo: false,
});

export const usePatientProfile = () => useContext(PatientProfileContext);
