"use client";

import { LOCAL_DEMO_PROFILE } from "./actions";
import { useSession } from "./store";
import { PatientProfileContext } from "./usePatientProfile";
import { useSessionData } from "./useSessionData";

/** Loads the patient's care circle (or a local demo profile when none is linked). */
export function PatientProfileProvider({ children }: { children: React.ReactNode }) {
  const cred = useSession((s) => s.patient);
  const { data, error, loading, refresh } = useSessionData(cred, 6000);
  const isLocalDemo = !cred;
  const profile = data?.profile ?? (isLocalDemo ? LOCAL_DEMO_PROFILE : null);
  return (
    <PatientProfileContext.Provider value={{ profile, data, error, loading, refresh, isLocalDemo }}>
      {children}
    </PatientProfileContext.Provider>
  );
}
