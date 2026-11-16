import Link from "next/link";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { LinkConnect } from "@/components/dashboard/LinkConnect";
import { Panel } from "@/components/dashboard/Panel";
import { buttonClass } from "@/components/ui/Button";
import { UsersIcon } from "@/components/ui/icons";

export function NoPatient() {
  return (
    <Panel>
      <EmptyState
        icon={<UsersIcon />}
        // This state replaces the whole page, so its title is the page heading.
        headingLevel={1}
        title="No patients yet"
        action={
          <div className="flex flex-col items-center gap-4">
            <Link href="/dashboard/caregiver/patients/new" className={buttonClass()}>
              Add a patient
            </Link>
            <div className="w-full max-w-md">
              <p className="mb-2 text-sm text-muted">Or paste a caregiver link you were sent</p>
              <LinkConnect />
            </div>
          </div>
        }
      >
        Set up a private care circle for someone you support. Their requests and live status appear here.
      </EmptyState>
    </Panel>
  );
}
