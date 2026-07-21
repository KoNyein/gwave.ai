import { Leaf } from "lucide-react";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getCurrentProfile, requireUser } from "@/lib/auth";

export default async function OnboardingPage() {
  await requireUser();
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-12">
      <div className="mb-8 flex items-center gap-2 text-primary">
        <Leaf className="h-8 w-8" />
        <span className="text-2xl font-bold">Gwave</span>
      </div>
      <OnboardingForm profile={profile} />
    </div>
  );
}
